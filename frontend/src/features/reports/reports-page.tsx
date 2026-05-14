"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Gauge,
  ReceiptText,
  RotateCcw,
  UserPlus,
  X,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/ui/data-table";
import { PhoneField, SelectField, TextField } from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import {
  formatDateTime,
  formatPaymentMethod,
  formatUgx,
  sentenceCase,
} from "@/lib/format";
import {
  includesSearch,
  isWithinDateRange,
  paginateRows,
} from "@/lib/list-query";
import { createServiceRequestConversionForm } from "@/lib/service-request-conversion";
import {
  downloadTransactionReceipt,
  retryTransactionPayment,
  showPrimaryBalance,
  showSecondaryUsage,
} from "@/lib/table-actions";
import type {
  AdminReport,
  BalanceResult,
  Customer,
  CustomerRegistrationRequest,
  CustomerStatus,
  PaymentMethod,
  ReportTransaction,
  SecondaryNumber,
  ServiceRequest,
  ServiceRequestStatus,
  Transaction,
} from "@/types/domain";
import type { ReportSection } from "@/store/ui-store";

interface ReportTableFilters {
  search: string;
  customerId: string;
  status: Transaction["status"] | "";
  paymentMethod: PaymentMethod | "";
  dateFrom: string;
  dateTo: string;
  page: number;
  limit: number;
}

interface ActivityFilters {
  search: string;
  status: CustomerStatus | "";
  dateFrom: string;
  dateTo: string;
  page: number;
  limit: number;
}

interface ServiceRequestFilters {
  search: string;
  status: ServiceRequestStatus | "";
  dateFrom: string;
  dateTo: string;
  page: number;
  limit: number;
}

interface CustomerReportFilters {
  search: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  limit: number;
}

const reportColumns: Array<DataTableColumn<ReportTransaction>> = [
  {
    id: "createdAt",
    header: "Date",
    exportValue: (transaction) => formatDateTime(transaction.createdAt),
    cell: (transaction) => formatDateTime(transaction.createdAt),
  },
  {
    id: "customer",
    header: "Customer",
    exportValue: (transaction) =>
      `${transaction.customerName} (${transaction.registrationNumber})`,
    cell: (transaction) => (
      <div>
        <p className="font-medium">{transaction.customerName}</p>
        <p className="text-xs text-[var(--muted)]">
          {transaction.registrationNumber}
        </p>
      </div>
    ),
  },
  {
    id: "primaryMsisdn",
    header: "Primary MSISDN",
    exportValue: (transaction) => transaction.primaryMsisdn,
    cell: (transaction) => transaction.primaryMsisdn,
  },
  {
    id: "apnId",
    header: "APN",
    exportValue: (transaction) => transaction.apnId,
    cell: (transaction) => transaction.apnId,
  },
  {
    id: "bundleName",
    header: "Bundle",
    exportValue: (transaction) => transaction.bundleName,
    cell: (transaction) => transaction.bundleName,
  },
  {
    id: "paymentMethod",
    header: "Payment",
    exportValue: (transaction) =>
      formatPaymentMethod(transaction.paymentMethod),
    cell: (transaction) => formatPaymentMethod(transaction.paymentMethod),
  },
  {
    id: "amountUgx",
    header: "Amount",
    exportValue: (transaction) => formatUgx(transaction.amountUgx),
    cell: (transaction) => formatUgx(transaction.amountUgx),
  },
  {
    id: "status",
    header: "Status",
    exportValue: (transaction) => sentenceCase(transaction.status),
    cell: (transaction) => (
      <StatusBadge
        label={sentenceCase(transaction.status)}
        tone={
          transaction.status === "provisioned"
            ? "green"
            : transaction.status === "failed"
              ? "red"
              : "yellow"
        }
      />
    ),
  },
];

const activityColumns: Array<
  DataTableColumn<AdminReport["customerActivity"][number]>
> = [
  {
    id: "customer",
    header: "Customer",
    exportValue: (item) => item.customerName,
    cell: (item) => <span className="font-medium">{item.customerName}</span>,
  },
  {
    id: "createdAt",
    header: "Registered",
    exportValue: (item) => formatDateTime(item.createdAt),
    cell: (item) => formatDateTime(item.createdAt),
  },
  {
    id: "primary",
    header: "Primaries",
    exportValue: (item) => item.totalPrimaryNumbers,
    cell: (item) => item.totalPrimaryNumbers,
  },
  {
    id: "secondary",
    header: "Secondary",
    exportValue: (item) => item.totalSecondaryNumbers,
    cell: (item) => item.totalSecondaryNumbers,
  },
  {
    id: "bundles",
    header: "Bundles",
    exportValue: (item) => item.bundlesPurchased,
    cell: (item) => item.bundlesPurchased,
  },
  {
    id: "spend",
    header: "Spend",
    exportValue: (item) => formatUgx(item.totalSpendUgx),
    cell: (item) => formatUgx(item.totalSpendUgx),
  },
  {
    id: "status",
    header: "Status",
    exportValue: (item) => sentenceCase(item.status),
    cell: (item) => (
      <StatusBadge
        label={sentenceCase(item.status)}
        tone={item.status === "active" ? "green" : "yellow"}
      />
    ),
  },
];

function serviceRequestStatusTone(status: ServiceRequestStatus) {
  if (status === "converted") {
    return "green" as const;
  }

  if (status === "contacted") {
    return "blue" as const;
  }

  return "yellow" as const;
}

