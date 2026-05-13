"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Eye, EyeOff, PackagePlus, Pencil, RotateCcw, Save } from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn, type DataTableRowAction } from "@/components/ui/data-table";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDateTime, formatUgx, sentenceCase } from "@/lib/format";
import type { BundleOffer, BundlePackageRequest, BundleStatus } from "@/types/domain";

type PackageForm = {
  serviceCode: string;
  name: string;
  volumeTb: string;
  priceUgx: string;
  validityDays: string;
  status: BundleStatus;
  visible: boolean;
};

const emptyPackageForm: PackageForm = {
  serviceCode: "",
  name: "",
  volumeTb: "",
  priceUgx: "",
  validityDays: "30",
  status: "active",
  visible: true,
};

const statusOptions: Array<{ label: string; value: BundleStatus }> = [
  { label: "Active", value: "active" },
  { label: "Paused", value: "paused" },
  { label: "Disabled", value: "disabled" },
];

type SummaryPanelTone = "yellow" | "green" | "blue" | "red";
type StatusBadgeTone = "green" | "yellow" | "red" | "blue" | "neutral";

const summaryPanelThemes: Record<
  SummaryPanelTone,
  {
    card: string;
    label: string;
    icon: string;
  }
> = {
  yellow: {
    card: "border-yellow-300/70 bg-yellow-100 text-yellow-950 shadow-yellow-100/60 dark:border-yellow-400/35 dark:bg-yellow-950/45 dark:text-yellow-50",
    label: "text-yellow-950/70 dark:text-yellow-100/75",
    icon: "bg-yellow-300/85 text-yellow-950 dark:bg-yellow-400/20 dark:text-yellow-100",
  },
  green: {
    card: "border-emerald-300/70 bg-emerald-100 text-emerald-950 shadow-emerald-100/60 dark:border-emerald-400/30 dark:bg-emerald-950/45 dark:text-emerald-50",
    label: "text-emerald-950/70 dark:text-emerald-100/75",
    icon: "bg-emerald-300/80 text-emerald-950 dark:bg-emerald-400/20 dark:text-emerald-100",
  },
  blue: {
    card: "border-sky-300/70 bg-sky-100 text-sky-950 shadow-sky-100/60 dark:border-sky-400/30 dark:bg-sky-950/45 dark:text-sky-50",
    label: "text-sky-950/70 dark:text-sky-100/75",
    icon: "bg-sky-300/80 text-sky-950 dark:bg-sky-400/20 dark:text-sky-100",
  },
  red: {
    card: "border-rose-300/70 bg-rose-100 text-rose-950 shadow-rose-100/60 dark:border-rose-400/30 dark:bg-rose-950/45 dark:text-rose-50",
    label: "text-rose-950/70 dark:text-rose-100/75",
    icon: "bg-rose-300/80 text-rose-950 dark:bg-rose-400/20 dark:text-rose-100",
  },
};

function toPackageForm(bundle: BundleOffer): PackageForm {
  return {
    serviceCode: bundle.serviceCode,
    name: bundle.name,
    volumeTb: String(bundle.volumeTb),
    priceUgx: String(bundle.priceUgx),
    validityDays: String(bundle.validityDays),
    status: bundle.status,
    visible: bundle.visible,
  };
}

function toPackagePayload(form: PackageForm): BundlePackageRequest {
  return {
    serviceCode: form.serviceCode,
    name: form.name,
    volumeTb: Number(form.volumeTb),
    priceUgx: Number(form.priceUgx),
    validityDays: Number(form.validityDays),
    status: form.status,
    visible: form.visible,
  };
}

function statusTone(status: BundleStatus) {
  if (status === "active") {
    return "green" as const;
  }

  if (status === "disabled") {
    return "red" as const;
  }

  return "yellow" as const;
}

