"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CalendarClock,
  Check,
  Copy,
  Database,
  Gauge,
  MoreHorizontal,
  PackageCheck,
  PackagePlus,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PhoneField,
  SelectField,
  TextareaField,
  TextField,
} from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentCheckoutDialog } from "@/features/customer/payment-checkout-dialog";
import { api } from "@/lib/api-client";
import { useAuthSessionSnapshot } from "@/lib/auth-session";
import { cn } from "@/lib/cn";
import { formatDateTime, formatUgx, sentenceCase } from "@/lib/format";
import { showPrimaryBalance, showSecondaryUsage } from "@/lib/table-actions";
import {
  isUgandaPhoneNumber,
  normalizeUgandaPhoneInput,
  UGANDA_PHONE_COUNTRY_CODE,
} from "@/lib/uganda-phone";
import { useUiStore } from "@/store/ui-store";
import type { Customer, ListQuery, SecondaryNumber } from "@/types/domain";

const customerDashboardCardThemes = {
  yellow: {
    card: "border-yellow-300/70 bg-yellow-100 text-yellow-950 shadow-yellow-100/60 dark:border-yellow-400/35 dark:bg-yellow-950/45 dark:text-yellow-50",
    label: "text-yellow-950/70 dark:text-yellow-100/75",
    detail: "text-yellow-950/75 dark:text-yellow-100/80",
    icon: "bg-yellow-300/85 text-yellow-950 dark:bg-yellow-400/20 dark:text-yellow-100",
  },
  green: {
    card: "border-emerald-300/70 bg-emerald-100 text-emerald-950 shadow-emerald-100/60 dark:border-emerald-400/30 dark:bg-emerald-950/45 dark:text-emerald-50",
    label: "text-emerald-950/70 dark:text-emerald-100/75",
    detail: "text-emerald-950/75 dark:text-emerald-100/80",
    icon: "bg-emerald-300/80 text-emerald-950 dark:bg-emerald-400/20 dark:text-emerald-100",
  },
  blue: {
    card: "border-sky-300/70 bg-sky-100 text-sky-950 shadow-sky-100/60 dark:border-sky-400/30 dark:bg-sky-950/45 dark:text-sky-50",
    label: "text-sky-950/70 dark:text-sky-100/75",
    detail: "text-sky-950/75 dark:text-sky-100/80",
    icon: "bg-sky-300/80 text-sky-950 dark:bg-sky-400/20 dark:text-sky-100",
  },
  red: {
    card: "border-rose-300/70 bg-rose-100 text-rose-950 shadow-rose-100/60 dark:border-rose-400/30 dark:bg-rose-950/45 dark:text-rose-50",
    label: "text-rose-950/70 dark:text-rose-100/75",
    detail: "text-rose-950/75 dark:text-rose-100/80",
    icon: "bg-rose-300/80 text-rose-950 dark:bg-rose-400/20 dark:text-rose-100",
  },
};

function parseBulkMsisdns(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((item) => normalizeUgandaPhoneInput(item.trim()))
        .filter((item) => isUgandaPhoneNumber(item)),
    ),
  ];
}

function parseProvisioningCount(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(12, Math.max(1, parsed));
}