const serviceRequestColumns: Array<DataTableColumn<ServiceRequest>> = [
  {
    id: "createdAt",
    header: "Requested",
    exportValue: (serviceRequest) => formatDateTime(serviceRequest.createdAt),
    cell: (serviceRequest) => formatDateTime(serviceRequest.createdAt),
  },
  {
    id: "businessName",
    header: "Business",
    exportValue: (serviceRequest) => serviceRequest.businessName,
    cell: (serviceRequest) => (
      <div>
        <p className="font-medium">{serviceRequest.businessName}</p>
        {serviceRequest.message && (
          <p className="mt-1 max-w-sm text-xs text-[var(--muted)]">
            {serviceRequest.message}
          </p>
        )}
      </div>
    ),
  },
  {
    id: "contact",
    header: "Contact",
    exportValue: (serviceRequest) =>
      `${serviceRequest.contactPerson} | ${serviceRequest.contactEmail} | ${serviceRequest.contactPhone}`,
    cell: (serviceRequest) => (
      <div>
        <p className="font-medium">{serviceRequest.contactPerson}</p>
        <p className="text-xs text-[var(--muted)]">
          {serviceRequest.contactEmail}
        </p>
        <p className="text-xs text-[var(--muted)]">
          {serviceRequest.contactPhone}
        </p>
      </div>
    ),
  },
  {
    id: "package",
    header: "Package",
    exportValue: (serviceRequest) =>
      serviceRequest.preferredPackageName ?? "Not selected",
    cell: (serviceRequest) =>
      serviceRequest.preferredPackageName ?? "Not selected",
  },
  {
    id: "status",
    header: "Status",
    exportValue: (serviceRequest) => sentenceCase(serviceRequest.status),
    cell: (serviceRequest) => (
      <StatusBadge
        label={sentenceCase(serviceRequest.status)}
        tone={serviceRequestStatusTone(serviceRequest.status)}
      />
    ),
  },
];

const purchaseColumns: Array<DataTableColumn<Transaction>> = [
  {
    id: "createdAt",
    header: "Date",
    exportValue: (transaction) => formatDateTime(transaction.createdAt),
    cell: (transaction) => formatDateTime(transaction.createdAt),
  },
  {
    id: "primaryMsisdn",
    header: "Primary MSISDN",
    exportValue: (transaction) => transaction.primaryMsisdn,
    cell: (transaction) => transaction.primaryMsisdn,
  },
  {
    id: "bundleName",
    header: "Bundle",
    exportValue: (transaction) => transaction.bundleName,
    cell: (transaction) => transaction.bundleName,
  },
  {
    id: "paymentMethod",
    header: "Payment",
    exportValue: (transaction) =>
      formatPaymentMethod(transaction.paymentMethod),
    cell: (transaction) => formatPaymentMethod(transaction.paymentMethod),
  },
  {
    id: "amountUgx",
    header: "Amount",
    exportValue: (transaction) => formatUgx(transaction.amountUgx),
    cell: (transaction) => formatUgx(transaction.amountUgx),
  },
  {
    id: "status",
    header: "Status",
    exportValue: (transaction) => sentenceCase(transaction.status),
    cell: (transaction) => (
      <StatusBadge
        label={sentenceCase(transaction.status)}
        tone={
          transaction.status === "provisioned"
            ? "green"
            : transaction.status === "failed"
              ? "red"
              : "yellow"
        }
      />
    ),
  },
];

const secondaryColumns: Array<DataTableColumn<SecondaryNumber>> = [
  {
    id: "msisdn",
    header: "MSISDN",
    exportValue: (secondaryNumber) => secondaryNumber.msisdn,
    cell: (secondaryNumber) => (
      <span className="font-medium">{secondaryNumber.msisdn}</span>
    ),
  },
  {
    id: "primary",
    header: "Primary",
    exportValue: (secondaryNumber) => secondaryNumber.primaryMsisdn,
    cell: (secondaryNumber) => secondaryNumber.primaryMsisdn,
  },
  {
    id: "apn",
    header: "APN",
    exportValue: (secondaryNumber) => secondaryNumber.apnId,
    cell: (secondaryNumber) => secondaryNumber.apnId,
  },
  {
    id: "addedAt",
    header: "Added",
    exportValue: (secondaryNumber) => formatDateTime(secondaryNumber.addedAt),
    cell: (secondaryNumber) => formatDateTime(secondaryNumber.addedAt),
  },
  {
    id: "status",
    header: "Status",
    exportValue: (secondaryNumber) => sentenceCase(secondaryNumber.status),
    cell: (secondaryNumber) => (
      <StatusBadge
        label={sentenceCase(secondaryNumber.status)}
        tone={secondaryNumber.status === "active" ? "green" : "red"}
      />
    ),
  },
];

const balanceColumns: Array<DataTableColumn<BalanceResult>> = [
  {
    id: "primary",
    header: "Primary MSISDN",
    exportValue: (balance) => balance.primaryMsisdn,
    cell: (balance) => (
      <span className="font-medium">{balance.primaryMsisdn}</span>
    ),
  },
  {
    id: "bundleName",
    header: "Bundle",
    exportValue: (balance) => balance.bundleName,
    cell: (balance) => balance.bundleName,
  },
  {
    id: "remaining",
    header: "Remaining",
    exportValue: (balance) =>
      `${balance.remainingVolumeGb.toLocaleString("en-US")} GB`,
    cell: (balance) =>
      `${balance.remainingVolumeGb.toLocaleString("en-US")} GB`,
  },
  {
    id: "total",
    header: "Total",
    exportValue: (balance) =>
      `${balance.totalVolumeGb.toLocaleString("en-US")} GB`,
    cell: (balance) => `${balance.totalVolumeGb.toLocaleString("en-US")} GB`,
  },
  {
    id: "autoTopup",
    header: "Auto Topup",
    exportValue: (balance) => balance.autoTopupRemaining,
    cell: (balance) => balance.autoTopupRemaining,
  },
  {
    id: "expiryAt",
    header: "Expiry",
    exportValue: (balance) => formatDateTime(balance.expiryAt),
    cell: (balance) => formatDateTime(balance.expiryAt),
  },
];