export function PackageManagementPage() {
  const queryClient = useQueryClient();
  const packagesQuery = useQuery({ queryKey: ["bundle-packages"], queryFn: api.bundlePackages });
  const [editingPackageId, setEditingPackageId] = useState("");
  const [form, setForm] = useState<PackageForm>(emptyPackageForm);

  const selectedPackage = useMemo(
    () => packagesQuery.data?.find((bundle) => bundle.id === editingPackageId),
    [editingPackageId, packagesQuery.data],
  );

  const summary = useMemo(() => {
    const packages = packagesQuery.data ?? [];

    return {
      total: packages.length,
      activeVisible: packages.filter((bundle) => bundle.status === "active" && bundle.visible).length,
      hidden: packages.filter((bundle) => !bundle.visible).length,
      disabled: packages.filter((bundle) => bundle.status === "disabled").length,
    };
  }, [packagesQuery.data]);

  const invalidatePackages = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["bundle-packages"] }),
      queryClient.invalidateQueries({ queryKey: ["bundles"] }),
      queryClient.invalidateQueries({ queryKey: ["overview"] }),
      queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: api.createBundlePackage,
    onSuccess: async () => {
      resetForm();
      await invalidatePackages();
    },
  });
  const updateMutation = useMutation({
    mutationFn: (payload: BundlePackageRequest) => api.updateBundlePackage(editingPackageId, payload),
    onSuccess: async () => {
      await invalidatePackages();
    },
  });
  const quickUpdateMutation = useMutation({
    mutationFn: ({ bundleId, payload }: { bundleId: string; payload: Partial<BundlePackageRequest> }) =>
      api.updateBundlePackage(bundleId, payload),
    onSuccess: invalidatePackages,
  });

  const packageColumns: Array<DataTableColumn<BundleOffer>> = [
    {
      id: "package",
      header: "Package",
      exportValue: (bundle) => `${bundle.name} (${bundle.serviceCode})`,
      cell: (bundle) => (
        <div>
          <p className="font-medium">{bundle.name}</p>
          <p className="text-xs text-[var(--muted)]">{bundle.serviceCode}</p>
        </div>
      ),
    },
    {
      id: "volume",
      header: "Volume",
      exportValue: (bundle) => `${bundle.volumeTb} TB`,
      cell: (bundle) => `${bundle.volumeTb} TB`,
    },
    {
      id: "price",
      header: "Price",
      exportValue: (bundle) => formatUgx(bundle.priceUgx),
      cell: (bundle) => formatUgx(bundle.priceUgx),
    },
    {
      id: "validity",
      header: "Validity",
      exportValue: (bundle) => `${bundle.validityDays} days`,
      cell: (bundle) => `${bundle.validityDays} days`,
    },
    {
      id: "visibility",
      header: "Visibility",
      exportValue: (bundle) => (bundle.visible ? "Visible" : "Hidden"),
      cell: (bundle) => (
        <StatusBadge label={bundle.visible ? "Visible" : "Hidden"} tone={bundle.visible ? "blue" : "neutral"} />
      ),
    },
    {
      id: "status",
      header: "Status",
      exportValue: (bundle) => sentenceCase(bundle.status),
      cell: (bundle) => <StatusBadge label={sentenceCase(bundle.status)} tone={statusTone(bundle.status)} />,
    },
    {
      id: "updatedAt",
      header: "Updated",
      exportValue: (bundle) => formatDateTime(bundle.updatedAt),
      cell: (bundle) => formatDateTime(bundle.updatedAt),
    },
  ];

  function resolvePackageRowActions(bundle: BundleOffer): Array<DataTableRowAction<BundleOffer>> {
    return [
      {
        id: "edit-package",
        label: "Edit details",
        icon: Pencil,
        onSelect: () => {
          setEditingPackageId(bundle.id);
          setForm(toPackageForm(bundle));
        },
      },
      {
        id: "toggle-visibility",
        label: bundle.visible ? "Hide package" : "Show package",
        icon: bundle.visible ? EyeOff : Eye,
        disabled: quickUpdateMutation.isPending,
        onSelect: () => {
          quickUpdateMutation.mutate({
            bundleId: bundle.id,
            payload: { visible: !bundle.visible },
          });
        },
      },
      {
        id: "toggle-disabled",
        label: bundle.status === "disabled" ? "Enable package" : "Disable package",
        icon: bundle.status === "disabled" ? CheckCircle2 : Ban,
        variant: bundle.status === "disabled" ? "default" : "destructive",
        disabled: quickUpdateMutation.isPending,
        onSelect: () => {
          quickUpdateMutation.mutate({
            bundleId: bundle.id,
            payload: { status: bundle.status === "disabled" ? "active" : "disabled" },
          });
        },
      },
    ];
  }

  function updateField<Key extends keyof PackageForm>(key: Key, value: PackageForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setEditingPackageId("");
    setForm(emptyPackageForm);
  }

  if (packagesQuery.isLoading) {
    return <Panel>Loading package management...</Panel>;
  }

  if (packagesQuery.isError || !packagesQuery.data) {
    return <Panel>Package management could not be loaded.</Panel>;
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Package Management</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Configure wholesale bundle packages, customer visibility, and purchasing availability.
          </p>
        </div>
        {selectedPackage && <StatusBadge label={`Editing ${selectedPackage.serviceCode}`} tone="blue" />}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryPanel label="Total packages" value={summary.total} badgeLabel="Catalog" badgeTone="blue" tone="yellow" icon={PackagePlus} />
        <SummaryPanel label="Visible active" value={summary.activeVisible} badgeLabel="Purchasable" badgeTone="green" tone="green" icon={CheckCircle2} />
        <SummaryPanel label="Hidden" value={summary.hidden} badgeLabel="Hidden" badgeTone="neutral" tone="blue" icon={EyeOff} />
        <SummaryPanel label="Disabled" value={summary.disabled} badgeLabel="Blocked" badgeTone="red" tone="red" icon={Ban} />
      </div>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{editingPackageId ? "Edit Package" : "Add Package"}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Changes affect package availability in customer purchase flows.
            </p>
          </div>
          {createMutation.isSuccess && !editingPackageId && <StatusBadge label="Created" tone="green" />}
          {updateMutation.isSuccess && editingPackageId && <StatusBadge label="Updated" tone="green" />}
        </div>

        <form
          className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            const payload = toPackagePayload(form);

            if (editingPackageId) {
              updateMutation.mutate(payload);
              return;
            }

            createMutation.mutate(payload);
          }}
        >
          <TextField
            label="Package name"
            required
            value={form.name}
            onValueChange={(value) => updateField("name", value)}
          />
          <TextField
            label="Service code"
            required
            value={form.serviceCode}
            onValueChange={(value) => updateField("serviceCode", value)}
          />
          <TextField
            label="Volume (TB)"
            required
            min={0.01}
            max={4}
            step={0.01}
            type="number"
            value={form.volumeTb}
            onValueChange={(value) => updateField("volumeTb", value)}
          />
          <TextField
            label="Price (UGX)"
            required
            min={1}
            step={1000}
            type="number"
            value={form.priceUgx}
            onValueChange={(value) => updateField("priceUgx", value)}
          />
          <TextField
            label="Validity (days)"
            required
            min={1}
            max={365}
            type="number"
            value={form.validityDays}
            onValueChange={(value) => updateField("validityDays", value)}
          />
          <SelectField
            label="Status"
            required
            value={form.status}
            onValueChange={(value) => updateField("status", value as BundleStatus)}
            options={statusOptions}
          />

          <Label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm font-medium md:col-span-2 xl:col-span-2">
            Visible to customers
            <Switch
              checked={form.visible}
              onCheckedChange={(checked) => updateField("visible", checked)}
              aria-label="Visible to customers"
            />
          </Label>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] pt-4 md:col-span-2 xl:col-span-6">
            {(createMutation.isError || updateMutation.isError) && (
              <p className="mr-auto text-sm font-medium text-coral">
                {createMutation.error?.message ?? updateMutation.error?.message}
              </p>
            )}
            <Button type="button" variant="secondary" onClick={resetForm}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {editingPackageId ? <Save className="h-4 w-4" /> : <PackagePlus className="h-4 w-4" />}
              {isSaving ? "Saving..." : editingPackageId ? "Save Package" : "Add Package"}
            </Button>
          </div>
        </form>
      </Panel>

      <Panel>
        <DataTable
          columns={packageColumns}
          rows={packagesQuery.data}
          getRowKey={(bundle) => bundle.id}
          minWidth={920}
          exportOptions={{
            title: "Package Management",
            filename: "package-management",
          }}
          rowActions={resolvePackageRowActions}
        />
        {quickUpdateMutation.isError && (
          <p className="mt-3 text-sm font-medium text-coral">{quickUpdateMutation.error.message}</p>
        )}
      </Panel>
    </div>
  );
}

function SummaryPanel({
  label,
  value,
  badgeLabel,
  badgeTone = "blue",
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  badgeLabel: string;
  badgeTone?: StatusBadgeTone;
  tone: SummaryPanelTone;
  icon: ComponentType<{ className?: string }>;
}) {
  const theme = summaryPanelThemes[tone];

  return (
    <Panel className={cn("min-h-28 border shadow-sm", theme.card)}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-sm font-medium", theme.label)}>{label}</p>
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-md", theme.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-2xl font-semibold">{value}</p>
        <StatusBadge label={badgeLabel} tone={badgeTone} />
      </div>
    </Panel>
  );
}
