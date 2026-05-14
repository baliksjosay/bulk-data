"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  Eye,
  EyeOff,
  PackagePlus,
  Pencil,
  RotateCcw,
  Save,
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  type DataTableColumn,
  type DataTableRowAction,
} from "@/components/ui/data-table";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDateTime, formatUgx, sentenceCase } from "@/lib/format";
import type {
  BundleOffer,
  BundlePackageRequest,
  BundleStatus,
} from "@/types/domain";

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
    detail: string;
    icon: string;
  }
> = {
  yellow: {
    card: "bg-[linear-gradient(135deg,#fff8db_0%,#ffffff_58%,#f7fbff_100%)] text-zinc-900 shadow-[0_18px_42px_rgba(223,169,25,0.16)] dark:bg-[linear-gradient(135deg,rgba(255,215,106,0.16)_0%,rgba(255,255,255,0.05)_64%,rgba(139,211,247,0.08)_100%)] dark:text-yellow-50 dark:shadow-black/30",
    label: "text-zinc-600 dark:text-yellow-100/75",
    detail: "text-zinc-500 dark:text-yellow-100/70",
    icon: "bg-yellow-200/85 text-yellow-900 dark:bg-yellow-300/[0.18] dark:text-yellow-100",
  },
  green: {
    card: "bg-[linear-gradient(135deg,#edfff5_0%,#ffffff_58%,#f7fbff_100%)] text-zinc-900 shadow-[0_18px_42px_rgba(67,174,119,0.14)] dark:bg-[linear-gradient(135deg,rgba(142,230,183,0.15)_0%,rgba(255,255,255,0.05)_64%,rgba(139,211,247,0.08)_100%)] dark:text-emerald-50 dark:shadow-black/30",
    label: "text-zinc-600 dark:text-emerald-100/75",
    detail: "text-zinc-500 dark:text-emerald-100/70",
    icon: "bg-emerald-100 text-emerald-800 dark:bg-emerald-300/[0.16] dark:text-emerald-100",
  },
  blue: {
    card: "bg-[linear-gradient(135deg,#edf8ff_0%,#ffffff_58%,#fff8e8_100%)] text-zinc-900 shadow-[0_18px_42px_rgba(77,154,201,0.15)] dark:bg-[linear-gradient(135deg,rgba(139,211,247,0.16)_0%,rgba(255,255,255,0.05)_64%,rgba(255,215,106,0.08)_100%)] dark:text-sky-50 dark:shadow-black/30",
    label: "text-zinc-600 dark:text-sky-100/75",
    detail: "text-zinc-500 dark:text-sky-100/70",
    icon: "bg-sky-100 text-sky-800 dark:bg-sky-300/[0.16] dark:text-sky-100",
  },
  red: {
    card: "bg-[linear-gradient(135deg,#fff0f0_0%,#ffffff_58%,#fff8e8_100%)] text-zinc-900 shadow-[0_18px_42px_rgba(217,111,111,0.14)] dark:bg-[linear-gradient(135deg,rgba(246,162,162,0.15)_0%,rgba(255,255,255,0.05)_64%,rgba(255,215,106,0.08)_100%)] dark:text-rose-50 dark:shadow-black/30",
    label: "text-zinc-600 dark:text-rose-100/75",
    detail: "text-zinc-500 dark:text-rose-100/70",
    icon: "bg-rose-100 text-rose-800 dark:bg-rose-300/[0.16] dark:text-rose-100",
  },
};

const packageCardClass =
  "border-0 bg-white/[0.88] shadow-[0_14px_36px_rgba(18,24,40,0.07)] dark:bg-white/[0.045] dark:shadow-black/25";

const packageStatCardClass =
  "border-0 shadow-[0_18px_42px_rgba(15,23,42,0.1)] dark:shadow-black/35";

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
    serviceCode: form.serviceCode.trim().toUpperCase(),
    name: form.name.trim(),
    volumeTb: Number(form.volumeTb),
    priceUgx: Number(form.priceUgx),
    validityDays: Number(form.validityDays),
    status: form.status,
    visible: form.visible,
  };
}