function buildTransactionRowActions({
  isRetryPending,
  onRetry,
}: {
  isRetryPending: boolean;
  onRetry: (transaction: ReportTransaction) => void;
}): Array<DataTableRowAction<ReportTransaction>> {
  return [
    {
      id: "check-primary-balance",
      label: "Check balance",
      icon: Activity,
      onSelect: (transaction) => {
        void showPrimaryBalance(
          transaction.customerId,
          transaction.primaryMsisdn,
        );
      },
    },
    {
      id: "download-receipt",
      label: "Preview receipt",
      icon: ReceiptText,
      hidden: (transaction) => transaction.status !== "provisioned",
      onSelect: downloadTransactionReceipt,
    },
    {
      id: "retry-payment",
      label: "Retry payment",
      icon: RotateCcw,
      hidden: (transaction) => transaction.status !== "failed",
      disabled: isRetryPending,
      onSelect: onRetry,
    },
  ];
}

const secondaryRowActions: Array<DataTableRowAction<SecondaryNumber>> = [
  {
    id: "check-secondary-usage",
    label: "Check usage",
    icon: Gauge,
    onSelect: (secondaryNumber) => {
      void showSecondaryUsage(
        secondaryNumber.customerId,
        secondaryNumber.primaryMsisdn,
        secondaryNumber.msisdn,
      );
    },
  },
  {
    id: "check-primary-balance",
    label: "Check balance",
    icon: Activity,
    onSelect: (secondaryNumber) => {
      void showPrimaryBalance(
        secondaryNumber.customerId,
        secondaryNumber.primaryMsisdn,
      );
    },
  },
];

export function ReportsPage({ report }: { report: ReportSection }) {
  if (report === "report-service-requests") {
    return <ServiceRequestsPage />;
  }

  if (report === "report-customer-activity") {
    return <CustomerActivityReportPage />;
  }

  if (report === "report-bundle-purchases") {
    return <BundlePurchasesReportPage />;
  }

  if (report === "report-secondary-numbers") {
    return <SecondaryNumbersReportPage />;
  }

  if (report === "report-balances") {
    return <BalancesReportPage />;
  }

  return <TransactionReportPage />;
}

function shouldRunAsyncSearchFallback(
  search: string,
  total: number,
  sourceReady: boolean,
) {
  return sourceReady && search.trim().length > 0 && total === 0;
}

function TransactionReportPage() {
  const queryClient = useQueryClient();
  const customersQuery = useQuery({
    queryKey: ["customers"],
    queryFn: api.customers,
  });
  const [reportFilters, setReportFilters] = useState<ReportTableFilters>({
    search: "",
    customerId: "",
    status: "",
    paymentMethod: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
    limit: 10,
  });
  const paginatedTransactionsQuery = useQuery({
    queryKey: ["report-transactions", reportFilters],
    queryFn: () => api.reportTransactions(reportFilters),
    placeholderData: (previousData) => previousData,
  });
  const reportRows = paginatedTransactionsQuery.data?.data ?? [];
  const reportMeta = paginatedTransactionsQuery.data?.meta;
  const retryTransactionMutation = useMutation({
    mutationFn: retryTransactionPayment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
        queryClient.invalidateQueries({ queryKey: ["report-transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["customer-report"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
      ]);
    },
  });
  const transactionRowActions = buildTransactionRowActions({
    isRetryPending: retryTransactionMutation.isPending,
    onRetry: (transaction) => retryTransactionMutation.mutate(transaction),
  });

  function updateReportFilters(nextFilters: Partial<ReportTableFilters>) {
    setReportFilters((current) => ({
      ...current,
      ...nextFilters,
      page: nextFilters.page ?? 1,
    }));
  }

  if (customersQuery.isError) {
    return <Panel>Transaction report could not be loaded.</Panel>;
  }

  return (
    <ReportFrame
      title="Transaction Report"
      description="Bundle payment, provisioning status, APN, and customer transaction history."
    >
      <DataTable
        columns={reportColumns}
        rows={reportRows}
        getRowKey={(transaction) => transaction.id}
        minWidth={1080}
        isLoading={
          paginatedTransactionsQuery.isLoading || customersQuery.isLoading
        }
        exportOptions={{
          title: "Transaction Report",
          filename: "transaction-report",
        }}
        rowActions={transactionRowActions}
        filters={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <FilterInput
              label="Search"
              value={reportFilters.search}
              onChange={(value) => updateReportFilters({ search: value })}
            />
            <FilterSelect
              label="Customer"
              value={reportFilters.customerId}
              onChange={(value) => updateReportFilters({ customerId: value })}
              options={[
                { label: "All customers", value: "" },
                ...(customersQuery.data ?? []).map((customer) => ({
                  label: customer.businessName,
                  value: customer.id,
                })),
              ]}
            />
            <FilterSelect
              label="Status"
              value={reportFilters.status}
              onChange={(value) =>
                updateReportFilters({
                  status: value as ReportTableFilters["status"],
                })
              }
              options={[
                { label: "All statuses", value: "" },
                { label: "Provisioned", value: "provisioned" },
                { label: "Pending", value: "pending" },
                { label: "Failed", value: "failed" },
              ]}
            />
            <FilterSelect
              label="Payment"
              value={reportFilters.paymentMethod}
              onChange={(value) =>
                updateReportFilters({
                  paymentMethod: value as ReportTableFilters["paymentMethod"],
                })
              }
              options={[
                { label: "All payments", value: "" },
                { label: "Mobile Money", value: "mobile_money" },
                { label: "Airtime", value: "airtime" },
                { label: "PRN", value: "prn" },
                { label: "Card", value: "card" },
              ]}
            />
            <FilterInput
              label="From"
              type="date"
              value={reportFilters.dateFrom}
              onChange={(value) => updateReportFilters({ dateFrom: value })}
            />
            <FilterInput
              label="To"
              type="date"
              value={reportFilters.dateTo}
              onChange={(value) => updateReportFilters({ dateTo: value })}
            />
          </div>
        }
        pagination={
          reportMeta
            ? {
                ...reportMeta,
                windowKey: JSON.stringify({
                  search: reportFilters.search,
                  customerId: reportFilters.customerId,
                  status: reportFilters.status,
                  paymentMethod: reportFilters.paymentMethod,
                  dateFrom: reportFilters.dateFrom,
                  dateTo: reportFilters.dateTo,
                  limit: reportFilters.limit,
                }),
                isFetchingPage: paginatedTransactionsQuery.isFetching,
                onPageChange: (page) => updateReportFilters({ page }),
                onLimitChange: (limit) => updateReportFilters({ limit }),
              }
            : undefined
        }
      />
    </ReportFrame>
  );
}

