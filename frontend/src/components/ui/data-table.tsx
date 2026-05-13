"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  MoreHorizontal,
  Printer,
  SlidersHorizontal,
} from "lucide-react";
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DataTableExportValue = string | number | boolean | null | undefined;
type DataTableExportFormat = "csv" | "excel" | "pdf" | "print";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  exportHeader?: string;
  exportValue?: (row: T) => DataTableExportValue;
  exportable?: boolean;
}

export interface DataTableRowAction<T> {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  variant?: "default" | "destructive";
  disabled?: boolean | ((row: T) => boolean);
  hidden?: boolean | ((row: T) => boolean);
  onSelect: (row: T) => void | Promise<void>;
}

interface DataTableExportOptions<T> {
  enabled?: boolean;
  title: string;
  filename: string;
  rows?: T[];
  formats?: DataTableExportFormat[];
}

interface DataTablePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
  isFetchingPage?: boolean;
  mode?: "infinite" | "controls";
  windowKey?: string;
  maxCachedPages?: number;
}

interface DataTableInfinite {
  enabled: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  loadedCount: number;
  total?: number;
}

interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  filters?: ReactNode;
  isLoading?: boolean;
  minWidth?: number;
  pagination?: DataTablePagination;
  infinite?: DataTableInfinite;
  exportOptions?: DataTableExportOptions<T>;
  rowActions?: Array<DataTableRowAction<T>> | ((row: T) => Array<DataTableRowAction<T>>);
}

interface CachedPage<T> {
  page: number;
  rows: T[];
}

type PaginationDirection = "next" | "previous";

interface PaginationCacheState<T> {
  pages: Array<CachedPage<T>>;
  signature: string | null;
  windowKey: string | null;
}

type PaginationCacheAction<T> =
  | { type: "reset" }
  | {
      type: "receive";
      direction: PaginationDirection | null;
      maxCachedPages: number;
      page: number;
      rows: T[];
      signature: string;
      windowKey: string;
    };

const defaultExportFormats: DataTableExportFormat[] = ["csv", "excel", "pdf", "print"];

function reducePaginationCache<T>(
  state: PaginationCacheState<T>,
  action: PaginationCacheAction<T>,
): PaginationCacheState<T> {
  if (action.type === "reset") {
    return state.pages.length === 0 && state.signature === null && state.windowKey === null
      ? state
      : { pages: [], signature: null, windowKey: null };
  }

  if (state.signature === action.signature) {
    return state;
  }

  const shouldReset = state.windowKey !== action.windowKey;
  const nextPages = shouldReset
    ? [{ page: action.page, rows: action.rows }]
    : [
        ...state.pages.filter((cachedPage) => cachedPage.page !== action.page),
        { page: action.page, rows: action.rows },
      ];
  const sortedPages = nextPages.sort((left, right) => left.page - right.page);

  while (sortedPages.length > action.maxCachedPages) {
    if (action.direction === "next") {
      sortedPages.shift();
      continue;
    }

    if (action.direction === "previous") {
      sortedPages.pop();
      continue;
    }

    const firstDistance = Math.abs((sortedPages[0]?.page ?? action.page) - action.page);
    const lastDistance = Math.abs(
      (sortedPages[sortedPages.length - 1]?.page ?? action.page) - action.page,
    );

    if (lastDistance > firstDistance) {
      sortedPages.pop();
    } else {
      sortedPages.shift();
    }
  }

  return {
    pages: sortedPages,
    signature: action.signature,
    windowKey: action.windowKey,
  };
}

function resolveRowFlag<T>(flag: boolean | ((row: T) => boolean) | undefined, row: T) {
  return typeof flag === "function" ? flag(row) : (flag ?? false);
}

function normalizeFilename(filename: string) {
  return filename
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "table-export";
}