export function CustomerPortal() {
  const authSession = useAuthSessionSnapshot();
  const customersQuery = useQuery({
    queryKey: ["customers"],
    queryFn: api.customers,
  });
  const bundlesQuery = useQuery({
    queryKey: ["bundles"],
    queryFn: api.bundles,
  });
  const selectedCustomerId = useUiStore((state) => state.selectedCustomerId);
  const selectedPrimaryMsisdn = useUiStore(
    (state) => state.selectedPrimaryMsisdn,
  );
  const setSelectedCustomerContext = useUiStore(
    (state) => state.setSelectedCustomerContext,
  );
  const setSelectedPrimaryMsisdn = useUiStore(
    (state) => state.setSelectedPrimaryMsisdn,
  );
  const isCustomerScoped = authSession?.user.role === "customer";
  const scopedCustomerId = isCustomerScoped
    ? (authSession?.user.customerId ?? "")
    : "";
  const visibleCustomers = useMemo(() => {
    if (!customersQuery.data) {
      return [];
    }

    if (isCustomerScoped && scopedCustomerId) {
      return customersQuery.data.filter(
        (customer) => customer.id === scopedCustomerId,
      );
    }

    return customersQuery.data;
  }, [customersQuery.data, isCustomerScoped, scopedCustomerId]);
  const selectedCustomer = useMemo(() => {
    const effectiveCustomerId = isCustomerScoped
      ? scopedCustomerId
      : selectedCustomerId || visibleCustomers[0]?.id;
    return visibleCustomers.find(
      (customer) => customer.id === effectiveCustomerId,
    );
  }, [
    isCustomerScoped,
    scopedCustomerId,
    selectedCustomerId,
    visibleCustomers,
  ]);
  const effectivePrimaryMsisdn =
    selectedCustomer?.primaryMsisdns.includes(selectedPrimaryMsisdn) &&
    selectedPrimaryMsisdn
      ? selectedPrimaryMsisdn
      : (selectedCustomer?.primaryMsisdns[0] ?? "");

  useEffect(() => {
    if (!selectedCustomer) {
      return;
    }

    if (
      selectedCustomer.id !== selectedCustomerId ||
      effectivePrimaryMsisdn !== selectedPrimaryMsisdn
    ) {
      setSelectedCustomerContext(selectedCustomer.id, effectivePrimaryMsisdn);
    }
  }, [
    effectivePrimaryMsisdn,
    selectedCustomer,
    selectedCustomerId,
    selectedPrimaryMsisdn,
    setSelectedCustomerContext,
  ]);

  if (customersQuery.isLoading || bundlesQuery.isLoading) {
    return <Panel>Loading customer portal...</Panel>;
  }

  if (
    customersQuery.isError ||
    bundlesQuery.isError ||
    !customersQuery.data ||
    !bundlesQuery.data
  ) {
    return <Panel>Customer portal could not be loaded.</Panel>;
  }

  if (visibleCustomers.length === 0) {
    return <Panel>No customer account is assigned to this session.</Panel>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Customer Portal</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {isCustomerScoped
              ? "Purchase bundles, check balance, and manage secondary numbers on your account."
              : "Purchase bundles, check balance, and manage secondary numbers."}
          </p>
        </div>
        <div
          className={cn(
            "grid gap-2",
            isCustomerScoped ? "sm:grid-cols-1" : "sm:grid-cols-2",
          )}
        >
          {!isCustomerScoped && (
            <SelectField
              label="Customer"
              value={selectedCustomer?.id ?? ""}
              onValueChange={(value) => {
                const nextCustomer = visibleCustomers.find(
                  (customer) => customer.id === value,
                );
                setSelectedCustomerContext(
                  value,
                  nextCustomer?.primaryMsisdns[0] ?? "",
                );
              }}
              options={visibleCustomers.map((customer) => ({
                label: customer.businessName,
                value: customer.id,
              }))}
            />
          )}
          <SelectField
            label="Primary MSISDN"
            value={effectivePrimaryMsisdn}
            onValueChange={setSelectedPrimaryMsisdn}
            options={
              selectedCustomer?.primaryMsisdns.map((msisdn) => ({
                label: msisdn,
                value: msisdn,
              })) ?? []
            }
          />
        </div>
      </div>

      {selectedCustomer && effectivePrimaryMsisdn && (
        <>
          <CustomerAccountsList
            customer={selectedCustomer}
            selectedPrimaryMsisdn={effectivePrimaryMsisdn}
            onSelectPrimary={(primaryMsisdn) => {
              setSelectedCustomerContext(selectedCustomer.id, primaryMsisdn);
            }}
          />
          <CustomerBalance
            customer={selectedCustomer}
            primaryMsisdn={effectivePrimaryMsisdn}
          />
          <PurchaseBundle
            customer={selectedCustomer}
            primaryMsisdn={effectivePrimaryMsisdn}
            bundles={bundlesQuery.data}
          />
          <SecondaryNumbers
            customer={selectedCustomer}
            primaryMsisdn={effectivePrimaryMsisdn}
          />
        </>
      )}
    </div>
  );
}

