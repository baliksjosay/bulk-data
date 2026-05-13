"use client";

import {
  CalendarClock,
  Database,
  Gauge,
  Loader2,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { formatDateTime, sentenceCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBundleInsightStore } from "@/store/bundle-insight-store";

function formatGb(value: number) {
  return `${value.toLocaleString("en-US")} GB`;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(value, 100));
}

function DetailTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "yellow" | "green" | "blue";
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        tone === "yellow" && "border-yellow-300/70 bg-yellow-100 text-yellow-950 dark:border-yellow-400/30 dark:bg-yellow-950/35 dark:text-yellow-50",
        tone === "green" && "border-emerald-300/70 bg-emerald-100 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-950/35 dark:text-emerald-50",
        tone === "blue" && "border-sky-300/70 bg-sky-100 text-sky-950 dark:border-sky-400/30 dark:bg-sky-950/35 dark:text-sky-50",
        tone === "default" && "border-border/70 bg-[var(--panel-strong)] text-foreground",
      )}
    >
      <p className="text-xs font-semibold uppercase opacity-70">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold">{value}</p>
    </div>
  );
}

function InsightShell({
  children,
  eyebrow,
  icon,
  title,
}: {
  children: ReactNode;
  eyebrow: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border/70">
      <div className="bg-black p-4 text-white">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand text-black">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">{eyebrow}</p>
            <h3 className="mt-1 truncate text-xl font-semibold">{title}</h3>
          </div>
        </div>
      </div>
      <div className="space-y-4 bg-background p-4">{children}</div>
    </div>
  );
}

function LoadingContent() {
  const view = useBundleInsightStore((state) => state.view);
  const requestContext = useBundleInsightStore((state) => state.requestContext);
  const title = view === "balance" ? "Checking bundle balance" : "Checking usage";
  const subtitle =
    view === "balance"
      ? requestContext.primaryMsisdn
      : `${requestContext.secondaryMsisdn ?? ""} linked to ${requestContext.primaryMsisdn ?? ""}`;

  return (
    <InsightShell
      eyebrow="Please wait"
      icon={<Loader2 className="h-5 w-5 animate-spin" />}
      title={title}
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        <Progress value={55} />
      </div>
    </InsightShell>
  );
}

function ErrorContent() {
  const errorMessage = useBundleInsightStore((state) => state.errorMessage);

  return (
    <InsightShell
      eyebrow="Unable to load"
      icon={<TriangleAlert className="h-5 w-5" />}
      title="Balance details unavailable"
    >
      <p className="text-sm text-muted-foreground">
        {errorMessage || "The request could not be completed. Try again from the table action."}
      </p>
    </InsightShell>
  );
}

function BalanceContent() {
  const balance = useBundleInsightStore((state) => state.balance);

  if (!balance) {
    return null;
  }

  const usedVolumeGb = Math.max(balance.totalVolumeGb - balance.remainingVolumeGb, 0);
  const remainingPercent = clampPercent((balance.remainingVolumeGb / balance.totalVolumeGb) * 100);
  const usedPercent = clampPercent((usedVolumeGb / balance.totalVolumeGb) * 100);

  return (
    <InsightShell
      eyebrow="Bundle balance"
      icon={<Database className="h-5 w-5" />}
      title={balance.primaryMsisdn}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{balance.bundleName}</Badge>
        <Badge className="bg-brand text-black hover:bg-brand">Primary line</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <DetailTile label="Remaining" value={formatGb(balance.remainingVolumeGb)} tone="green" />
        <DetailTile label="Used" value={formatGb(usedVolumeGb)} tone="yellow" />
        <DetailTile label="Total" value={formatGb(balance.totalVolumeGb)} tone="blue" />
      </div>

      <div className="space-y-2 rounded-md border border-border/70 bg-[var(--panel-strong)] p-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Remaining volume</span>
          <span className="text-muted-foreground">{remainingPercent.toFixed(0)}%</span>
        </div>
        <Progress value={remainingPercent} />
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{usedPercent.toFixed(0)}% used</span>
          <span>{formatGb(balance.remainingVolumeGb)} available</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border/70 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Expiry
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(balance.expiryAt)}</p>
        </div>
        <div className="rounded-md border border-border/70 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            Auto top-ups left
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{balance.autoTopupRemaining}</p>
        </div>
      </div>
    </InsightShell>
  );
}

function UsageContent() {
  const usage = useBundleInsightStore((state) => state.usage);

  if (!usage) {
    return null;
  }

  return (
    <InsightShell
      eyebrow="Secondary usage"
      icon={<Smartphone className="h-5 w-5" />}
      title={usage.secondaryMsisdn}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{usage.bundleName}</Badge>
        <Badge variant={usage.status === "active" ? "default" : "secondary"}>
          {sentenceCase(usage.status)}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <DetailTile label="Allocated" value={formatGb(usage.allocatedVolumeGb)} tone="blue" />
        <DetailTile label="Used" value={formatGb(usage.usedVolumeGb)} tone="yellow" />
        <DetailTile label="Remaining" value={formatGb(usage.remainingVolumeGb)} tone="green" />
      </div>

      <div className="space-y-2 rounded-md border border-border/70 bg-[var(--panel-strong)] p-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Usage</span>
          <span className="text-muted-foreground">{usage.usagePercent}%</span>
        </div>
        <Progress value={clampPercent(usage.usagePercent)} />
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{formatGb(usage.usedVolumeGb)} used</span>
          <span>{formatGb(usage.remainingVolumeGb)} left</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border/70 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Database className="h-4 w-4 text-muted-foreground" />
            Primary MSISDN
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{usage.primaryMsisdn}</p>
        </div>
        <div className="rounded-md border border-border/70 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Last used
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(usage.lastUsedAt)}</p>
        </div>
      </div>
    </InsightShell>
  );
}

export function BundleInsightDialog() {
  const open = useBundleInsightStore((state) => state.open);
  const status = useBundleInsightStore((state) => state.status);
  const view = useBundleInsightStore((state) => state.view);
  const close = useBundleInsightStore((state) => state.close);
  const title = view === "balance" ? "Bundle Balance" : "Bundle Usage";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Bundle balance and usage details.</DialogDescription>
        </DialogHeader>
        <div className="p-4 sm:p-5">
          {status === "loading" && <LoadingContent />}
          {status === "error" && <ErrorContent />}
          {status === "ready" && view === "balance" && <BalanceContent />}
          {status === "ready" && view === "usage" && <UsageContent />}
        </div>
        <DialogFooter className="border-t border-border/70 px-4 py-3 sm:px-5">
          <Button type="button" variant="outline" onClick={close}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
