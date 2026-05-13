"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, PackagePlus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn, type DataTableRowAction } from "@/components/ui/data-table";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentCheckoutDialog } from "@/features/customer/payment-checkout-dialog";
import { api } from "@/lib/api-client";
import { formatUgx, sentenceCase } from "@/lib/format";
import { showPrimaryBalance } from "@/lib/table-actions";
import type { AppSection } from "@/store/ui-store";
import type { Customer } from "@/types/domain";

interface OperationsPageProps {
  initialMode: Extract<AppSection, "customers" | "bundles">;
}

const customerColumns: Array<DataTableColumn<Customer>> = [
  {
    id: "business",
    header: "Business",
    exportValue: (customer) => `${customer.businessName} (${customer.registrationNumber})`,
    cell: (customer) => (
      <div>
        <p className="font-medium">{customer.businessName}</p>
        <p className="text-xs text-[var(--muted)]">{customer.registrationNumber}</p>
      </div>
    ),
  },
  {
    id: "contact",
    header: "Contact",
    exportValue: (customer) => `${customer.contactPerson} (${customer.email})`,
    cell: (customer) => (
      <div>
        <p>{customer.contactPerson}</p>
        <p className="text-xs text-[var(--muted)]">{customer.email}</p>
      </div>
    ),
  },
  {
    id: "apn",
    header: "APN",
    exportValue: (customer) => `${customer.apnName} (${customer.apnId})`,
    cell: (customer) => (
      <div>
        <p>{customer.apnName}</p>
        <p className="text-xs text-[var(--muted)]">{customer.apnId}</p>
      </div>
    ),
  },
  {
    id: "primaryMsisdns",
    header: "Primary MSISDNs",
    exportValue: (customer) => customer.primaryMsisdns.join(", "),
    cell: (customer) => customer.primaryMsisdns.join(", "),
  },
  {
    id: "secondary",
    header: "Secondary",
    exportValue: (customer) => customer.secondaryCount,
    cell: (customer) => customer.secondaryCount,
  },
  {
    id: "status",
    header: "Status",
    exportValue: (customer) => sentenceCase(customer.status),
    cell: (customer) => (
      <StatusBadge
        label={sentenceCase(customer.status)}
        tone={customer.status === "active" ? "green" : "yellow"}
      />
    ),
  },
];