function CustomerAccountsList({
  customer,
  selectedPrimaryMsisdn,
  onSelectPrimary,
}: {
  customer: Customer;
  selectedPrimaryMsisdn: string;
  onSelectPrimary: (primaryMsisdn: string) => void;
}) {
  const queryClient = useQueryClient();
  const [copiedMsisdn, setCopiedMsisdn] = useState("");
  const [drawerPrimaryMsisdn, setDrawerPrimaryMsisdn] = useState("");
  const [msisdn, setMsisdn] = useState(UGANDA_PHONE_COUNTRY_CODE);
  const [bulkMsisdns, setBulkMsisdns] = useState("");
  const [singleValidationError, setSingleValidationError] = useState("");
  const [bulkValidationError, setBulkValidationError] = useState("");

  const invalidate = async (primaryMsisdn: string) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["secondary-numbers", customer.id, primaryMsisdn],
      }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["customers-table"] }),
      queryClient.invalidateQueries({
        queryKey: ["customer-report", customer.id],
      }),
      queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
    ]);
  };

  const addMutation = useMutation({
    mutationFn: ({
      primaryMsisdn,
      secondaryMsisdn,
    }: {
      primaryMsisdn: string;
      secondaryMsisdn: string;
    }) =>
      api.addSecondaryNumber(customer.id, primaryMsisdn, {
        msisdn: secondaryMsisdn,
      }),
    onSuccess: async (_result, variables) => {
      setMsisdn(UGANDA_PHONE_COUNTRY_CODE);
      setDrawerPrimaryMsisdn("");
      await invalidate(variables.primaryMsisdn);
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({
      primaryMsisdn,
      msisdns,
    }: {
      primaryMsisdn: string;
      msisdns: string[];
    }) =>
      api.addBulkSecondaryNumbers(customer.id, primaryMsisdn, {
        msisdns,
      }),
    onSuccess: async (_result, variables) => {
      setBulkMsisdns("");
      await invalidate(variables.primaryMsisdn);
    },
  });

  function openAddDrawer(primaryMsisdn: string) {
    onSelectPrimary(primaryMsisdn);
    addMutation.reset();
    bulkMutation.reset();
    setSingleValidationError("");
    setBulkValidationError("");
    setMsisdn(UGANDA_PHONE_COUNTRY_CODE);
    setBulkMsisdns("");
    setDrawerPrimaryMsisdn(primaryMsisdn);
  }

  function closeAddDrawer() {
    if (addMutation.isPending || bulkMutation.isPending) {
      return;
    }

    addMutation.reset();
    bulkMutation.reset();
    setSingleValidationError("");
    setBulkValidationError("");
    setDrawerPrimaryMsisdn("");
  }

  function submitSingleSecondary(primaryMsisdn: string) {
    const normalizedMsisdn = normalizeUgandaPhoneInput(msisdn);

    if (!isUgandaPhoneNumber(normalizedMsisdn)) {
      setSingleValidationError("Enter a valid MTN Uganda secondary number.");
      return;
    }

    setSingleValidationError("");
    addMutation.mutate({ primaryMsisdn, secondaryMsisdn: normalizedMsisdn });
  }

  function submitBulkSecondary(primaryMsisdn: string) {
    const msisdns = parseBulkMsisdns(bulkMsisdns);

    if (msisdns.length === 0) {
      setBulkValidationError("Paste at least one valid MTN Uganda number.");
      return;
    }

    setBulkValidationError("");
    bulkMutation.mutate({ primaryMsisdn, msisdns });
  }

  async function copyPrimaryMsisdn(primaryMsisdn: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(primaryMsisdn);
    }

    setCopiedMsisdn(primaryMsisdn);
    window.setTimeout(() => {
      setCopiedMsisdn((current) => (current === primaryMsisdn ? "" : current));
    }, 1600);
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Customer Accounts</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Select a primary account number, add secondary numbers, or check
            bundle balance.
          </p>
        </div>
        <StatusBadge
          label={`${customer.primaryMsisdns.length} primary`}
          tone="yellow"
        />
      </div>

      <div className="mt-4 grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
        {customer.primaryMsisdns.length > 0 ? (
          customer.primaryMsisdns.map((primaryMsisdn, index) => {
            const copied = copiedMsisdn === primaryMsisdn;
            const selected = primaryMsisdn === selectedPrimaryMsisdn;

            return (
              <div
                key={primaryMsisdn}
                className={cn(
                  "group flex min-h-14 min-w-0 items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-left text-sm transition-colors focus-within:ring-2 focus-within:ring-ring/40",
                  selected
                    ? "border-primary/70 bg-primary/10"
                    : "surface-table-hover",
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left focus-visible:outline-none"
                  aria-label={`Select primary MSISDN ${primaryMsisdn}`}
                  onClick={() => {
                    onSelectPrimary(primaryMsisdn);
                    void copyPrimaryMsisdn(primaryMsisdn);
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">
                      {primaryMsisdn}
                    </span>
                    {selected && <StatusBadge label="Selected" tone="green" />}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    Primary {index + 1}
                  </span>
                </button>
                {copied ? (
                  <Check className="shrink-0 text-forest" />
                ) : (
                  <Copy className="shrink-0 text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
                )}
                <CustomerPrimaryMsisdnActions
                  msisdn={primaryMsisdn}
                  onAddSecondary={() => openAddDrawer(primaryMsisdn)}
                  onCheckBalance={() => {
                    onSelectPrimary(primaryMsisdn);
                    void showPrimaryBalance(customer.id, primaryMsisdn);
                  }}
                />
              </div>
            );
          })
        ) : (
          <p className="rounded-md border border-border/60 p-3 text-sm text-[var(--muted)]">
            No primary MSISDNs are attached to this customer account.
          </p>
        )}
      </div>

      <SecondaryNumberDrawer
        open={Boolean(drawerPrimaryMsisdn)}
        customerName={customer.businessName}
        primaryMsisdn={drawerPrimaryMsisdn}
        msisdn={msisdn}
        onMsisdnChange={(value) => {
          setSingleValidationError("");
          setMsisdn(value);
        }}
        bulkMsisdns={bulkMsisdns}
        onBulkMsisdnsChange={(value) => {
          setBulkValidationError("");
          setBulkMsisdns(value);
        }}
        onClose={closeAddDrawer}
        onSingleSubmit={() => {
          if (drawerPrimaryMsisdn) {
            submitSingleSecondary(drawerPrimaryMsisdn);
          }
        }}
        onBulkSubmit={() => {
          if (drawerPrimaryMsisdn) {
            submitBulkSecondary(drawerPrimaryMsisdn);
          }
        }}
        singlePending={addMutation.isPending}
        bulkPending={bulkMutation.isPending}
        singleErrorMessage={
          singleValidationError ||
          (addMutation.isError ? addMutation.error.message : "")
        }
        bulkErrorMessage={
          bulkValidationError ||
          (bulkMutation.isError ? bulkMutation.error.message : "")
        }
        bulkSuccessMessage={
          bulkMutation.isSuccess
            ? `Added ${bulkMutation.data.added.length}; rejected ${bulkMutation.data.rejected.length}.`
            : ""
        }
      />
    </Panel>
  );
}

function CustomerPrimaryMsisdnActions({
  msisdn,
  onAddSecondary,
  onCheckBalance,
}: {
  msisdn: string;
  onAddSecondary: () => void;
  onCheckBalance: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Open actions for ${msisdn}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Primary actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onAddSecondary}>
            <Plus className="h-4 w-4" />
            Add secondary number
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onCheckBalance}>
            <Activity className="h-4 w-4" />
            Check balance
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CustomerBalance({
  customer,
  primaryMsisdn,
}: {
  customer: Customer;
  primaryMsisdn: string;
}) {
  const balanceQuery = useQuery({
    queryKey: ["balance", customer.id, primaryMsisdn],
    queryFn: () => api.balance(customer.id, primaryMsisdn),
  });

  if (balanceQuery.isLoading) {
    return <Panel>Checking balance...</Panel>;
  }

  if (balanceQuery.isError || !balanceQuery.data) {
    return <Panel>Balance could not be loaded.</Panel>;
  }

  const balance = balanceQuery.data;
  const usagePercent =
    balance.totalVolumeGb > 0
      ? Math.round(
          ((balance.totalVolumeGb - balance.remainingVolumeGb) /
            balance.totalVolumeGb) *
            100,
        )
      : 0;
  const usedVolumeGb = Math.max(
    balance.totalVolumeGb - balance.remainingVolumeGb,
    0,
  );
  const dashboardCards = [
    {
      label: "Bundle",
      value: balance.bundleName,
      detail: `${balance.totalVolumeGb.toLocaleString("en-US")} GB total allocation`,
      icon: PackageCheck,
      tone: "yellow",
      valueClassName: "text-xl",
    },
    {
      label: "Remaining",
      value: `${balance.remainingVolumeGb.toLocaleString("en-US")} GB`,
      detail: "Available for active secondary numbers",
      icon: Database,
      tone: "green",
      valueClassName: "text-2xl",
    },
    {
      label: "Used",
      value: `${usagePercent}%`,
      detail: `${usedVolumeGb.toLocaleString("en-US")} GB consumed`,
      icon: Gauge,
      tone: "blue",
      valueClassName: "text-2xl",
    },
    {
      label: "Expiry",
      value: formatDateTime(balance.expiryAt),
      detail: `${balance.autoTopupRemaining} auto top-ups remaining`,
      icon: CalendarClock,
      tone: "red",
      valueClassName: "text-lg",
    },
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {dashboardCards.map((card) => {
        const theme = customerDashboardCardThemes[card.tone];
        const Icon = card.icon;

        return (
          <Panel
            key={card.label}
            className={cn("min-h-36 border shadow-sm", theme.card)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", theme.label)}>
                  {card.label}
                </p>
                <p
                  className={cn(
                    "mt-2 break-words font-semibold leading-tight",
                    card.valueClassName,
                  )}
                >
                  {card.value}
                </p>
              </div>
              <div
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-md",
                  theme.icon,
                )}
              >
                <Icon />
              </div>
            </div>
            <p className={cn("mt-4 text-sm font-medium", theme.detail)}>
              {card.detail}
            </p>
          </Panel>
        );
      })}
    </div>
  );
}

function PurchaseBundle({
  customer,
  primaryMsisdn,
  bundles,
}: {
  customer: Customer;
  primaryMsisdn: string;
  bundles: Array<{
    id: string;
    name: string;
    priceUgx: number;
    serviceCode: string;
  }>;
}) {
  const queryClient = useQueryClient();
  const [bundleId, setBundleId] = useState(bundles[0]?.id ?? "");
  const [provisioningCount, setProvisioningCount] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const selectedBundle =
    bundles.find((bundle) => bundle.id === bundleId) ?? bundles[0];
  const totalAmount = (selectedBundle?.priceUgx ?? 0) * provisioningCount;

  async function invalidateAfterPayment() {
    setPaymentCompleted(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["overview"] }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["customers-table"] }),
      queryClient.invalidateQueries({
        queryKey: ["balance", customer.id, primaryMsisdn],
      }),
      queryClient.invalidateQueries({ queryKey: ["admin-report"] }),
      queryClient.invalidateQueries({ queryKey: ["report-transactions"] }),
      queryClient.invalidateQueries({
        queryKey: ["report-transactions-infinite"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["customer-report", customer.id],
      }),
      queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
    ]);
  }

  if (bundles.length === 0) {
    return (
      <Panel>
        <h3 className="font-semibold">Buy Bundle</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          No visible active packages are currently available for purchase.
        </p>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Buy Bundle</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Supports single purchase and repeat top-up count.
          </p>
        </div>
        {paymentCompleted && <StatusBadge label="Provisioned" tone="green" />}
      </div>

      <form
        className="mt-4 grid gap-4 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!selectedBundle) return;
          setCheckoutOpen(true);
        }}
      >
        <SelectField
          label="Bundle"
          value={selectedBundle?.id ?? ""}
          onValueChange={setBundleId}
          options={bundles.map((bundle) => ({
            label: `${bundle.name} - ${bundle.serviceCode}`,
            value: bundle.id,
          }))}
        />
        <TextField
          label="Count"
          min={1}
          max={12}
          type="number"
          value={String(provisioningCount)}
          onValueChange={(value) =>
            setProvisioningCount(parseProvisioningCount(value))
          }
        />
        <div className="flex items-end">
          <Button type="submit" variant="primary" disabled={!selectedBundle}>
            <PackagePlus className="h-4 w-4" />
            Checkout {formatUgx(totalAmount)}
          </Button>
        </div>
      </form>

      {selectedBundle && (
        <PaymentCheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          customer={customer}
          primaryMsisdn={primaryMsisdn}
          bundle={selectedBundle}
          provisioningCount={provisioningCount}
          onPaymentComplete={invalidateAfterPayment}
        />
      )}
    </Panel>
  );
}