function serializeValue(value: DataTableExportValue) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function escapeCsv(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadTextFile(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildExportRows<T>(columns: Array<DataTableColumn<T>>, rows: T[]) {
  const exportColumns = columns.filter((column) => column.exportable !== false);

  return {
    headers: exportColumns.map((column) => column.exportHeader ?? column.header),
    rows: rows.map((row) =>
      exportColumns.map((column) => {
        if (column.exportValue) {
          return serializeValue(column.exportValue(row));
        }

        const cellValue = column.cell(row);

        if (
          typeof cellValue === "string" ||
          typeof cellValue === "number" ||
          typeof cellValue === "boolean"
        ) {
          return serializeValue(cellValue);
        }

        return "";
      }),
    ),
  };
}

function buildPrintableTable(title: string, headers: string[], rows: string[][]) {
  const generatedAt = new Date().toLocaleString();
  const headerMarkup = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const rowMarkup = rows
    .map(
      (row) =>
        `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { color: #141414; font-family: "Outfit", "MTNWorkSans", "Work Sans", Arial, sans-serif; margin: 24px; }
      h1 { font-family: "Outfit", "MTNBrighterSans", Arial, sans-serif; font-size: 20px; margin: 0 0 4px; }
      p { color: #60646c; font-size: 12px; margin: 0 0 16px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border-bottom: 1px solid #e5e5dc; font-size: 12px; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #000000; color: #ffffff; font-size: 11px; text-transform: uppercase; }
      tr:last-child td { border-bottom: 0; }
      @media print { body { margin: 12mm; } }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>Generated ${escapeHtml(generatedAt)}</p>
    <table>
      <thead><tr>${headerMarkup}</tr></thead>
      <tbody>${rowMarkup}</tbody>
    </table>
  </body>
</html>`;
}

function openPrintableDocument(title: string, html: string) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");

  if (!printWindow) {
    downloadTextFile(`${normalizeFilename(title)}.html`, "text/html;charset=utf-8", html);
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyMessage = "No records found.",
  filters,
  isLoading = false,
  minWidth = 720,
  pagination,
  infinite,
  exportOptions,
  rowActions,
}: DataTableProps<T>) {
  const topPageRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const paginationPendingPageRef = useRef<number | null>(null);
  const paginationDirectionRef = useRef<PaginationDirection | null>(null);
  const [paginationCache, dispatchPaginationCache] = useReducer(
    (state: PaginationCacheState<T>, action: PaginationCacheAction<T>) =>
      reducePaginationCache(state, action),
    { pages: [], signature: null, windowKey: null },
  );
  const infiniteEnabled = infinite?.enabled ?? false;
  const hasNextPage = infinite?.hasNextPage ?? false;
  const isFetchingNextPage = infinite?.isFetchingNextPage ?? false;
  const onLoadMore = infinite?.onLoadMore;
  const exportFormats = exportOptions?.formats ?? defaultExportFormats;
  const hasRowActions = Boolean(rowActions);
  const renderedColumnCount = columns.length + (hasRowActions ? 1 : 0);
  const paginationInfiniteEnabled = Boolean(pagination && (pagination.mode ?? "infinite") === "infinite");
  const paginationPage = pagination?.page ?? 1;
  const paginationLimit = pagination?.limit ?? rows.length;
  const paginationTotal = pagination?.total ?? rows.length;
  const paginationTotalPages = pagination?.totalPages ?? 1;
  const paginationWindowKey =
    pagination?.windowKey ?? `${paginationLimit}:${paginationTotal}`;
  const maxCachedPages = Math.max(pagination?.maxCachedPages ?? 4, 1);
  const paginationIsFetching = pagination?.isFetchingPage ?? false;
  const onPaginationPageChange = pagination?.onPageChange;
  const rowSignature = useMemo(
    () => rows.map((row) => getRowKey(row)).join("\u001f"),
    [getRowKey, rows],
  );
  const paginationCacheSignature = `${paginationWindowKey}:${paginationPage}:${rowSignature}`;
  const cachedPages =
    paginationInfiniteEnabled && paginationCache.windowKey === paginationWindowKey
      ? paginationCache.pages
      : [];
  const currentPageCached = cachedPages.some((cachedPage) => cachedPage.page === paginationPage);
  const visibleCachedPages =
    paginationInfiniteEnabled && !isLoading && !paginationIsFetching && !currentPageCached
      ? [...cachedPages, { page: paginationPage, rows }].sort(
          (left, right) => left.page - right.page,
        )
      : cachedPages;

  const renderedRows = paginationInfiniteEnabled
    ? visibleCachedPages.flatMap((cachedPage) => cachedPage.rows)
    : rows;
  const firstCachedPage = visibleCachedPages[0]?.page ?? paginationPage;
  const lastCachedPage = visibleCachedPages[visibleCachedPages.length - 1]?.page ?? paginationPage;
  const canLoadPreviousPage = Boolean(paginationInfiniteEnabled && pagination && firstCachedPage > 1);
  const canLoadNextPaginationPage = Boolean(
      paginationInfiniteEnabled &&
      pagination &&
      lastCachedPage < paginationTotalPages &&
      paginationTotalPages > 1,
  );
  const exportRows = exportOptions?.rows ?? renderedRows;
  const canExport = Boolean(exportOptions && exportOptions.enabled !== false && exportRows.length > 0);
  const exportData = useMemo(
    () => buildExportRows(columns, exportRows),
    [columns, exportRows],
  );

  const requestPaginationPage = useCallback((page: number, direction: "next" | "previous") => {
    if (
      !onPaginationPageChange ||
      isLoading ||
      paginationIsFetching ||
      paginationPendingPageRef.current === page
    ) {
      return;
    }

    paginationPendingPageRef.current = page;
    paginationDirectionRef.current = direction;
    onPaginationPageChange(page);
  }, [isLoading, onPaginationPageChange, paginationIsFetching]);

  useEffect(() => {
    if (!paginationInfiniteEnabled) {
      dispatchPaginationCache({ type: "reset" });
      paginationPendingPageRef.current = null;
      paginationDirectionRef.current = null;
      return;
    }

    if (isLoading || paginationIsFetching) {
      return;
    }

    dispatchPaginationCache({
      type: "receive",
      direction: paginationDirectionRef.current,
      maxCachedPages,
      page: paginationPage,
      rows,
      signature: paginationCacheSignature,
      windowKey: paginationWindowKey,
    });

    if (paginationPendingPageRef.current === paginationPage) {
      paginationPendingPageRef.current = null;
    }
    paginationDirectionRef.current = null;
  }, [
    isLoading,
    maxCachedPages,
    paginationCacheSignature,
    paginationIsFetching,
    paginationInfiniteEnabled,
    paginationPage,
    paginationWindowKey,
    rows,
  ]);

  useEffect(() => {
    const node = loadMoreRef.current;

    if (!infiniteEnabled || !hasNextPage || !node || !onLoadMore || paginationInfiniteEnabled) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      { rootMargin: "180px" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [hasNextPage, infiniteEnabled, isFetchingNextPage, onLoadMore, paginationInfiniteEnabled]);

  useEffect(() => {
    const node = loadMoreRef.current;

    if (!paginationInfiniteEnabled || !canLoadNextPaginationPage || !node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoading) {
          requestPaginationPage(lastCachedPage + 1, "next");
        }
      },
      { rootMargin: "240px" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [
    canLoadNextPaginationPage,
    isLoading,
    lastCachedPage,
    paginationInfiniteEnabled,
    requestPaginationPage,
  ]);

  useEffect(() => {
    const node = topPageRef.current;

    if (!paginationInfiniteEnabled || !canLoadPreviousPage || !node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoading) {
          requestPaginationPage(firstCachedPage - 1, "previous");
        }
      },
      { rootMargin: "240px" },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [
    canLoadPreviousPage,
    firstCachedPage,
    isLoading,
    paginationInfiniteEnabled,
    requestPaginationPage,
  ]);

  function handleExport(format: DataTableExportFormat) {
    if (!exportOptions) {
      return;
    }

    const filename = normalizeFilename(exportOptions.filename);

    if (format === "csv") {
      const csvRows = [
        exportData.headers.map(escapeCsv).join(","),
        ...exportData.rows.map((row) => row.map(escapeCsv).join(",")),
      ].join("\n");

      downloadTextFile(`${filename}.csv`, "text/csv;charset=utf-8", `\ufeff${csvRows}`);
      return;
    }

    if (format === "excel") {
      const html = buildPrintableTable(exportOptions.title, exportData.headers, exportData.rows);
      downloadTextFile(`${filename}.xls`, "application/vnd.ms-excel;charset=utf-8", html);
      return;
    }

    const html = buildPrintableTable(exportOptions.title, exportData.headers, exportData.rows);
    openPrintableDocument(exportOptions.title, html);
  }

  function resolveRowActions(row: T) {
    const actions = typeof rowActions === "function" ? rowActions(row) : (rowActions ?? []);

    return actions.filter((action) => !resolveRowFlag(action.hidden, row));
  }

  function renderExportMenu() {
    if (!canExport) {
      return null;
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Export table</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {exportFormats.includes("csv") && (
              <DropdownMenuItem onSelect={() => handleExport("csv")}>
                <FileText className="h-4 w-4" />
                CSV
              </DropdownMenuItem>
            )}
            {exportFormats.includes("excel") && (
              <DropdownMenuItem onSelect={() => handleExport("excel")}>
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </DropdownMenuItem>
            )}
            {exportFormats.includes("pdf") && (
              <DropdownMenuItem onSelect={() => handleExport("pdf")}>
                <FileText className="h-4 w-4" />
                PDF
              </DropdownMenuItem>
            )}
            {exportFormats.includes("print") && (
              <DropdownMenuItem onSelect={() => handleExport("print")}>
                <Printer className="h-4 w-4" />
                Print
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {filters && (
        <div className="hidden gap-3 rounded-md border border-border/50 bg-background p-3 md:grid">
          {filters}
        </div>
      )}

      {(filters || canExport) && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {filters && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="md:hidden">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl md:hidden">
                <DialogHeader>
                  <DialogTitle>Table filters</DialogTitle>
                  <DialogDescription>
                    Refine the records shown in this table.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">{filters}</div>
              </DialogContent>
            </Dialog>
          )}
          {renderExportMenu()}
        </div>
      )}

      {paginationInfiniteEnabled && (
        <div ref={topPageRef} className="min-h-2" aria-hidden="true" />
      )}

      <Table style={{ minWidth }}>
        <TableHeader>
          <TableRow className="text-left text-xs uppercase hover:bg-transparent dark:hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={cn("py-3 pr-4 font-semibold", column.headerClassName)}
                >
                  {column.header}
                </TableHead>
              ))}
              {hasRowActions && (
                <TableHead className="w-12 py-3 pr-4 text-right font-semibold">
                  Actions
                </TableHead>
              )}
          </TableRow>
        </TableHeader>
        <TableBody>
            {isLoading && (
              <TableRow className="hover:bg-transparent">
                <TableCell className="py-6 text-center text-muted-foreground" colSpan={renderedColumnCount}>
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading records...
                  </span>
                </TableCell>
              </TableRow>
            )}

            {!isLoading && renderedRows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell className="py-6 text-center text-muted-foreground" colSpan={renderedColumnCount}>
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              renderedRows.map((row) => (
                <TableRow
                  key={getRowKey(row)}
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn(onRowClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                >
                  {columns.map((column) => (
                    <TableCell key={column.id} className={cn("py-3 pr-4 align-top whitespace-normal", column.className)}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                  {hasRowActions && (
                    <TableCell
                      className="py-2 pr-4 text-right align-top"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <RowActionsMenu actions={resolveRowActions(row)} row={row} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
        </TableBody>
      </Table>

      {(infiniteEnabled || paginationInfiniteEnabled) && (
        <div ref={loadMoreRef} className="flex min-h-10 flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          {paginationInfiniteEnabled && pagination ? (
            <span>
              Showing pages {firstCachedPage}-{lastCachedPage} of {pagination.totalPages} -{" "}
              {renderedRows.length} loaded of {pagination.total} records
            </span>
          ) : (
            <span>
              Showing {infinite?.loadedCount ?? renderedRows.length}
              {typeof infinite?.total === "number" ? ` of ${infinite.total}` : ""} records
            </span>
          )}
          {(isFetchingNextPage || (paginationInfiniteEnabled && (isLoading || paginationIsFetching))) && (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading more...
            </span>
          )}
          {!paginationInfiniteEnabled && !hasNextPage && renderedRows.length > 0 && <span>End of table</span>}
          {paginationInfiniteEnabled && !canLoadNextPaginationPage && renderedRows.length > 0 && <span>End of table</span>}
        </div>
      )}

      {pagination && !infiniteEnabled && !paginationInfiniteEnabled && (
        <div className="flex flex-col gap-3 border-t border-border/50 pt-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Page {pagination.page} of {pagination.totalPages} - {pagination.total} records
            </span>
            {pagination.onLimitChange && (
              <label className="inline-flex items-center gap-2">
                Rows
                <NativeSelect
                  value={pagination.limit}
                  onChange={(event) => pagination.onLimitChange?.(Number(event.target.value))}
                  className="h-9 w-24 text-foreground"
                >
                  {(pagination.limitOptions ?? [10, 20, 50]).map((option) => (
                    <NativeSelectOption key={option} value={option}>
                      {option}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              title="First page"
              aria-label="First page"
              disabled={!pagination.hasPreviousPage}
              onClick={() => pagination.onPageChange(1)}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Previous page"
              aria-label="Previous page"
              disabled={!pagination.hasPreviousPage}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Next page"
              aria-label="Next page"
              disabled={!pagination.hasNextPage}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Last page"
              aria-label="Last page"
              disabled={!pagination.hasNextPage}
              onClick={() => pagination.onPageChange(pagination.totalPages)}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RowActionsMenu<T>({ actions, row }: { actions: Array<DataTableRowAction<T>>; row: T }) {
  if (actions.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Row actions" aria-label="Row actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <DropdownMenuItem
                key={action.id}
                variant={action.variant}
                disabled={resolveRowFlag(action.disabled, row)}
                onSelect={() => {
                  void action.onSelect(row);
                }}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