export function ServiceRequestsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ServiceRequestFilters>({
    search: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
    limit: 10,
  });
  const [selectedServiceRequest, setSelectedServiceRequest] =
    useState<ServiceRequest | null>(null);
  const [conversionForm, setConversionForm] =
    useState<CustomerRegistrationRequest | null>(null);
  const serviceRequestsQuery = useQuery({
    queryKey: ["service-requests", filters],
    queryFn: () => api.serviceRequestsPage(filters),
    placeholderData: (previousData) => previousData,
  });
  const serviceRequestRows = serviceRequestsQuery.data?.data ?? [];
  const serviceRequestMeta = serviceRequestsQuery.data?.meta;
  const invalidateServiceRequests = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["service-requests"] }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["customers-table"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-report"] }),
      queryClient.invalidateQueries({ queryKey: ["overview"] }),
      queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
    ]);
  };
  const markContactedMutation = useMutation({
    mutationFn: (serviceRequest: ServiceRequest) =>
      api.updateServiceRequest(serviceRequest.id, { status: "contacted" }),
    onSuccess: invalidateServiceRequests,
  });
  const convertMutation = useMutation({
    mutationFn: ({
      serviceRequestId,
      payload,
    }: {
      serviceRequestId: string;
      payload: CustomerRegistrationRequest;
    }) => api.convertServiceRequest(serviceRequestId, payload),
    onSuccess: async () => {
      setSelectedServiceRequest(null);
      setConversionForm(null);
      await invalidateServiceRequests();
    },
  });

  function updateFilters(nextFilters: Partial<ServiceRequestFilters>) {
    setFilters((current) => ({
      ...current,
      ...nextFilters,
      page: nextFilters.page ?? 1,
    }));
  }

  function openConversionDrawer(serviceRequest: ServiceRequest) {
    setSelectedServiceRequest(serviceRequest);
    setConversionForm(createServiceRequestConversionForm(serviceRequest));
  }

  function closeConversionDrawer() {
    setSelectedServiceRequest(null);
    setConversionForm(null);
  }

  function updateConversionField<Key extends keyof CustomerRegistrationRequest>(
    key: Key,
    value: CustomerRegistrationRequest[Key],
  ) {
    setConversionForm((current) =>
      current ? { ...current, [key]: value } : current,
    );
  }

  const rowActions = (
    serviceRequest: ServiceRequest,
  ): Array<DataTableRowAction<ServiceRequest>> => [
    {
      id: "mark-contacted",
      label: "Mark contacted",
      icon: CheckCircle2,
      disabled:
        serviceRequest.status !== "new" || markContactedMutation.isPending,
      hidden: serviceRequest.status === "converted",
      onSelect: (row) => markContactedMutation.mutate(row),
    },
    {
      id: "convert-to-customer",
      label: "Convert to customer",
      icon: UserPlus,
      disabled: serviceRequest.status === "converted",
      onSelect: openConversionDrawer,
    },
  ];

  return (
    <ReportFrame
      title="Service Requests"
      description="Manage public onboarding requests, track follow-up, and convert qualified requests into customer accounts."
    >
      <DataTable
        columns={serviceRequestColumns}
        rows={serviceRequestRows}
        getRowKey={(serviceRequest) => serviceRequest.id}
        minWidth={980}
        isLoading={serviceRequestsQuery.isLoading}
        emptyMessage="No service requests found."
        exportOptions={{
          title: "Service Requests",
          filename: "service-requests",
        }}
        rowActions={rowActions}
        filters={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FilterInput
              label="Search"
              value={filters.search}
              onChange={(value) => updateFilters({ search: value })}
            />
            <FilterSelect
              label="Status"
              value={filters.status}
              onChange={(value) =>
                updateFilters({
                  status: value as ServiceRequestFilters["status"],
                })
              }
              options={[
                { label: "All statuses", value: "" },
                { label: "New", value: "new" },
                { label: "Contacted", value: "contacted" },
                { label: "Converted", value: "converted" },
              ]}
            />
            <FilterInput
              label="From"
              type="date"
              value={filters.dateFrom}
              onChange={(value) => updateFilters({ dateFrom: value })}
            />
            <FilterInput
              label="To"
              type="date"
              value={filters.dateTo}
              onChange={(value) => updateFilters({ dateTo: value })}
            />
          </div>
        }
        pagination={
          serviceRequestMeta
            ? {
                ...serviceRequestMeta,
                windowKey: JSON.stringify({
                  search: filters.search,
                  status: filters.status,
                  dateFrom: filters.dateFrom,
                  dateTo: filters.dateTo,
                  limit: filters.limit,
                }),
                isFetchingPage: serviceRequestsQuery.isFetching,
                onPageChange: (page) => updateFilters({ page }),
                onLimitChange: (limit) => updateFilters({ limit }),
              }
            : undefined
        }
      />

      <ServiceRequestConversionDrawer
        serviceRequest={selectedServiceRequest}
        form={conversionForm}
        isSubmitting={convertMutation.isPending}
        errorMessage={
          convertMutation.isError ? convertMutation.error.message : ""
        }
        onClose={closeConversionDrawer}
        onFieldChange={updateConversionField}
        onSubmit={() => {
          if (selectedServiceRequest && conversionForm) {
            convertMutation.mutate({
              serviceRequestId: selectedServiceRequest.id,
              payload: conversionForm,
            });
          }
        }}
      />
    </ReportFrame>
  );
}