function SecondaryNumbers({
  customer,
  primaryMsisdn,
}: {
  customer: Customer;
  primaryMsisdn: string;
}) {
  const queryClient = useQueryClient();
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [msisdn, setMsisdn] = useState(UGANDA_PHONE_COUNTRY_CODE);
  const [bulkMsisdns, setBulkMsisdns] = useState("");
  const [singleValidationError, setSingleValidationError] = useState("");
  const [bulkValidationError, setBulkValidationError] = useState("");
  const [secondaryFilters, setSecondaryFilters] = useState<ListQuery>({
    page: 1,
    limit: 10,
    search: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });
  const secondaryQuery = useQuery({
    queryKey: [
      "secondary-numbers",
      customer.id,
      primaryMsisdn,
      secondaryFilters,
    ],
    queryFn: () =>
      api.secondaryNumbersPage(customer.id, primaryMsisdn, secondaryFilters),
    placeholderData: (previousData) => previousData,
  });
  function updateSecondaryFilters(nextFilters: Partial<ListQuery>) {
    setSecondaryFilters((current) => ({
      ...current,
      ...nextFilters,
      page: nextFilters.page ?? 1,
    }));
  }
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["secondary-numbers", customer.id, primaryMsisdn],
      }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["customers-table"] }),
      queryClient.invalidateQueries({
        queryKey: ["customer-report", customer.id],
      }),
      queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
    ]);
  };
  const addMutation = useMutation({
    mutationFn: (secondaryMsisdn: string) =>
      api.addSecondaryNumber(customer.id, primaryMsisdn, {
        msisdn: secondaryMsisdn,
      }),
    onSuccess: async () => {
      setMsisdn(UGANDA_PHONE_COUNTRY_CODE);
      setAddDrawerOpen(false);
      await invalidate();
    },
  });
  const bulkMutation = useMutation({
    mutationFn: (msisdns: string[]) =>
      api.addBulkSecondaryNumbers(customer.id, primaryMsisdn, {
        msisdns,
      }),
    onSuccess: async () => {
      setBulkMsisdns("");
      await invalidate();
    },
  });
  const removeMutation = useMutation({
    mutationFn: (secondaryMsisdn: string) =>
      api.removeSecondaryNumber(customer.id, primaryMsisdn, secondaryMsisdn),
    onSuccess: invalidate,
  });
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
      id: "apnId",
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
          tone="green"
        />
      ),
    },
  ];
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
    {
      id: "remove-secondary",
      label: "Remove secondary",
      icon: Trash2,
      variant: "destructive",
      disabled: removeMutation.isPending,
      onSelect: (secondaryNumber) =>
        removeMutation.mutate(secondaryNumber.msisdn),
    },
  ];
  function openAddDrawer() {
    addMutation.reset();
    bulkMutation.reset();
    setSingleValidationError("");
    setBulkValidationError("");
    setMsisdn(UGANDA_PHONE_COUNTRY_CODE);
    setBulkMsisdns("");
    setAddDrawerOpen(true);
  }

  function closeAddDrawer() {
    if (addMutation.isPending || bulkMutation.isPending) {
      return;
    }

    addMutation.reset();
    bulkMutation.reset();
    setSingleValidationError("");
    setBulkValidationError("");
    setAddDrawerOpen(false);
  }

  function submitSingleSecondary() {
    const normalizedMsisdn = normalizeUgandaPhoneInput(msisdn);

    if (!isUgandaPhoneNumber(normalizedMsisdn)) {
      setSingleValidationError("Enter a valid MTN Uganda secondary number.");
      return;
    }

    setSingleValidationError("");
    addMutation.mutate(normalizedMsisdn);
  }

  function submitBulkSecondary() {
    const msisdns = parseBulkMsisdns(bulkMsisdns);

    if (msisdns.length === 0) {
      setBulkValidationError("Paste at least one valid MTN Uganda number.");
      return;
    }

    setBulkValidationError("");
    bulkMutation.mutate(msisdns);
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Secondary Numbers</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Numbers are validated before they are added to the account.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openAddDrawer}
          >
            <Plus className="h-4 w-4" />
            Add Secondary
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => secondaryQuery.refetch()}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <DataTable
          columns={secondaryColumns}
          rows={secondaryQuery.data?.data ?? []}
          getRowKey={(secondaryNumber) => secondaryNumber.id}
          minWidth={720}
          isLoading={secondaryQuery.isLoading}
          exportOptions={{
            title: "Secondary Numbers",
            filename: "secondary-numbers",
          }}
          rowActions={secondaryRowActions}
          filters={
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FilterInput
                label="Search"
                value={secondaryFilters.search ?? ""}
                onChange={(value) => updateSecondaryFilters({ search: value })}
              />
              <FilterSelect
                label="Status"
                value={secondaryFilters.status ?? ""}
                onChange={(value) => updateSecondaryFilters({ status: value })}
                options={[
                  { label: "All statuses", value: "" },
                  { label: "Active", value: "active" },
                  { label: "Removed", value: "removed" },
                ]}
              />
              <FilterInput
                label="From"
                type="date"
                value={secondaryFilters.dateFrom ?? ""}
                onChange={(value) =>
                  updateSecondaryFilters({ dateFrom: value })
                }
              />
              <FilterInput
                label="To"
                type="date"
                value={secondaryFilters.dateTo ?? ""}
                onChange={(value) => updateSecondaryFilters({ dateTo: value })}
              />
            </div>
          }
          pagination={
            secondaryQuery.data
              ? {
                  ...secondaryQuery.data.meta,
                  windowKey: JSON.stringify({
                    customerId: customer.id,
                    primaryMsisdn,
                    search: secondaryFilters.search,
                    status: secondaryFilters.status,
                    dateFrom: secondaryFilters.dateFrom,
                    dateTo: secondaryFilters.dateTo,
                    limit: secondaryFilters.limit,
                  }),
                  isFetchingPage: secondaryQuery.isFetching,
                  onPageChange: (page) => updateSecondaryFilters({ page }),
                  onLimitChange: (limit) => updateSecondaryFilters({ limit }),
                }
              : undefined
          }
        />
      </div>

      <SecondaryNumberDrawer
        open={addDrawerOpen}
        customerName={customer.businessName}
        primaryMsisdn={primaryMsisdn}
        msisdn={msisdn}
        onMsisdnChange={(value) => {
          setSingleValidationError("");
          setMsisdn(value);
        }}
        bulkMsisdns={bulkMsisdns}
        onBulkMsisdnsChange={(value) => {
          setBulkValidationError("");
          setBulkMsisdns(value);
        }}
        onClose={closeAddDrawer}
        onSingleSubmit={submitSingleSecondary}
        onBulkSubmit={submitBulkSecondary}
        singlePending={addMutation.isPending}
        bulkPending={bulkMutation.isPending}
        singleErrorMessage={
          singleValidationError ||
          (addMutation.isError ? addMutation.error.message : "")
        }
        bulkErrorMessage={
          bulkValidationError ||
          (bulkMutation.isError ? bulkMutation.error.message : "")
        }
        bulkSuccessMessage={
          bulkMutation.isSuccess
            ? `Added ${bulkMutation.data.added.length}; rejected ${bulkMutation.data.rejected.length}.`
            : ""
        }
      />
    </Panel>
  );
}