function validatePackagePayload(payload: BundlePackageRequest): string {
  if (!payload.name) {
    return "Package name is required.";
  }

  if (!payload.serviceCode) {
    return "Service code is required.";
  }

  if (
    !Number.isFinite(payload.volumeTb) ||
    payload.volumeTb < 0.01 ||
    payload.volumeTb > 4
  ) {
    return "Volume must be between 0.01 TB and 4 TB.";
  }

  if (!Number.isInteger(payload.priceUgx) || payload.priceUgx < 1) {
    return "Price must be a whole UGX amount greater than zero.";
  }

  if (
    !Number.isInteger(payload.validityDays) ||
    payload.validityDays < 1 ||
    payload.validityDays > 365
  ) {
    return "Validity must be between 1 and 365 days.";
  }

  return "";
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
  const packagesQuery = useQuery({
    queryKey: ["bundle-packages"],
    queryFn: api.bundlePackages,
  });
  const [editingPackageId, setEditingPackageId] = useState("");
  const [form, setForm] = useState<PackageForm>(emptyPackageForm);
  const [formError, setFormError] = useState("");

  const selectedPackage = useMemo(
    () => packagesQuery.data?.find((bundle) => bundle.id === editingPackageId),
    [editingPackageId, packagesQuery.data],
  );

  const summary = useMemo(() => {
    const packages = packagesQuery.data ?? [];

    return {
      total: packages.length,
      activeVisible: packages.filter(
        (bundle) => bundle.status === "active" && bundle.visible,
      ).length,
      hidden: packages.filter((bundle) => !bundle.visible).length,
      disabled: packages.filter((bundle) => bundle.status === "disabled")
        .length,
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
    mutationFn: (payload: BundlePackageRequest) =>
      api.updateBundlePackage(editingPackageId, payload),
    onSuccess: async () => {
      await invalidatePackages();
    },
  });
  const quickUpdateMutation = useMutation({
    mutationFn: ({
      bundleId,
      payload,
    }: {
      bundleId: string;
      payload: Partial<BundlePackageRequest>;
    }) => api.updateBundlePackage(bundleId, payload),
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
        <StatusBadge
          label={bundle.visible ? "Visible" : "Hidden"}
          tone={bundle.visible ? "blue" : "neutral"}
        />
      ),
    },
    {
      id: "status",
      header: "Status",
      exportValue: (bundle) => sentenceCase(bundle.status),
      cell: (bundle) => (
        <StatusBadge
          label={sentenceCase(bundle.status)}
          tone={statusTone(bundle.status)}
        />
      ),
    },
    {
      id: "updatedAt",
      header: "Updated",
      exportValue: (bundle) => formatDateTime(bundle.updatedAt),
      cell: (bundle) => formatDateTime(bundle.updatedAt),
    },
  ];

  function resolvePackageRowActions(
    bundle: BundleOffer,
  ): Array<DataTableRowAction<BundleOffer>> {
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
        label:
          bundle.status === "disabled" ? "Enable package" : "Disable package",
        icon: bundle.status === "disabled" ? CheckCircle2 : Ban,
        variant: bundle.status === "disabled" ? "default" : "destructive",
        disabled: quickUpdateMutation.isPending,
        onSelect: () => {
          quickUpdateMutation.mutate({
            bundleId: bundle.id,
            payload: {
              status: bundle.status === "disabled" ? "active" : "disabled",
            },
          });
        },
      },
    ];
  }

  function updateField<Key extends keyof PackageForm>(
    key: Key,
    value: PackageForm[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError("");
  }

  function resetForm() {
    setEditingPackageId("");
    setForm(emptyPackageForm);
    setFormError("");
  }

  if (packagesQuery.isLoading) {
    return (
      <Panel className={packageCardClass}>Loading package management...</Panel>
    );
  }

  if (packagesQuery.isError || !packagesQuery.data) {
    return (
      <Panel className={packageCardClass}>
        Package management could not be loaded.
      </Panel>
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Package Management</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Configure wholesale bundle packages, customer visibility, and
            purchasing availability.
          </p>
        </div>
        {selectedPackage && (
          <StatusBadge
            label={`Editing ${selectedPackage.serviceCode}`}
            tone="blue"
          />
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryPanel
          label="Total packages"
          value={summary.total}
          detail="Configured wholesale bundles"
          badgeLabel="Catalog"
          badgeTone="blue"
          tone="yellow"
          icon={PackagePlus}
        />
        <SummaryPanel
          label="Visible active"
          value={summary.activeVisible}
          detail="Available for customer purchase"
          badgeLabel="Purchasable"
          badgeTone="green"
          tone="green"
          icon={CheckCircle2}
        />
        <SummaryPanel
          label="Hidden"
          value={summary.hidden}
          detail="Kept out of customer journeys"
          badgeLabel="Hidden"
          badgeTone="neutral"
          tone="blue"
          icon={EyeOff}
        />
        <SummaryPanel
          label="Disabled"
          value={summary.disabled}
          detail="Blocked from new purchases"
          badgeLabel="Blocked"
          badgeTone="red"
          tone="red"
          icon={Ban}
        />
      </div>

      <Panel className={packageCardClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">
              {editingPackageId ? "Edit Package" : "Add Package"}
            </h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Changes affect package availability in customer purchase flows.
            </p>
          </div>
          {createMutation.isSuccess && !editingPackageId && (
            <StatusBadge label="Created" tone="green" />
          )}
          {updateMutation.isSuccess && editingPackageId && (
            <StatusBadge label="Updated" tone="green" />
          )}
        </div>

        <form
          className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6"
          onSubmit={(event) => {
            event.preventDefault();
            const payload = toPackagePayload(form);
            const validationMessage = validatePackagePayload(payload);

            if (validationMessage) {
              setFormError(validationMessage);
              return;
            }

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
            onValueChange={(value) =>
              updateField("status", value as BundleStatus)
            }
            options={statusOptions}
          />

          <Label className="flex min-h-10 items-center justify-between gap-3 rounded-md bg-[var(--muted-surface)]/75 px-3 py-2 text-sm font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)] dark:bg-white/[0.045] dark:shadow-none md:col-span-2 xl:col-span-2">
            Visible to customers
            <Switch
              checked={form.visible}
              onCheckedChange={(checked) => updateField("visible", checked)}
              aria-label="Visible to customers"
            />
          </Label>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)]/70 pt-4 md:col-span-2 xl:col-span-6">
            {(formError ||
              createMutation.isError ||
              updateMutation.isError) && (
              <p className="mr-auto text-sm font-medium text-coral">
                {formError ||
                  createMutation.error?.message ||
                  updateMutation.error?.message}
              </p>
            )}
            <Button type="button" variant="secondary" onClick={resetForm}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              {editingPackageId ? (
                <Save className="h-4 w-4" />
              ) : (
                <PackagePlus className="h-4 w-4" />
              )}
              {isSaving
                ? "Saving..."
                : editingPackageId
                  ? "Save Package"
                  : "Add Package"}
            </Button>
          </div>
        </form>
      </Panel>

      <Panel className={packageCardClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Package Catalog</h3>
            <p className="text-sm text-[var(--muted)]">
              Price, volume, visibility, and provisioning service code.
            </p>
          </div>
          {quickUpdateMutation.isPending && (
            <StatusBadge label="Updating" tone="blue" />
          )}
        </div>
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
          <p className="mt-3 text-sm font-medium text-coral">
            {quickUpdateMutation.error.message}
          </p>
        )}
      </Panel>
    </div>
  );
}

function SummaryPanel({
  label,
  value,
  detail,
  badgeLabel,
  badgeTone = "blue",
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  badgeLabel: string;
  badgeTone?: StatusBadgeTone;
  tone: SummaryPanelTone;
  icon: ComponentType<{ className?: string }>;
}) {
  const theme = summaryPanelThemes[tone];

  return (
    <Panel className={cn("min-h-32", packageStatCardClass, theme.card)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={cn("text-sm font-medium", theme.label)}>{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <div
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-md",
            theme.icon,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className={cn("text-sm font-medium", theme.detail)}>{detail}</p>
        <StatusBadge label={badgeLabel} tone={badgeTone} />
      </div>
    </Panel>
  );
}