export function OperationsPage({ initialMode }: OperationsPageProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"customers" | "bundles">(initialMode);
  const customersQuery = useQuery({ queryKey: ["customers"], queryFn: api.customers });
  const bundlesQuery = useQuery({ queryKey: ["bundles"], queryFn: api.bundles });
  const [customerId, setCustomerId] = useState("");
  const [primaryMsisdn, setPrimaryMsisdn] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [provisioningCount, setProvisioningCount] = useState(1);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  const selectedCustomer = useMemo(
    () => {
      const effectiveCustomerId = customerId || customersQuery.data?.[0]?.id;
      return customersQuery.data?.find((customer) => customer.id === effectiveCustomerId);
    },
    [customerId, customersQuery.data],
  );

  const effectiveCustomerId = selectedCustomer?.id ?? "";
  const effectivePrimaryMsisdn =
    selectedCustomer?.primaryMsisdns.includes(primaryMsisdn) && primaryMsisdn
      ? primaryMsisdn
      : (selectedCustomer?.primaryMsisdns[0] ?? "");
  const effectiveBundleId = bundleId || bundlesQuery.data?.[0]?.id || "";
  const selectedBundle = bundlesQuery.data?.find((bundle) => bundle.id === effectiveBundleId);
  const totalAmount = (selectedBundle?.priceUgx ?? 0) * provisioningCount;

  async function invalidateAfterPayment() {
    setPaymentCompleted(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["overview"] }),
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["customers-table"] }),
      queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
      queryClient.invalidateQueries({ queryKey: ["admin-report"] }),
      queryClient.invalidateQueries({ queryKey: ["report-transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["report-transactions-infinite"] }),
      queryClient.invalidateQueries({ queryKey: ["customer-report", effectiveCustomerId] }),
    ]);
  }

  const loading = customersQuery.isLoading || bundlesQuery.isLoading;
  const failed = customersQuery.isError || bundlesQuery.isError;

  if (loading) {
    return <Panel>Loading workspace...</Panel>;
  }

  if (failed || !customersQuery.data || !bundlesQuery.data) {
    return <Panel>Workspace data could not be loaded.</Panel>;
  }
  const customerRowActions: Array<DataTableRowAction<Customer>> = [
    {
      id: "check-primary-balance",
      label: "Check balance",
      icon: Activity,
      disabled: (customer) => customer.primaryMsisdns.length === 0,
      onSelect: (customer) => {
        const primaryMsisdn = customer.primaryMsisdns[0];

        if (primaryMsisdn) {
          void showPrimaryBalance(customer.id, primaryMsisdn);
        }
      },
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Customer and Bundle Workspace</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Customer APN records, primary numbers, and prepaid bundle operations.
          </p>
        </div>
        <div className="inline-flex rounded-md border border-border bg-card p-1">
          {(["customers", "bundles"] as const).map((item) => (
            <Button
              key={item}
              type="button"
              variant={mode === item ? "primary" : "ghost"}
              size="sm"
              onClick={() => setMode(item)}
            >
              {sentenceCase(item)}
            </Button>
          ))}
        </div>
      </div>

      {mode === "customers" ? (
        <Panel>
          <DataTable
            columns={customerColumns}
            rows={customersQuery.data}
            getRowKey={(customer) => customer.id}
            minWidth={860}
            exportOptions={{
              title: "Customer Workspace",
              filename: "customer-workspace",
            }}
            rowActions={customerRowActions}
          />
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {bundlesQuery.data.map((bundle) => (
            <Panel key={bundle.id} className="flex min-h-48 flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{bundle.name}</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">{bundle.serviceCode}</p>
                  </div>
                  <StatusBadge label={sentenceCase(bundle.status)} tone="green" />
                </div>
                <p className="mt-5 text-3xl font-semibold">{bundle.volumeTb} TB</p>
              </div>
              <div className="mt-5 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-[var(--muted)]">30-day validity</p>
                  <p className="font-semibold">{formatUgx(bundle.priceUgx)}</p>
                </div>
                <PackagePlus className="h-5 w-5 text-[var(--muted)]" />
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
          <h3 className="font-semibold">Provision Bundle</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
              Payment simulation and service activation preparation.
          </p>
          </div>
          {paymentCompleted && <StatusBadge label="Provisioned" tone="green" />}
        </div>

        <form
          className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!selectedBundle || !effectiveCustomerId || !effectivePrimaryMsisdn) return;
          setCheckoutOpen(true);
          }}
        >
          <SelectField
            label="Customer"
            value={effectiveCustomerId}
            onValueChange={(value) => {
              const nextCustomer = customersQuery.data.find((customer) => customer.id === value);
              setCustomerId(value);
              setPrimaryMsisdn(nextCustomer?.primaryMsisdns[0] ?? "");
            }}
            options={customersQuery.data.map((customer) => ({ label: customer.businessName, value: customer.id }))}
          />

          <SelectField
            label="Primary MSISDN"
            value={effectivePrimaryMsisdn}
            onValueChange={setPrimaryMsisdn}
            options={selectedCustomer?.primaryMsisdns.map((msisdn) => ({ label: msisdn, value: msisdn })) ?? []}
          />

          <SelectField
            label="Bundle"
            value={effectiveBundleId}
            onValueChange={setBundleId}
            options={bundlesQuery.data.map((bundle) => ({ label: bundle.name, value: bundle.id }))}
          />

          <TextField
            label="Count"
            min={1}
            max={12}
            type="number"
            value={provisioningCount}
            onValueChange={(value) => setProvisioningCount(Number(value))}
          />

          <div className="md:col-span-2 xl:col-span-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
            <p className="text-sm">
              Total amount: <span className="font-semibold">{formatUgx(totalAmount)}</span>
            </p>
            <Button
              type="submit"
              variant="primary"
              disabled={!selectedBundle || !effectiveCustomerId || !effectivePrimaryMsisdn}
            >
              <PackagePlus className="h-4 w-4" />
              Checkout
            </Button>
          </div>
        </form>
      </Panel>

      {selectedCustomer && selectedBundle && effectivePrimaryMsisdn && (
        <PaymentCheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          customer={selectedCustomer}
          primaryMsisdn={effectivePrimaryMsisdn}
          bundle={selectedBundle}
          provisioningCount={provisioningCount}
          onPaymentComplete={invalidateAfterPayment}
        />
      )}
    </div>
  );
}