function SecondaryNumberDrawer({
  open,
  customerName,
  primaryMsisdn,
  msisdn,
  onMsisdnChange,
  bulkMsisdns,
  onBulkMsisdnsChange,
  onClose,
  onSingleSubmit,
  onBulkSubmit,
  singlePending,
  bulkPending,
  singleErrorMessage,
  bulkErrorMessage,
  bulkSuccessMessage,
}: {
  open: boolean;
  customerName: string;
  primaryMsisdn: string;
  msisdn: string;
  onMsisdnChange: (value: string) => void;
  bulkMsisdns: string;
  onBulkMsisdnsChange: (value: string) => void;
  onClose: () => void;
  onSingleSubmit: () => void;
  onBulkSubmit: () => void;
  singlePending: boolean;
  bulkPending: boolean;
  singleErrorMessage: string;
  bulkErrorMessage: string;
  bulkSuccessMessage: string;
}) {
  if (!open) {
    return null;
  }

  const isPending = singlePending || bulkPending;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close add secondary number drawer"
        className="absolute inset-0 bg-ink/35 dark:bg-black/60"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="secondary-number-drawer-title"
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl sm:w-[min(92vw,28rem)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-4">
          <div className="min-w-0">
            <h2
              id="secondary-number-drawer-title"
              className="text-lg font-semibold"
            >
              Add Secondary Numbers
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Add one number or upload many under {customerName} for{" "}
              {primaryMsisdn}.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <form
              className="rounded-lg border border-border/60 bg-card p-4"
              onSubmit={(event) => {
                event.preventDefault();
                onSingleSubmit();
              }}
            >
              <div className="mb-4">
                <h3 className="font-semibold">Single number</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Add one secondary MSISDN to this primary number.
                </p>
              </div>
              <PhoneField
                label="Secondary MSISDN"
                required
                value={msisdn}
                onValueChange={onMsisdnChange}
                disabled={singlePending || bulkPending}
              />
              <p className="mt-3 text-sm text-[var(--muted)]">
                Only MTN Uganda numbers using +256 77, 78, 79, 76, or 39 are
                accepted.
              </p>
              <div className="mt-4 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={singlePending || bulkPending}
                >
                  <Plus className="h-4 w-4" />
                  {singlePending ? "Adding..." : "Add Number"}
                </Button>
              </div>
              {singleErrorMessage && (
                <p className="mt-3 text-sm font-medium text-coral">
                  {singleErrorMessage}
                </p>
              )}
            </form>

            <form
              className="rounded-lg border border-border/60 bg-card p-4"
              onSubmit={(event) => {
                event.preventDefault();
                onBulkSubmit();
              }}
            >
              <div className="mb-4">
                <h3 className="font-semibold">Bulk upload</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Paste numbers separated by commas, spaces, or new lines.
                </p>
              </div>
              <TextareaField
                label="Secondary MSISDNs"
                rows={8}
                value={bulkMsisdns}
                onValueChange={onBulkMsisdnsChange}
                disabled={singlePending || bulkPending}
              />
              <div className="mt-4 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={singlePending || bulkPending}
                >
                  <Upload className="h-4 w-4" />
                  {bulkPending ? "Processing..." : "Process Upload"}
                </Button>
              </div>
              {bulkSuccessMessage && (
                <p className="mt-3 text-sm font-medium text-forest">
                  {bulkSuccessMessage}
                </p>
              )}
              {bulkErrorMessage && (
                <p className="mt-3 text-sm font-medium text-coral">
                  {bulkErrorMessage}
                </p>
              )}
            </form>
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] bg-[var(--panel)] px-4 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={onClose}
            >
              Close
            </Button>
          </footer>
        </div>
      </aside>
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