function CustomerActivityReportPage() {
  const adminReportQuery = useQuery({
    queryKey: ["admin-report"],
    queryFn: () => api.adminReport(),
  });
  const [activityFilters, setActivityFilters] = useState<ActivityFilters>({
    search: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
    limit: 10,
  });
  const activityPage = useMemo(() => {
    const rows =
      adminReportQuery.data?.customerActivity
        .filter(
          (item) =>
            !activityFilters.status || item.status === activityFilters.status,
        )
        .filter((item) =>
          isWithinDateRange(
            item.createdAt,
            activityFilters.dateFrom,
            activityFilters.dateTo,
          ),
        )
        .filter((item) =>
          includesSearch(
            [
              item.customerName,
              item.status,
              item.totalPrimaryNumbers,
              item.totalSecondaryNumbers,
              item.bundlesPurchased,
              item.totalSpendUgx,
            ],
            activityFilters.search.toLowerCase(),
          ),
        ) ?? [];

    return paginateRows(rows, activityFilters.page, activityFilters.limit);
  }, [activityFilters, adminReportQuery.data?.customerActivity]);
  const runActivityFallback = shouldRunAsyncSearchFallback(
    activityFilters.search,
    activityPage.meta.total,
    adminReportQuery.isSuccess,
  );
  const activityFallbackQuery = useQuery({
    queryKey: [
      "admin-report-search-fallback",
      "customer-activity",
      activityFilters,
    ],
    queryFn: () => api.adminReport(activityFilters),
    enabled: runActivityFallback,
  });
  const activityFallbackPage = useMemo(
    () =>
      paginateRows(
        activityFallbackQuery.data?.customerActivity ?? [],
        activityFilters.page,
        activityFilters.limit,
      ),
    [
      activityFallbackQuery.data?.customerActivity,
      activityFilters.limit,
      activityFilters.page,
    ],
  );
  const effectiveActivityPage = activityFallbackQuery.data
    ? activityFallbackPage
    : activityPage;

  function updateActivityFilters(nextFilters: Partial<ActivityFilters>) {
    setActivityFilters((current) => ({
      ...current,
      ...nextFilters,
      page: nextFilters.page ?? 1,
    }));
  }

  if (adminReportQuery.isError) {
    return <Panel>Customer activity report could not be loaded.</Panel>;
  }

  return (
    <ReportFrame
      title="Customer Activity Report"
      description="Customer lifecycle, activation status, primary and secondary number counts, bundle purchases, and spend."
    >
      <DataTable
        columns={activityColumns}
        rows={effectiveActivityPage.data}
        getRowKey={(item) => item.customerId}
        minWidth={860}
        isLoading={
          adminReportQuery.isLoading || activityFallbackQuery.isFetching
        }
        exportOptions={{
          title: "Customer Activity Report",
          filename: "customer-activity-report",
        }}
        filters={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FilterInput
              label="Search"
              value={activityFilters.search}
              onChange={(value) => updateActivityFilters({ search: value })}
            />
            <FilterSelect
              label="Status"
              value={activityFilters.status}
              onChange={(value) =>
                updateActivityFilters({
                  status: value as ActivityFilters["status"],
                })
              }
              options={[
                { label: "All statuses", value: "" },
                { label: "Active", value: "active" },
                { label: "Pending", value: "pending" },
                { label: "Deactivated", value: "deactivated" },
              ]}
            />
            <FilterInput
              label="From"
              type="date"
              value={activityFilters.dateFrom}
              onChange={(value) => updateActivityFilters({ dateFrom: value })}
            />
            <FilterInput
              label="To"
              type="date"
              value={activityFilters.dateTo}
              onChange={(value) => updateActivityFilters({ dateTo: value })}
            />
          </div>
        }
        pagination={{
          ...effectiveActivityPage.meta,
          windowKey: JSON.stringify({
            search: activityFilters.search,
            status: activityFilters.status,
            dateFrom: activityFilters.dateFrom,
            dateTo: activityFilters.dateTo,
            limit: activityFilters.limit,
          }),
          onPageChange: (page) => updateActivityFilters({ page }),
          onLimitChange: (limit) => updateActivityFilters({ limit }),
        }}
      />
    </ReportFrame>
  );
}

