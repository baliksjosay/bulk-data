"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Check,
  Copy,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  ShieldOff,
  ShieldCheck,
  Trash2,
  X,
  Users,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { PhoneField, SelectField, TextField } from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import { formatDateTime, formatUgx, sentenceCase } from "@/lib/format";
import { showPrimaryBalance } from "@/lib/table-actions";
import { useUiStore } from "@/store/ui-store";
import type {
  AuthRole,
  Customer,
  CustomerRegistrationResult,
  CustomerRegistrationRequest,
  CustomerUpdateRequest,
  ListQuery,
  SecondaryNumber,
} from "@/types/domain";

const emptyRegistrationForm: CustomerRegistrationRequest = {
  businessName: "",
  registrationNumber: "",
  tin: "",
  businessEmail: "",
  businessPhone: "+256",
  contactPerson: "",
  contactEmail: "",
  contactPhone: "+256",
  apnName: "",
  apnId: "",
  primaryMsisdn: "",
};

function statusTone(status: Customer["status"]) {
  if (status === "active") {
    return "green" as const;
  }

  if (status === "deactivated") {
    return "red" as const;
  }

  return "yellow" as const;
}

export function AdminWorkspace({ currentRole }: { currentRole: AuthRole }) {
  const [customerTableFilters, setCustomerTableFilters] = useState<ListQuery>({
    page: 1,
    limit: 10,
    search: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });
  const customersTableQuery = useQuery({
    queryKey: ["customers-table", customerTableFilters],
    queryFn: () => api.customerPage(customerTableFilters),
    placeholderData: (previousData) => previousData,
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const canManageCustomers = currentRole === "admin";
  const selectedCustomerFromTable = useMemo(() => {
    if (!selectedCustomerId) {
      return undefined;
    }

    return customersTableQuery.data?.data.find(
      (customer) => customer.id === selectedCustomerId,
    );
  }, [customersTableQuery.data?.data, selectedCustomerId]);
  const selectedCustomerQuery = useQuery({
    queryKey: ["customer", selectedCustomerId],
    queryFn: () => api.customer(selectedCustomerId),
    enabled: Boolean(selectedCustomerId),
  });
  const selectedCustomer =
    selectedCustomerQuery.data ?? selectedCustomerFromTable;
  const closeDrawer = () => {
    setDrawerMode(null);
    setSelectedCustomerId("");
  };
  const openEditDrawer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setDrawerMode("edit");
  };
  const openAccountDetails = (customer: Customer) => {
    setViewingCustomer(customer);
  };
  const customerColumns: Array<DataTableColumn<Customer>> = [
    {
      id: "business",
      header: "Business",
      exportValue: (customer) => customer.businessName,
      cell: (customer) => (
        <div>
          <p className="font-medium">{customer.businessName}</p>
          <p className="text-xs text-[var(--muted)]">
            {customer.registrationNumber}
          </p>
        </div>
      ),
    },
    {
      id: "createdAt",
      header: "Registered",
      exportValue: (customer) => formatDateTime(customer.createdAt),
      cell: (customer) => formatDateTime(customer.createdAt),
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
      id: "primary",
      header: "Primary MSISDNs",
      exportValue: (customer) => customer.primaryMsisdns.join(", "),
      cell: (customer) => (
        <PrimaryMsisdnSummary msisdns={customer.primaryMsisdns} />
      ),
    },
    {
      id: "secondary",
      header: "Secondary",
      exportValue: (customer) => customer.secondaryCount,
      cell: (customer) => customer.secondaryCount,
    },
    {
      id: "spend",
      header: "Spend",
      exportValue: (customer) => formatUgx(customer.totalSpendUgx),
      cell: (customer) => formatUgx(customer.totalSpendUgx),
    },
    {
      id: "status",
      header: "Status",
      exportValue: (customer) => sentenceCase(customer.status),
      cell: (customer) => (
        <StatusBadge
          label={sentenceCase(customer.status)}
          tone={statusTone(customer.status)}
        />
      ),
    },
  ];
  const customerRowActions: Array<DataTableRowAction<Customer>> = [
    {
      id: "view-customer",
      label: "View customer",
      icon: Eye,
      onSelect: openAccountDetails,
    },
    ...(canManageCustomers
      ? [
          {
            id: "manage-customer",
            label: "Manage customer",
            icon: Pencil,
            onSelect: openEditDrawer,
          },
        ]
      : []),
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

  function updateCustomerTableFilters(nextFilters: Partial<ListQuery>) {
    setCustomerTableFilters((current) => ({
      ...current,
      ...nextFilters,
      page: nextFilters.page ?? 1,
    }));
  }

  if (customersTableQuery.isError) {
    return <Panel>Customers could not be loaded.</Panel>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Customers</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Register customers, validate primary MSISDNs, and manage account
            status.
          </p>
        </div>
        {canManageCustomers && (
          <Button
            type="button"
            variant="primary"
            onClick={() => setDrawerMode("create")}
          >
            <Plus className="h-4 w-4" />
            Create Customer
          </Button>
        )}
      </div>

      <Panel>
        <h3 className="font-semibold">Customer List</h3>
        <div className="mt-4">
          <DataTable
            columns={customerColumns}
            rows={customersTableQuery.data?.data ?? []}
            getRowKey={(customer) => customer.id}
            minWidth={980}
            isLoading={customersTableQuery.isLoading}
            onRowClick={openAccountDetails}
            exportOptions={{
              title: "Customer Accounts",
              filename: "customer-accounts",
            }}
            rowActions={customerRowActions}
            filters={
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <FilterInput
                  label="Search"
                  value={customerTableFilters.search ?? ""}
                  onChange={(value) =>
                    updateCustomerTableFilters({ search: value })
                  }
                />
                <FilterSelect
                  label="Status"
                  value={customerTableFilters.status ?? ""}
                  onChange={(value) =>
                    updateCustomerTableFilters({ status: value })
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
                  value={customerTableFilters.dateFrom ?? ""}
                  onChange={(value) =>
                    updateCustomerTableFilters({ dateFrom: value })
                  }
                />
                <FilterInput
                  label="To"
                  type="date"
                  value={customerTableFilters.dateTo ?? ""}
                  onChange={(value) =>
                    updateCustomerTableFilters({ dateTo: value })
                  }
                />
              </div>
            }
            pagination={
              customersTableQuery.data
                ? {
                    ...customersTableQuery.data.meta,
                    windowKey: JSON.stringify({
                      search: customerTableFilters.search,
                      status: customerTableFilters.status,
                      dateFrom: customerTableFilters.dateFrom,
                      dateTo: customerTableFilters.dateTo,
                      limit: customerTableFilters.limit,
                    }),
                    isFetchingPage: customersTableQuery.isFetching,
                    onPageChange: (page) =>
                      updateCustomerTableFilters({ page }),
                    onLimitChange: (limit) =>
                      updateCustomerTableFilters({ limit }),
                  }
                : undefined
            }
          />
        </div>
      </Panel>

      <AccountDrawer
        open={drawerMode !== null}
        title={drawerMode === "create" ? "Create Customer" : "Manage Customer"}
        description={
          drawerMode === "create"
            ? "Add customer details, APN mapping, and primary MSISDN."
            : "Update customer details, primary MSISDNs, and account status."
        }
        onClose={closeDrawer}
      >
        {drawerMode === "create" && (
          <CustomerRegistrationForm
            key="create-customer"
            onRegistered={closeDrawer}
          />
        )}
        {drawerMode === "edit" && selectedCustomer && (
          <CustomerAdminDetail
            key={selectedCustomer.id}
            customer={selectedCustomer}
          />
        )}
        {drawerMode === "edit" &&
          !selectedCustomer &&
          selectedCustomerQuery.isLoading && (
            <Panel>Loading selected customer...</Panel>
          )}
        {drawerMode === "edit" &&
          !selectedCustomer &&
          !selectedCustomerQuery.isLoading && (
            <Panel>Selected customer could not be loaded.</Panel>
          )}
      </AccountDrawer>

      <AccountDetailsDialog
        customer={viewingCustomer}
        canManage={canManageCustomers}
        open={Boolean(viewingCustomer)}
        onOpenChange={(open) => {
          if (!open) {
            setViewingCustomer(null);
          }
        }}
        onEdit={(customer) => {
          setViewingCustomer(null);
          openEditDrawer(customer);
        }}
        onSecondaryAdded={(customerId) => {
          setViewingCustomer((current) =>
            current && current.id === customerId
              ? { ...current, secondaryCount: current.secondaryCount + 1 }
              : current,
          );
        }}
        onSecondaryRemoved={(customerId) => {
          setViewingCustomer((current) =>
            current && current.id === customerId
              ? {
                  ...current,
                  secondaryCount: Math.max(current.secondaryCount - 1, 0),
                }
              : current,
          );
        }}
      />
    </div>
  );
}

function PrimaryMsisdnSummary({ msisdns }: { msisdns: string[] }) {
  const visibleMsisdns = msisdns.slice(0, 2);
  const remainingCount = Math.max(msisdns.length - visibleMsisdns.length, 0);

  if (msisdns.length === 0) {
    return <span className="text-[var(--muted)]">None</span>;
  }

  return (
    <span className="block max-w-72 text-sm leading-6 text-foreground">
      {visibleMsisdns.join(", ")}
      {remainingCount > 0 && (
        <span className="text-[var(--muted)]">
          {", "}+{remainingCount} more
        </span>
      )}
    </span>
  );
}

function AccountDetailsDialog({
  customer,
  canManage,
  open,
  onOpenChange,
  onEdit,
  onSecondaryAdded,
  onSecondaryRemoved,
}: {
  customer: Customer | null;
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (customer: Customer) => void;
  onSecondaryAdded: (customerId: string) => void;
  onSecondaryRemoved: (customerId: string) => void;
}) {
  const queryClient = useQueryClient();
  const setSelectedCustomerContext = useUiStore(
    (state) => state.setSelectedCustomerContext,
  );
  const [copiedMsisdn, setCopiedMsisdn] = useState("");
  const [selectedPrimaryMsisdn, setSelectedPrimaryMsisdn] = useState("");
  const [selectedPrimaryForSecondaries, setSelectedPrimaryForSecondaries] =
    useState("");
  const [secondaryMsisdn, setSecondaryMsisdn] = useState("+256");
  const addSecondaryMutation = useMutation({
    mutationFn: () => {
      if (!customer || !selectedPrimaryMsisdn) {
        throw new Error("Select a primary MSISDN first.");
      }

      return api.addSecondaryNumber(customer.id, selectedPrimaryMsisdn, {
        msisdn: secondaryMsisdn,
      });
    },
    onSuccess: async () => {
      if (!customer) {
        return;
      }

      setSecondaryMsisdn("+256");
      setSelectedPrimaryMsisdn("");
      onSecondaryAdded(customer.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["customers-table"] }),
        queryClient.invalidateQueries({ queryKey: ["customer", customer.id] }),
        queryClient.invalidateQueries({
          queryKey: ["secondary-numbers", customer.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["customer-report", customer.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
      ]);
    },
  });

  if (!customer) {
    return null;
  }

  const activeCustomer = customer;

  async function copyMsisdn(msisdn: string) {
    if (!navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(msisdn);
    setCopiedMsisdn(msisdn);
    window.setTimeout(() => {
      setCopiedMsisdn((current) => (current === msisdn ? "" : current));
    }, 1600);
  }

  function openSecondaryDrawer(msisdn: string) {
    if (!canManage) {
      return;
    }

    addSecondaryMutation.reset();
    setSelectedCustomerContext(activeCustomer.id, msisdn);
    setSecondaryMsisdn("+256");
    setSelectedPrimaryMsisdn(msisdn);
  }

  function openSecondaryList(msisdn: string) {
    setSelectedCustomerContext(activeCustomer.id, msisdn);
    setSelectedPrimaryForSecondaries(msisdn);
  }

  function selectPrimaryMsisdn(msisdn: string) {
    setSelectedCustomerContext(activeCustomer.id, msisdn);
  }

  function closeSecondaryDrawer() {
    if (addSecondaryMutation.isPending) {
      return;
    }

    addSecondaryMutation.reset();
    setSelectedPrimaryMsisdn("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[92dvh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0 sm:max-w-[min(96vw,48rem)]">
        <DialogHeader className="border-b border-border bg-card px-4 py-4 pr-12 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <DialogTitle className="truncate text-xl">
                {customer.businessName}
              </DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-2">
                <span>{customer.registrationNumber}</span>
                <span className="text-muted-foreground/60">/</span>
                <span>{customer.apnName}</span>
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge
                label={sentenceCase(customer.status)}
                tone={statusTone(customer.status)}
              />
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4">
            <section className="surface-default flex min-w-0 flex-col gap-4 rounded-lg border border-border/70 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold">Company Details</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Business profile and APN configuration.
                  </p>
                </div>
                <span className="shrink-0 text-sm text-[var(--muted)]">
                  Registered {formatDateTime(customer.createdAt)}
                </span>
              </div>
              <div className="grid gap-3">
                <AccountDetailItem
                  label="Business name"
                  value={customer.businessName}
                />
                <AccountDetailItem
                  label="Account reference"
                  value={customer.registrationNumber}
                />
                {customer.tin && (
                  <AccountDetailItem label="TIN" value={customer.tin} />
                )}
                <AccountDetailItem
                  label="Business email"
                  value={customer.businessEmail}
                />
                <AccountDetailItem
                  label="Business phone"
                  value={customer.businessPhone}
                />
                <AccountDetailItem label="APN name" value={customer.apnName} />
                <AccountDetailItem label="APN ID" value={customer.apnId} />
              </div>
            </section>

            <section className="surface-default flex min-w-0 flex-col gap-4 rounded-lg border border-border/70 p-4">
              <div>
                <h3 className="font-semibold">Contact Person</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Primary contact for account operations.
                </p>
              </div>
              <div className="grid gap-3">
                <AccountDetailItem
                  label="Name"
                  value={customer.contactPerson}
                />
                <AccountDetailItem label="Email" value={customer.email} />
                <AccountDetailItem label="Phone" value={customer.phone} />
              </div>
            </section>

            <section className="surface-default rounded-lg border border-border/70 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="font-semibold">Account Summary</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Current commercial and number allocation snapshot.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <AccountMetric
                  label="Total spend"
                  value={formatUgx(customer.totalSpendUgx)}
                />
                <AccountMetric
                  label="Bundle purchases"
                  value={customer.bundlePurchases.toLocaleString("en-US")}
                />
                <AccountMetric
                  label="Secondary numbers"
                  value={customer.secondaryCount.toLocaleString("en-US")}
                />
                <AccountMetric
                  label="Primary MSISDNs"
                  value={customer.primaryMsisdns.length.toLocaleString("en-US")}
                />
              </div>
            </section>

            <section className="surface-default rounded-lg border border-border/70 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="font-semibold">Primary MSISDNs</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Select a primary number, copy it, or open account actions.
                  </p>
                </div>
                <span className="text-sm text-[var(--muted)]">
                  {customer.primaryMsisdns.length} attached
                </span>
              </div>
              <Separator className="my-4" />
              <div className="max-h-80 overflow-y-auto pr-1">
                {customer.primaryMsisdns.length > 0 ? (
                  <div className="grid gap-2">
                    {customer.primaryMsisdns.map((msisdn, index) => {
                      const copied = copiedMsisdn === msisdn;

                      return (
                        <div
                          key={msisdn}
                          className="surface-table-hover group flex min-h-16 min-w-0 items-center gap-3 rounded-md border border-border/70 px-3 py-2 text-left text-sm transition-colors focus-within:ring-2 focus-within:ring-ring/40"
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left focus-visible:outline-none"
                            aria-label={`Copy primary MSISDN ${msisdn}`}
                            onClick={() => {
                              selectPrimaryMsisdn(msisdn);
                              void copyMsisdn(msisdn);
                            }}
                          >
                            <span className="block break-all font-medium">
                              {msisdn}
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
                          <PrimaryMsisdnActions
                            msisdn={msisdn}
                            canManage={canManage}
                            onAddSecondary={() => openSecondaryDrawer(msisdn)}
                            onManageSecondaries={() =>
                              openSecondaryList(msisdn)
                            }
                            onCheckBalance={() => {
                              selectPrimaryMsisdn(msisdn);
                              void showPrimaryBalance(customer.id, msisdn);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-md border border-border/70 p-3 text-sm text-[var(--muted)]">
                    No primary MSISDNs are attached.
                  </p>
                )}
              </div>
            </section>
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-card px-4 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {canManage && (
            <Button
              type="button"
              variant="primary"
              onClick={() => onEdit(customer)}
            >
              <Pencil />
              Manage Customer
            </Button>
          )}
        </DialogFooter>

        {canManage && (
          <AddSecondaryFromPrimaryDrawer
            open={Boolean(selectedPrimaryMsisdn)}
            customerName={customer.businessName}
            primaryMsisdn={selectedPrimaryMsisdn}
            secondaryMsisdn={secondaryMsisdn}
            onSecondaryMsisdnChange={setSecondaryMsisdn}
            onClose={closeSecondaryDrawer}
            onSubmit={() => addSecondaryMutation.mutate()}
            isPending={addSecondaryMutation.isPending}
            errorMessage={
              addSecondaryMutation.isError
                ? addSecondaryMutation.error.message
                : ""
            }
          />
        )}
        {canManage && (
          <ManageSecondaryNumbersDrawer
            open={Boolean(selectedPrimaryForSecondaries)}
            customer={customer}
            primaryMsisdn={selectedPrimaryForSecondaries}
            onClose={() => setSelectedPrimaryForSecondaries("")}
            onRemoved={onSecondaryRemoved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PrimaryMsisdnActions({
  msisdn,
  canManage,
  onAddSecondary,
  onManageSecondaries,
  onCheckBalance,
}: {
  msisdn: string;
  canManage: boolean;
  onAddSecondary: () => void;
  onManageSecondaries: () => void;
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
          {canManage && (
            <DropdownMenuItem onSelect={onAddSecondary}>
              <Plus className="h-4 w-4" />
              Add secondary number
            </DropdownMenuItem>
          )}
          {canManage && (
            <DropdownMenuItem onSelect={onManageSecondaries}>
              <Users className="h-4 w-4" />
              Manage secondary numbers
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onCheckBalance}>
            <Activity className="h-4 w-4" />
            Check balance
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ManageSecondaryNumbersDrawer({
  open,
  customer,
  primaryMsisdn,
  onClose,
  onRemoved,
}: {
  open: boolean;
  customer: Customer;
  primaryMsisdn: string;
  onClose: () => void;
  onRemoved: (customerId: string) => void;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["secondary-numbers", customer.id, primaryMsisdn, "admin"],
    queryFn: () =>
      api.secondaryNumbersPage(customer.id, primaryMsisdn, {
        page: 1,
        limit: 50,
        search: "",
        status: "",
        dateFrom: "",
        dateTo: "",
      }),
    enabled: open && Boolean(primaryMsisdn),
  });
  const removeMutation = useMutation({
    mutationFn: (secondaryMsisdn: string) =>
      api.removeSecondaryNumber(customer.id, primaryMsisdn, secondaryMsisdn),
    onSuccess: async () => {
      onRemoved(customer.id);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["secondary-numbers", customer.id, primaryMsisdn],
        }),
        queryClient.invalidateQueries({
          queryKey: ["secondary-numbers", customer.id, primaryMsisdn, "admin"],
        }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["customers-table"] }),
        queryClient.invalidateQueries({ queryKey: ["customer", customer.id] }),
        queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
      ]);
    },
  });
  const columns: Array<DataTableColumn<SecondaryNumber>> = [
    {
      id: "msisdn",
      header: "Secondary MSISDN",
      exportValue: (secondaryNumber) => secondaryNumber.msisdn,
      cell: (secondaryNumber) => (
        <span className="font-medium">{secondaryNumber.msisdn}</span>
      ),
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
    {
      id: "addedAt",
      header: "Added",
      exportValue: (secondaryNumber) => formatDateTime(secondaryNumber.addedAt),
      cell: (secondaryNumber) => formatDateTime(secondaryNumber.addedAt),
    },
  ];
  const rowActions: Array<DataTableRowAction<SecondaryNumber>> = [
    {
      id: "remove-secondary",
      label: "Remove from group",
      icon: Trash2,
      variant: "destructive",
      disabled: (secondaryNumber) =>
        secondaryNumber.status !== "active" || removeMutation.isPending,
      onSelect: (secondaryNumber) =>
        removeMutation.mutate(secondaryNumber.msisdn),
    },
  ];

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--console-header-height,4rem)] z-[70]">
      <button
        type="button"
        aria-label="Close secondary number management drawer"
        className="absolute inset-0 bg-ink/35 dark:bg-black/60"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-secondary-title"
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl sm:w-[min(92vw,44rem)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-4">
          <div className="min-w-0">
            <h2 id="manage-secondary-title" className="text-lg font-semibold">
              Secondary Numbers
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {customer.businessName} / {primaryMsisdn}
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
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <DataTable
            columns={columns}
            rows={query.data?.data ?? []}
            getRowKey={(secondaryNumber) => secondaryNumber.id}
            minWidth={640}
            isLoading={query.isLoading}
            emptyMessage="No secondary numbers found for this primary MSISDN."
            rowActions={rowActions}
          />
          {removeMutation.isError && (
            <p className="mt-3 text-sm font-medium text-coral">
              {removeMutation.error.message}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

function AddSecondaryFromPrimaryDrawer({
  open,
  customerName,
  primaryMsisdn,
  secondaryMsisdn,
  onSecondaryMsisdnChange,
  onClose,
  onSubmit,
  isPending,
  errorMessage,
}: {
  open: boolean;
  customerName: string;
  primaryMsisdn: string;
  secondaryMsisdn: string;
  onSecondaryMsisdnChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
  errorMessage: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--console-header-height,4rem)] z-[60]">
      <button
        type="button"
        aria-label="Close add secondary number drawer"
        className="absolute inset-0 bg-ink/35 dark:bg-black/60"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-secondary-drawer-title"
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl sm:w-[min(92vw,30rem)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-4">
          <div className="min-w-0">
            <h2
              id="account-secondary-drawer-title"
              className="text-lg font-semibold"
            >
              Add Secondary Number
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Add a secondary number under {customerName}.
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

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="flex-1 overflow-y-auto p-4">
            <div className="surface-default mb-4 rounded-lg border border-border/60 p-3">
              <p className="text-xs text-[var(--muted)]">
                Selected primary MSISDN
              </p>
              <p className="mt-1 font-semibold">{primaryMsisdn}</p>
            </div>

            <div className="surface-default rounded-lg border border-border/60 p-4">
              <PhoneInput
                label="Secondary MSISDN"
                value={secondaryMsisdn}
                onChange={onSecondaryMsisdnChange}
              />
              <p className="mt-3 text-sm text-[var(--muted)]">
                Only MTN Uganda numbers using +256 77, 78, 79, 76, or 39 are
                accepted.
              </p>
            </div>

            {errorMessage && (
              <p className="mt-3 text-sm font-medium text-coral">
                {errorMessage}
              </p>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] bg-[var(--panel)] px-4 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              <Plus className="h-4 w-4" />
              {isPending ? "Adding..." : "Add Secondary"}
            </Button>
          </footer>
        </form>
      </aside>
    </div>
  );
}

function AccountDetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="surface-default flex min-h-20 min-w-0 flex-col justify-between gap-2 rounded-md border border-border/50 p-3">
      <p className="text-xs font-medium uppercase text-[var(--muted)]">
        {label}
      </p>
      <p className="break-words text-sm font-semibold leading-5">{value}</p>
    </div>
  );
}

function AccountMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-default flex min-h-24 min-w-0 flex-col justify-between gap-3 rounded-md border border-border/50 p-3">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="break-words text-lg font-semibold leading-6">
        {value}
      </span>
    </div>
  );
}

function AccountDrawer({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--console-header-height,4rem)] z-50">
      <button
        type="button"
        aria-label="Close account drawer"
        className="absolute inset-0 bg-ink/35 dark:bg-black/60"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-drawer-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-2xl sm:w-[min(92vw,48rem)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-4">
          <div>
            <h2 id="account-drawer-title" className="text-lg font-semibold">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
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
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}

function CustomerRegistrationForm({
  onRegistered,
  initialForm = emptyRegistrationForm,
  submitCustomer = api.registerCustomer,
  submitLabel = "Create Account",
  submittingLabel = "Creating...",
  successLabel = "Registered",
}: {
  onRegistered: () => void;
  initialForm?: CustomerRegistrationRequest;
  submitCustomer?: (
    payload: CustomerRegistrationRequest,
  ) => Promise<CustomerRegistrationResult>;
  submitLabel?: string;
  submittingLabel?: string;
  successLabel?: string;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CustomerRegistrationRequest>(initialForm);
  const [registrationResult, setRegistrationResult] =
    useState<CustomerRegistrationResult | null>(null);
  const mutation = useMutation({
    mutationFn: submitCustomer,
    onSuccess: async (result) => {
      setRegistrationResult(result);
      setForm(emptyRegistrationForm);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["customers-table"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
      ]);
    },
  });

  function updateField<Key extends keyof CustomerRegistrationRequest>(
    key: Key,
    value: CustomerRegistrationRequest[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Account Details</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Captures business details, APN mapping, primary MSISDN validation,
            and account activation trigger.
          </p>
        </div>
        {mutation.isSuccess && (
          <StatusBadge label={successLabel} tone="green" />
        )}
      </div>

      {registrationResult?.activation && (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-950">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">Activation created</p>
              <p className="mt-1 text-emerald-950/75">
                Share this activation link with the customer contact captured on
                the account.
              </p>
              <p className="mt-2 break-all rounded-xl bg-white/70 px-3 py-2 font-mono text-xs">
                {registrationResult.activation.activationUrl}
              </p>
              <p className="mt-2 text-emerald-950/75">
                {registrationResult.validation
                  ? registrationResult.validation.accepted
                    ? `Primary number ${registrationResult.validation.msisdn} was verified and attached.`
                    : `Primary number was not attached: ${registrationResult.validation.reason}`
                  : "No primary number was attached. Add one from the account details when it is available."}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                void navigator.clipboard?.writeText(
                  registrationResult.activation?.activationUrl ?? "",
                );
              }}
            >
              <Copy className="h-4 w-4" />
              Copy link
            </Button>
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="button" size="sm" onClick={onRegistered}>
              Done
            </Button>
          </div>
        </div>
      )}

      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(form);
        }}
      >
        <TextInput
          label="Business name"
          value={form.businessName}
          onChange={(value) => updateField("businessName", value)}
        />
        <TextInput
          label="TIN (optional)"
          value={form.tin ?? ""}
          required={false}
          onChange={(value) => updateField("tin", value)}
        />
        <TextInput
          label="Business email"
          type="email"
          value={form.businessEmail}
          onChange={(value) => updateField("businessEmail", value)}
        />
        <PhoneInput
          label="Business phone"
          value={form.businessPhone}
          onChange={(value) => updateField("businessPhone", value)}
        />
        <TextInput
          label="Contact person"
          value={form.contactPerson}
          onChange={(value) => updateField("contactPerson", value)}
        />
        <TextInput
          label="Contact email"
          type="email"
          value={form.contactEmail}
          onChange={(value) => updateField("contactEmail", value)}
        />
        <PhoneInput
          label="Contact phone"
          value={form.contactPhone}
          onChange={(value) => updateField("contactPhone", value)}
        />
        <TextInput
          label="APN name"
          value={form.apnName}
          onChange={(value) => updateField("apnName", value)}
        />
        <TextInput
          label="APN ID"
          value={form.apnId}
          onChange={(value) => updateField("apnId", value)}
        />
        <PhoneInput
          label="Primary MSISDN (optional)"
          value={form.primaryMsisdn ?? ""}
          required={false}
          onChange={(value) => updateField("primaryMsisdn", value)}
        />

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] pt-4 sm:col-span-2">
          {mutation.isError && (
            <p className="mr-auto text-sm font-medium text-coral">
              {mutation.error.message}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            <Plus className="h-4 w-4" />
            {mutation.isPending ? submittingLabel : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}

function CustomerAdminDetail({ customer }: { customer: Customer }) {
  const queryClient = useQueryClient();
  const [updateForm, setUpdateForm] = useState<CustomerUpdateRequest>({
    businessName: customer.businessName,
    tin: customer.tin ?? "",
    businessEmail: customer.businessEmail,
    businessPhone: customer.businessPhone,
    contactPerson: customer.contactPerson,
    contactEmail: customer.email,
    contactPhone: customer.phone,
    apnName: customer.apnName,
    apnId: customer.apnId,
  });
  const [primaryMsisdn, setPrimaryMsisdn] = useState("+256");
  const [statusReason, setStatusReason] = useState("");

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["customers-table"] }),
      queryClient.invalidateQueries({ queryKey: ["customer", customer.id] }),
      queryClient.invalidateQueries({ queryKey: ["overview"] }),
      queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
    ]);
  };
  const updateMutation = useMutation({
    mutationFn: () => api.updateCustomer(customer.id, updateForm),
    onSuccess: invalidate,
  });
  const primaryMutation = useMutation({
    mutationFn: () => api.addPrimaryMsisdn(customer.id, { primaryMsisdn }),
    onSuccess: async () => {
      setPrimaryMsisdn("+256");
      await invalidate();
    },
  });
  const statusMutation = useMutation({
    mutationFn: (status: "active" | "deactivated") =>
      api.changeCustomerStatus(customer.id, {
        status,
        reason:
          statusReason ||
          (status === "active" ? "Issue resolved" : "Administrative action"),
      }),
    onSuccess: invalidate,
  });

  function updateField<Key extends keyof CustomerUpdateRequest>(
    key: Key,
    value: CustomerUpdateRequest[Key],
  ) {
    setUpdateForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold">{customer.businessName}</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {customer.email} - {customer.phone}
        </p>
      </div>

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          updateMutation.mutate();
        }}
      >
        <TextInput
          label="Business name"
          value={updateForm.businessName ?? ""}
          onChange={(value) => updateField("businessName", value)}
        />
        <TextInput
          label="TIN (optional)"
          value={updateForm.tin ?? ""}
          required={false}
          onChange={(value) => updateField("tin", value)}
        />
        <TextInput
          label="Business email"
          value={updateForm.businessEmail ?? ""}
          onChange={(value) => updateField("businessEmail", value)}
        />
        <PhoneInput
          label="Business phone"
          value={updateForm.businessPhone ?? "+256"}
          onChange={(value) => updateField("businessPhone", value)}
        />
        <TextInput
          label="Contact person"
          value={updateForm.contactPerson ?? ""}
          onChange={(value) => updateField("contactPerson", value)}
        />
        <TextInput
          label="Contact email"
          value={updateForm.contactEmail ?? ""}
          onChange={(value) => updateField("contactEmail", value)}
        />
        <PhoneInput
          label="Contact phone"
          value={updateForm.contactPhone ?? "+256"}
          onChange={(value) => updateField("contactPhone", value)}
        />
        <TextInput
          label="APN name"
          value={updateForm.apnName ?? ""}
          onChange={(value) => updateField("apnName", value)}
        />
        <TextInput
          label="APN ID"
          value={updateForm.apnId ?? ""}
          onChange={(value) => updateField("apnId", value)}
        />
        <div className="sm:col-span-2 flex justify-end">
          <Button
            type="submit"
            variant="secondary"
            disabled={updateMutation.isPending}
          >
            <Save className="h-4 w-4" />
            Save Details
          </Button>
        </div>
      </form>

      <form
        className="space-y-3 border-t border-[var(--border)] pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          primaryMutation.mutate();
        }}
      >
        <PhoneInput
          label="Add primary MSISDN"
          value={primaryMsisdn}
          onChange={setPrimaryMsisdn}
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={primaryMutation.isPending}
        >
          <Plus className="h-4 w-4" />
          Add Primary
        </Button>
        {primaryMutation.isError && (
          <p className="text-sm font-medium text-coral">
            {primaryMutation.error.message}
          </p>
        )}
      </form>

      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <TextInput
          label="Status reason"
          value={statusReason}
          onChange={setStatusReason}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate("active")}
          >
            <ShieldCheck className="h-4 w-4" />
            Reactivate
          </Button>
          <Button
            variant="danger"
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate("deactivated")}
          >
            <ShieldOff className="h-4 w-4" />
            Deactivate
          </Button>
        </div>
        {statusMutation.isError && (
          <p className="text-sm font-medium text-coral">
            {statusMutation.error.message}
          </p>
        )}
      </div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <TextField
      label={label}
      required={required}
      type={type}
      value={value}
      onValueChange={onChange}
    />
  );
}

function PhoneInput({
  label,
  value,
  onChange,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <PhoneField
      label={label}
      required={required}
      value={value}
      onValueChange={onChange}
    />
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
