"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import { formatDateTime, sentenceCase } from "@/lib/format";
import type { AuditEvent, ListQuery } from "@/types/domain";

interface AuditFilters extends ListQuery {
  category?: AuditEvent["category"] | "";
}

const auditColumns: Array<DataTableColumn<AuditEvent>> = [
  {
    id: "createdAt",
    header: "Time",
    exportValue: (event) => formatDateTime(event.createdAt),
    cell: (event) => formatDateTime(event.createdAt),
  },
  {
    id: "category",
    header: "Category",
    exportValue: (event) => sentenceCase(event.category),
    cell: (event) => sentenceCase(event.category),
  },
  {
    id: "action",
    header: "Action",
    exportValue: (event) => event.action,
    cell: (event) => <span className="font-medium">{event.action}</span>,
  },
  {
    id: "actor",
    header: "Actor",
    exportValue: (event) => event.actor,
    cell: (event) => event.actor,
  },
  {
    id: "outcome",
    header: "Outcome",
    exportValue: (event) => sentenceCase(event.outcome),
    cell: (event) => (
      <StatusBadge
        label={sentenceCase(event.outcome)}
        tone={event.outcome === "success" ? "green" : event.outcome === "failed" ? "red" : "yellow"}
      />
    ),
  },
];

export function AuditPage() {
  const [filters, setFilters] = useState<AuditFilters>({
    page: 1,
    limit: 10,
    search: "",
    status: "",
    category: "",
    dateFrom: "",
    dateTo: "",
  });
  const auditQuery = useQuery({
    queryKey: ["audit-events", filters],
    queryFn: () => api.auditEventPage(filters),
    placeholderData: (previousData) => previousData,
  });

  function updateFilters(nextFilters: Partial<AuditFilters>) {
    setFilters((current) => ({ ...current, ...nextFilters, page: nextFilters.page ?? 1 }));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Audit</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">Security, customer, bundle, and integration events.</p>
      </div>

      <Panel>
        <DataTable
          columns={auditColumns}
          rows={auditQuery.data?.data ?? []}
          getRowKey={(event) => event.id}
          minWidth={760}
          isLoading={auditQuery.isLoading}
          exportOptions={{
            title: "Audit Events",
            filename: "audit-events",
          }}
          filters={
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <FilterInput
                label="Search"
                value={filters.search ?? ""}
                onChange={(value) => updateFilters({ search: value })}
              />
              <FilterSelect
                label="Category"
                value={filters.category ?? ""}
                onChange={(value) => updateFilters({ category: value as AuditFilters["category"] })}
                options={[
                  { label: "All categories", value: "" },
                  { label: "Security", value: "security" },
                  { label: "Customer", value: "customer" },
                  { label: "Bundle", value: "bundle" },
                  { label: "Integration", value: "integration" },
                ]}
              />
              <FilterSelect
                label="Outcome"
                value={filters.status ?? ""}
                onChange={(value) => updateFilters({ status: value })}
                options={[
                  { label: "All outcomes", value: "" },
                  { label: "Success", value: "success" },
                  { label: "Warning", value: "warning" },
                  { label: "Failed", value: "failed" },
                ]}
              />
              <FilterInput
                label="From"
                type="date"
                value={filters.dateFrom ?? ""}
                onChange={(value) => updateFilters({ dateFrom: value })}
              />
              <FilterInput
                label="To"
                type="date"
                value={filters.dateTo ?? ""}
                onChange={(value) => updateFilters({ dateTo: value })}
              />
            </div>
          }
          pagination={
            auditQuery.data
              ? {
                  ...auditQuery.data.meta,
                  windowKey: JSON.stringify({
                    search: filters.search,
                    category: filters.category,
                    status: filters.status,
                    dateFrom: filters.dateFrom,
                    dateTo: filters.dateTo,
                  limit: filters.limit,
                }),
                isFetchingPage: auditQuery.isFetching,
                onPageChange: (page) => updateFilters({ page }),
                onLimitChange: (limit) => updateFilters({ limit }),
              }
              : undefined
          }
        />
      </Panel>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <TextField label={label} type={type} value={value} onValueChange={onChange} />
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <SelectField label={label} value={value} onValueChange={onChange} options={options} />
  );
}