function BundlePurchasesReportPage() {
  const {
    customersQuery,
    customerReportQuery,
    selectedCustomer,
    setCustomerId,
  } = useSelectedCustomerReport();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<CustomerReportFilters>({
    search: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
    limit: 10,
  });
  const purchasePage = useMemo(() => {
    const rows =
      customerReportQuery.data?.bundlePurchaseHistory
        .filter(
          (transaction) =>
            !filters.status || transaction.status === filters.status,
        )
        .filter((transaction) =>
          isWithinDateRange(
            transaction.createdAt,
            filters.dateFrom,
            filters.dateTo,
          ),
        )
        .filter((transaction) =>
          includesSearch(
            [
              transaction.bundleName,
              transaction.primaryMsisdn,
              transaction.paymentMethod,
              transaction.status,
              transaction.amountUgx,
            ],
            filters.search.toLowerCase(),
          ),
        ) ?? [];

    return paginateRows(rows, filters.page, filters.limit);
  }, [customerReportQuery.data?.bundlePurchaseHistory, filters]);
  const runPurchaseFallback = shouldRunAsyncSearchFallback(
    filters.search,
    purchasePage.meta.total,
    customerReportQuery.isSuccess && Boolean(selectedCustomer?.id),
  );
  const purchaseFallbackQuery = useQuery({
    queryKey: [
      "customer-report-search-fallback",
      "bundle-purchases",
      selectedCustomer?.id,
      filters,
    ],
    queryFn: () => api.customerReport(selectedCustomer?.id ?? "", filters),
    enabled: runPurchaseFallback,
  });
  const purchaseFallbackPage = useMemo(
    () =>
      paginateRows(
        purchaseFallbackQuery.data?.bundlePurchaseHistory ?? [],
        filters.page,
        filters.limit,
      ),
    [
      filters.limit,
      filters.page,
      purchaseFallbackQuery.data?.bundlePurchaseHistory,
    ],
  );
  const effectivePurchasePage = purchaseFallbackQuery.data
    ? purchaseFallbackPage
    : purchasePage;
  const retryTransactionMutation = useMutation({
    mutationFn: retryTransactionPayment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
        queryClient.invalidateQueries({ queryKey: ["report-transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["customer-report"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
      ]);
    },
  });

  function updateFilters(nextFilters: Partial<CustomerReportFilters>) {
    setFilters((current) => ({
      ...current,
      ...nextFilters,
      page: nextFilters.page ?? 1,
    }));
  }
  const purchaseRowActions: Array<DataTableRowAction<Transaction>> = [
    {
      id: "check-primary-balance",
      label: "Check balance",
      icon: Activity,
      disabled: !selectedCustomer,
      onSelect: (transaction) => {
        if (selectedCustomer) {
          void showPrimaryBalance(
            selectedCustomer.id,
            transaction.primaryMsisdn,
          );
        }
      },
    },
    {
      id: "download-receipt",
      label: "Preview receipt",
      icon: ReceiptText,
      hidden: (transaction) => transaction.status !== "provisioned",
      onSelect: downloadTransactionReceipt,
    },
    {
      id: "retry-payment",
      label: "Retry payment",
      icon: RotateCcw,
      hidden: (transaction) => transaction.status !== "failed",
      disabled: retryTransactionMutation.isPending,
      onSelect: (transaction) => {
        retryTransactionMutation.mutate(transaction);
      },
    },
  ];

  return (
    <CustomerReportFrame
      title="Bundle Purchases Report"
      description="Customer bundle purchase history by date, primary MSISDN, payment method, and status."
      customers={customersQuery.data ?? []}
      selectedCustomer={selectedCustomer}
      onCustomerChange={setCustomerId}
      isLoading={customersQuery.isLoading}
      isError={customersQuery.isError || customerReportQuery.isError}
    >
      <DataTable
        columns={purchaseColumns}
        rows={effectivePurchasePage.data}
        getRowKey={(transaction) => transaction.id}
        minWidth={860}
        isLoading={
          customerReportQuery.isLoading || purchaseFallbackQuery.isFetching
        }
        emptyMessage="No purchases found for the selected filters."
        exportOptions={{
          title: "Bundle Purchases Report",
          filename: "bundle-purchases-report",
        }}
        rowActions={purchaseRowActions}
        filters={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FilterInput
              label="Search"
              value={filters.search}
              onChange={(value) => updateFilters({ search: value })}
            />
            <FilterSelect
              label="Status"
              value={filters.status}
              onChange={(value) => updateFilters({ status: value })}
              options={[
                { label: "All statuses", value: "" },
                { label: "Provisioned", value: "provisioned" },
                { label: "Pending", value: "pending" },
                { label: "Failed", value: "failed" },
              ]}
            />
            <FilterInput
              label="From"
              type="date"
              value={filters.dateFrom}
              onChange={(value) => updateFilters({ dateFrom: value })}
            />
            <FilterInput
              label="To"
              type="date"
              value={filters.dateTo}
              onChange={(value) => updateFilters({ dateTo: value })}
            />
          </div>
        }
        pagination={{
          ...effectivePurchasePage.meta,
          windowKey: JSON.stringify({
            customerId: selectedCustomer?.id,
            search: filters.search,
            status: filters.status,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            limit: filters.limit,
          }),
          onPageChange: (page) => updateFilters({ page }),
          onLimitChange: (limit) => updateFilters({ limit }),
        }}
      />
    </CustomerReportFrame>
  );
}

function SecondaryNumbersReportPage() {
  const {
    customersQuery,
    customerReportQuery,
    selectedCustomer,
    setCustomerId,
  } = useSelectedCustomerReport();
  const [filters, setFilters] = useState<CustomerReportFilters>({
    search: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
    limit: 10,
  });
  const secondaryPage = useMemo(() => {
    const rows =
      customerReportQuery.data?.secondaryNumbers
        .filter(
          (secondaryNumber) =>
            !filters.status || secondaryNumber.status === filters.status,
        )
        .filter((secondaryNumber) =>
          isWithinDateRange(
            secondaryNumber.addedAt,
            filters.dateFrom,
            filters.dateTo,
          ),
        )
        .filter((secondaryNumber) =>
          includesSearch(
            [
              secondaryNumber.msisdn,
              secondaryNumber.primaryMsisdn,
              secondaryNumber.apnId,
              secondaryNumber.status,
            ],
            filters.search.toLowerCase(),
          ),
        ) ?? [];

    return paginateRows(rows, filters.page, filters.limit);
  }, [customerReportQuery.data?.secondaryNumbers, filters]);
  const runSecondaryFallback = shouldRunAsyncSearchFallback(
    filters.search,
    secondaryPage.meta.total,
    customerReportQuery.isSuccess && Boolean(selectedCustomer?.id),
  );
  const secondaryFallbackQuery = useQuery({
    queryKey: [
      "customer-report-search-fallback",
      "secondary-numbers",
      selectedCustomer?.id,
      filters,
    ],
    queryFn: () => api.customerReport(selectedCustomer?.id ?? "", filters),
    enabled: runSecondaryFallback,
  });
  const secondaryFallbackPage = useMemo(
    () =>
      paginateRows(
        secondaryFallbackQuery.data?.secondaryNumbers ?? [],
        filters.page,
        filters.limit,
      ),
    [
      filters.limit,
      filters.page,
      secondaryFallbackQuery.data?.secondaryNumbers,
    ],
  );
  const effectiveSecondaryPage = secondaryFallbackQuery.data
    ? secondaryFallbackPage
    : secondaryPage;

  function updateFilters(nextFilters: Partial<CustomerReportFilters>) {
    setFilters((current) => ({
      ...current,
      ...nextFilters,
      page: nextFilters.page ?? 1,
    }));
  }

  return (
    <CustomerReportFrame
      title="Secondary Numbers Report"
      description="Provisioned secondary MSISDNs by customer, primary number, APN, status, and added date."
      customers={customersQuery.data ?? []}
      selectedCustomer={selectedCustomer}
      onCustomerChange={setCustomerId}
      isLoading={customersQuery.isLoading}
      isError={customersQuery.isError || customerReportQuery.isError}
    >
      <DataTable
        columns={secondaryColumns}
        rows={effectiveSecondaryPage.data}
        getRowKey={(secondaryNumber) => secondaryNumber.id}
        minWidth={760}
        isLoading={
          customerReportQuery.isLoading || secondaryFallbackQuery.isFetching
        }
        emptyMessage="No secondary numbers found for the selected filters."
        exportOptions={{
          title: "Secondary Numbers Report",
          filename: "secondary-numbers-report",
        }}
        rowActions={secondaryRowActions}
        filters={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FilterInput
              label="Search"
              value={filters.search}
              onChange={(value) => updateFilters({ search: value })}
            />
            <FilterSelect
              label="Status"
              value={filters.status}
              onChange={(value) => updateFilters({ status: value })}
              options={[
                { label: "All statuses", value: "" },
                { label: "Active", value: "active" },
                { label: "Removed", value: "removed" },
              ]}
            />
            <FilterInput
              label="From"
              type="date"
              value={filters.dateFrom}
              onChange={(value) => updateFilters({ dateFrom: value })}
            />
            <FilterInput
              label="To"
              type="date"
              value={filters.dateTo}
              onChange={(value) => updateFilters({ dateTo: value })}
            />
          </div>
        }
        pagination={{
          ...effectiveSecondaryPage.meta,
          windowKey: JSON.stringify({
            customerId: selectedCustomer?.id,
            search: filters.search,
            status: filters.status,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            limit: filters.limit,
          }),
          onPageChange: (page) => updateFilters({ page }),
          onLimitChange: (limit) => updateFilters({ limit }),
        }}
      />
    </CustomerReportFrame>
  );
}

function BalancesReportPage() {
  const {
    customersQuery,
    customerReportQuery,
    selectedCustomer,
    setCustomerId,
  } = useSelectedCustomerReport();
  const [filters, setFilters] = useState<CustomerReportFilters>({
    search: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
    limit: 10,
  });
  const balancePage = useMemo(() => {
    const rows =
      customerReportQuery.data?.balances
        .filter((balance) =>
          isWithinDateRange(balance.expiryAt, filters.dateFrom, filters.dateTo),
        )
        .filter((balance) =>
          includesSearch(
            [
              balance.primaryMsisdn,
              balance.bundleName,
              balance.remainingVolumeGb,
              balance.totalVolumeGb,
            ],
            filters.search.toLowerCase(),
          ),
        ) ?? [];

    return paginateRows(rows, filters.page, filters.limit);
  }, [customerReportQuery.data?.balances, filters]);
  const runBalanceFallback = shouldRunAsyncSearchFallback(
    filters.search,
    balancePage.meta.total,
    customerReportQuery.isSuccess && Boolean(selectedCustomer?.id),
  );
  const balanceFallbackQuery = useQuery({
    queryKey: [
      "customer-report-search-fallback",
      "balances",
      selectedCustomer?.id,
      filters,
    ],
    queryFn: () => api.customerReport(selectedCustomer?.id ?? "", filters),
    enabled: runBalanceFallback,
  });
  const balanceFallbackPage = useMemo(
    () =>
      paginateRows(
        balanceFallbackQuery.data?.balances ?? [],
        filters.page,
        filters.limit,
      ),
    [balanceFallbackQuery.data?.balances, filters.limit, filters.page],
  );
  const effectiveBalancePage = balanceFallbackQuery.data
    ? balanceFallbackPage
    : balancePage;

  function updateFilters(nextFilters: Partial<CustomerReportFilters>) {
    setFilters((current) => ({
      ...current,
      ...nextFilters,
      page: nextFilters.page ?? 1,
    }));
  }

  return (
    <CustomerReportFrame
      title="Balances Report"
      description="Primary MSISDN bundle balance, remaining volume, top-up count, and expiry date."
      customers={customersQuery.data ?? []}
      selectedCustomer={selectedCustomer}
      onCustomerChange={setCustomerId}
      isLoading={customersQuery.isLoading}
      isError={customersQuery.isError || customerReportQuery.isError}
    >
      <DataTable
        columns={balanceColumns}
        rows={effectiveBalancePage.data}
        getRowKey={(balance) => balance.primaryMsisdn}
        minWidth={760}
        isLoading={
          customerReportQuery.isLoading || balanceFallbackQuery.isFetching
        }
        emptyMessage="No balances found for the selected filters."
        exportOptions={{
          title: "Balances Report",
          filename: "balances-report",
        }}
        filters={
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <FilterInput
              label="Search"
              value={filters.search}
              onChange={(value) => updateFilters({ search: value })}
            />
            <FilterInput
              label="Expiry from"
              type="date"
              value={filters.dateFrom}
              onChange={(value) => updateFilters({ dateFrom: value })}
            />
            <FilterInput
              label="Expiry to"
              type="date"
              value={filters.dateTo}
              onChange={(value) => updateFilters({ dateTo: value })}
            />
          </div>
        }
        pagination={{
          ...effectiveBalancePage.meta,
          windowKey: JSON.stringify({
            customerId: selectedCustomer?.id,
            search: filters.search,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            limit: filters.limit,
          }),
          onPageChange: (page) => updateFilters({ page }),
          onLimitChange: (limit) => updateFilters({ limit }),
        }}
      />
    </CustomerReportFrame>
  );
}

function useSelectedCustomerReport() {
  const customersQuery = useQuery({
    queryKey: ["customers"],
    queryFn: api.customers,
  });
  const [customerId, setCustomerId] = useState("");
  const selectedCustomer = useMemo(() => {
    const effectiveCustomerId = customerId || customersQuery.data?.[0]?.id;
    return customersQuery.data?.find(
      (customer) => customer.id === effectiveCustomerId,
    );
  }, [customerId, customersQuery.data]);
  const customerReportQuery = useQuery({
    queryKey: ["customer-report", selectedCustomer?.id],
    queryFn: () => api.customerReport(selectedCustomer?.id ?? ""),
    enabled: Boolean(selectedCustomer?.id),
  });

  return {
    customersQuery,
    selectedCustomer,
    setCustomerId,
    customerReportQuery,
  };
}

function ServiceRequestConversionDrawer({
  serviceRequest,
  form,
  isSubmitting,
  errorMessage,
  onClose,
  onFieldChange,
  onSubmit,
}: {
  serviceRequest: ServiceRequest | null;
  form: CustomerRegistrationRequest | null;
  isSubmitting: boolean;
  errorMessage: string;
  onClose: () => void;
  onFieldChange: <Key extends keyof CustomerRegistrationRequest>(
    key: Key,
    value: CustomerRegistrationRequest[Key],
  ) => void;
  onSubmit: () => void;
}) {
  if (!serviceRequest || !form) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--console-header-height,4rem)] z-50">
      <button
        type="button"
        aria-label="Close service request conversion drawer"
        className="absolute inset-0 bg-ink/35 dark:bg-black/60"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-request-conversion-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl sm:w-[min(92vw,48rem)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-4">
          <div>
            <h2
              id="service-request-conversion-title"
              className="text-lg font-semibold"
            >
              Convert Service Request
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Create a customer account after confirming business registration,
              APN mapping, and primary MSISDN.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--panel-strong)] hover:text-[var(--foreground)]"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-5 grid gap-3 rounded-md border border-border/50 bg-background p-3 sm:grid-cols-2">
            <DetailItem label="Business" value={serviceRequest.businessName} />
            <DetailItem
              label="Preferred package"
              value={serviceRequest.preferredPackageName ?? "Not selected"}
            />
            <DetailItem
              label="Contact person"
              value={serviceRequest.contactPerson}
            />
            <DetailItem
              label="Contact email"
              value={serviceRequest.contactEmail}
            />
            <DetailItem
              label="Contact phone"
              value={serviceRequest.contactPhone}
            />
            <DetailItem
              label="Status"
              value={sentenceCase(serviceRequest.status)}
            />
            {serviceRequest.message && (
              <div className="sm:col-span-2">
                <DetailItem label="Message" value={serviceRequest.message} />
              </div>
            )}
          </div>

          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
          >
            <TextField
              label="Business name"
              value={form.businessName}
              required
              onValueChange={(value) => onFieldChange("businessName", value)}
            />
            <TextField
              label="TIN (optional)"
              value={form.tin ?? ""}
              onValueChange={(value) => onFieldChange("tin", value)}
            />
            <TextField
              label="Business email"
              type="email"
              value={form.businessEmail}
              required
              onValueChange={(value) => onFieldChange("businessEmail", value)}
            />
            <PhoneField
              label="Business phone"
              value={form.businessPhone}
              required
              onValueChange={(value) => onFieldChange("businessPhone", value)}
            />
            <TextField
              label="Contact person"
              value={form.contactPerson}
              required
              onValueChange={(value) => onFieldChange("contactPerson", value)}
            />
            <TextField
              label="Contact email"
              type="email"
              value={form.contactEmail}
              required
              onValueChange={(value) => onFieldChange("contactEmail", value)}
            />
            <PhoneField
              label="Contact phone"
              value={form.contactPhone}
              required
              onValueChange={(value) => onFieldChange("contactPhone", value)}
            />
            <TextField
              label="APN name"
              value={form.apnName}
              required
              onValueChange={(value) => onFieldChange("apnName", value)}
            />
            <TextField
              label="APN ID"
              value={form.apnId}
              required
              onValueChange={(value) => onFieldChange("apnId", value)}
            />
            <PhoneField
              label="Primary MSISDN (optional)"
              value={form.primaryMsisdn ?? ""}
              onValueChange={(value) => onFieldChange("primaryMsisdn", value)}
            />

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] pt-4 sm:col-span-2">
              {errorMessage && (
                <p className="mr-auto text-sm font-medium text-coral">
                  {errorMessage}
                </p>
              )}
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--panel-strong)]"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-black shadow-sm hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4" />
                {isSubmitting ? "Converting..." : "Convert to Customer"}
              </button>
            </div>
          </form>
        </div>
      </aside>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function ReportFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
      </div>
      <Panel>{children}</Panel>
    </div>
  );
}

function CustomerReportFrame({
  title,
  description,
  customers,
  selectedCustomer,
  onCustomerChange,
  isLoading,
  isError,
  children,
}: {
  title: string;
  description: string;
  customers: Customer[];
  selectedCustomer?: Customer;
  onCustomerChange: (customerId: string) => void;
  isLoading: boolean;
  isError: boolean;
  children: ReactNode;
}) {
  if (isError) {
    return <Panel>{title} could not be loaded.</Panel>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        </div>
        <SelectField
          label="Customer"
          value={selectedCustomer?.id ?? ""}
          onValueChange={onCustomerChange}
          options={customers.map((customer) => ({
            label: customer.businessName,
            value: customer.id,
          }))}
        />
      </div>
      <Panel>{isLoading ? "Loading customer report..." : children}</Panel>
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
    <TextField
      label={label}
      type={type}
      value={value}
      onValueChange={onChange}
    />
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
    <SelectField
      label={label}
      value={value}
      onValueChange={onChange}
      options={options}
    />
  );
}
