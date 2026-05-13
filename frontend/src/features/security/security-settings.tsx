"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Laptop,
  Plus,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle";
import { api } from "@/lib/api-client";
import { formatDateTime, sentenceCase } from "@/lib/format";
import { registerPasskey } from "@/lib/webauthn";
import type { MfaConfiguration, MfaService, TotpEnrollment } from "@/types/domain";

function serviceIcon(serviceId: MfaService["id"]) {
  if (serviceId === "webauthn") {
    return KeyRound;
  }

  if (serviceId === "sms_otp" || serviceId === "email_otp") {
    return Smartphone;
  }

  return ShieldCheck;
}

const recoveryCodeClassName =
  "rounded-md border border-border/70 bg-[var(--panel-strong)] px-2.5 py-1.5 font-mono text-sm font-semibold text-[var(--foreground)] shadow-xs dark:border-white/10 dark:bg-white/10 dark:text-white";

export function SecuritySettings() {
  const queryClient = useQueryClient();
  const [passkeyLabel, setPasskeyLabel] = useState("Security key");
  const [totpAppLabel, setTotpAppLabel] = useState("Microsoft Authenticator");
  const [totpCode, setTotpCode] = useState("");
  const [copiedTotpValue, setCopiedTotpValue] = useState("");
  const mfaQuery = useQuery({
    queryKey: ["mfa-configuration"],
    queryFn: api.mfaConfiguration,
  });
  const totpAppsQuery = useQuery({
    queryKey: ["totp-authenticator-apps"],
    queryFn: api.totpAuthenticatorApps,
  });
  const devicesQuery = useQuery({
    queryKey: ["webauthn-devices"],
    queryFn: api.webAuthnDevices,
  });
  const sessionsQuery = useQuery({
    queryKey: ["auth-sessions"],
    queryFn: api.authSessions,
  });

  const updateMfaMutation = useMutation({
    mutationFn: api.updateMfaConfiguration,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mfa-configuration"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
      ]);
    },
  });

  const registerPasskeyMutation = useMutation({
    mutationFn: registerPasskey,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["webauthn-devices"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
      ]);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: api.revokeWebAuthnDevice,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["webauthn-devices"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
      ]);
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: api.revokeAuthSession,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["auth-sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
      ]);
    },
  });

  const startTotpMutation = useMutation({
    mutationFn: api.startTotpEnrollment,
    onSuccess: async () => {
      setTotpCode("");
      await queryClient.invalidateQueries({ queryKey: ["audit-events"] });
    },
  });

  const verifyTotpMutation = useMutation({
    mutationFn: () => {
      if (!startTotpMutation.data) {
        throw new Error("Start enrollment before verification.");
      }

      return api.verifyTotpEnrollment({
        enrollmentId: startTotpMutation.data.id,
        code: totpCode,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["mfa-configuration"] }),
        queryClient.invalidateQueries({ queryKey: ["totp-authenticator-apps"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
      ]);
    },
  });

  if (mfaQuery.isLoading || totpAppsQuery.isLoading || devicesQuery.isLoading || sessionsQuery.isLoading) {
    return <Panel>Loading security configuration...</Panel>;
  }

  if (
    mfaQuery.isError ||
    totpAppsQuery.isError ||
    devicesQuery.isError ||
    sessionsQuery.isError ||
    !mfaQuery.data ||
    !totpAppsQuery.data ||
    !devicesQuery.data ||
    !sessionsQuery.data
  ) {
    return <Panel>Security configuration could not be loaded.</Panel>;
  }

  const configuration = mfaQuery.data;
  const totpEnrollment = startTotpMutation.data;
  const totpVerification = verifyTotpMutation.data;
  const totpStep = totpVerification ? 3 : totpEnrollment ? 2 : 1;
  const hasTotpApps = totpAppsQuery.data.some((app) => app.status === "active");

  function updateService(serviceId: MfaService["id"], patch: Partial<MfaService>) {
    const nextConfiguration: MfaConfiguration = {
      ...configuration,
      services: configuration.services.map((service) =>
        service.id === serviceId ? { ...service, ...patch } : service,
      ),
    };

    updateMfaMutation.mutate(nextConfiguration);
  }

  function updateConfiguration(patch: Partial<MfaConfiguration>) {
    updateMfaMutation.mutate({
      ...configuration,
      ...patch,
    });
  }

  async function copyTotpValue(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopiedTotpValue(label);
    window.setTimeout(() => {
      setCopiedTotpValue((current) => (current === label ? "" : current));
    }, 1600);
  }

  function downloadRecoveryCodes(enrollment: TotpEnrollment) {
    const blob = new Blob(
      [
        [
          "MTN Bulk Data Wholesale recovery codes",
          `Authenticator app: ${enrollment.label}`,
          `Generated: ${new Date().toISOString()}`,
          "",
          ...enrollment.recoveryCodes,
          "",
          "Store these codes securely. Each code should be treated like a password.",
        ].join("\n"),
      ],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `${enrollment.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-recovery-codes.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Security</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          MFA services, step-up policies, trusted devices, and passkeys.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">MFA Services</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">Service-level controls by account type.</p>
            </div>
            {updateMfaMutation.isPending && <StatusBadge label="Saving" tone="yellow" />}
          </div>

          <div className="mt-4 grid gap-3">
            {configuration.services.map((service) => {
              const Icon = serviceIcon(service.id);

              return (
                <div
                  key={service.id}
                  className="grid gap-3 rounded-md border border-[var(--border)] p-3 md:grid-cols-[1fr_auto_auto_auto]"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-md bg-[var(--panel-strong)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{service.label}</p>
                      <p className="text-xs text-[var(--muted)]">
                        Updated {formatDateTime(service.lastUpdatedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 md:min-w-32">
                    <span className="text-sm text-[var(--muted)]">Enabled</span>
                    <Toggle
                      checked={service.enabled}
                      label={`${service.label} enabled`}
                      onChange={(checked) => updateService(service.id, { enabled: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 md:min-w-32">
                    <span className="text-sm text-[var(--muted)]">Admins</span>
                    <Toggle
                      checked={service.requiredForAdmins}
                      label={`${service.label} required for admins`}
                      onChange={(checked) =>
                        updateService(service.id, { requiredForAdmins: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 md:min-w-32">
                    <span className="text-sm text-[var(--muted)]">Customers</span>
                    <Toggle
                      checked={service.requiredForCustomers}
                      label={`${service.label} required for customers`}
                      onChange={(checked) =>
                        updateService(service.id, { requiredForCustomers: checked })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="space-y-4">
          <h3 className="font-semibold">Policy</h3>
          <TextField
            label="Trusted device days"
            min={0}
            max={90}
            type="number"
            value={configuration.trustedDeviceDays}
            onValueChange={(value) => updateConfiguration({ trustedDeviceDays: Number(value) })}
          />

          <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] p-3">
            <span className="text-sm font-medium">Bundle purchase step-up</span>
            <Toggle
              checked={configuration.stepUpForBundlePurchases}
              label="Bundle purchase step-up"
              onChange={(checked) => updateConfiguration({ stepUpForBundlePurchases: checked })}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] p-3">
            <span className="text-sm font-medium">Secondary number step-up</span>
            <Toggle
              checked={configuration.stepUpForSecondaryNumberChanges}
              label="Secondary number step-up"
              onChange={(checked) =>
                updateConfiguration({ stepUpForSecondaryNumberChanges: checked })
              }
            />
          </div>

          {updateMfaMutation.isSuccess && (
            <p className="text-sm font-medium text-forest">Security policy saved.</p>
          )}
          {updateMfaMutation.isError && (
            <p className="text-sm font-medium text-coral">{updateMfaMutation.error.message}</p>
          )}
        </Panel>
      </div>

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Authenticator App Enrollment</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Google Authenticator, Microsoft Authenticator, and compatible TOTP apps.
            </p>
          </div>
          <StatusBadge
            label={hasTotpApps ? `${totpAppsQuery.data.length} app${totpAppsQuery.data.length === 1 ? "" : "s"}` : "Setup"}
            tone={hasTotpApps ? "green" : "blue"}
          />
        </div>

        {totpAppsQuery.data.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {totpAppsQuery.data.map((app) => (
              <div key={app.id} className="rounded-md border border-[var(--border)] bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{app.label}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{app.accountName}</p>
                  </div>
                  <StatusBadge label={sentenceCase(app.status)} tone={app.status === "active" ? "green" : "red"} />
                </div>
                <p className="mt-3 text-xs text-[var(--muted)]">
                  Enrolled {formatDateTime(app.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          {[
            { step: 1, title: "Prepare", description: "Name the app and save recovery codes." },
            { step: 2, title: "Scan", description: "Scan QR, copy URL, or enter manual key." },
            { step: 3, title: "Verify", description: "Confirm the six-digit code." },
          ].map((item) => (
            <div
              key={item.step}
              className={`rounded-md border p-3 ${
                totpStep >= item.step
                  ? "border-primary/40 bg-primary/5"
                  : "border-[var(--border)] bg-[var(--panel-strong)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {item.step}
                </span>
                <p className="font-medium">{item.title}</p>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{item.description}</p>
            </div>
          ))}
        </div>

        {totpStep === 1 && (
          <div className="grid gap-4 rounded-md border border-[var(--border)] p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="font-medium">Authenticator setup is ready to start.</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                You can enroll several authenticator apps. Each setup gets its own QR code, manual key, and recovery codes.
              </p>
              <TextField
                label="App name"
                value={totpAppLabel}
                className="mt-3"
                onValueChange={setTotpAppLabel}
              />
            </div>
            <Button
              type="button"
              variant="primary"
              disabled={startTotpMutation.isPending}
              onClick={() => {
                verifyTotpMutation.reset();
                setCopiedTotpValue("");
                startTotpMutation.mutate({ label: totpAppLabel });
              }}
            >
              <Plus className="h-4 w-4" />
              {startTotpMutation.isPending ? "Starting..." : "Add Authenticator App"}
            </Button>
          </div>
        )}

        {totpStep >= 2 && totpEnrollment && (
          <div className="grid gap-4">
            <div className="rounded-md border border-[var(--border)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">Recovery codes</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Save these before scanning. Treat them like passwords.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void copyTotpValue(totpEnrollment.recoveryCodes.join("\n"), "recovery-codes");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                    {copiedTotpValue === "recovery-codes" ? "Copied" : "Copy codes"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadRecoveryCodes(totpEnrollment)}
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {totpEnrollment.recoveryCodes.map((code) => (
                  <code key={code} className={recoveryCodeClassName}>
                    {code}
                  </code>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
              <div className="rounded-md border border-[var(--border)] bg-white p-4">
                <Image
                  src={totpEnrollment.qrCodeDataUrl}
                  alt="Authenticator QR code"
                  width={240}
                  height={240}
                  unoptimized
                  className="mx-auto aspect-square w-full max-w-52 rounded-md"
                />
              </div>
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-[var(--border)] p-3">
                    <p className="text-xs font-semibold uppercase text-[var(--muted)]">App</p>
                    <p className="mt-1 font-medium">{totpEnrollment.label}</p>
                  </div>
                  <div className="rounded-md border border-[var(--border)] p-3">
                    <p className="text-xs font-semibold uppercase text-[var(--muted)]">Account</p>
                    <p className="mt-1 font-medium">{totpEnrollment.accountName}</p>
                  </div>
                </div>
                <div className="rounded-md border border-[var(--border)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase text-[var(--muted)]">Setup URL</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        void copyTotpValue(totpEnrollment.otpauthUrl, "setup-url");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                      {copiedTotpValue === "setup-url" ? "Copied" : "Copy URL"}
                    </Button>
                  </div>
                  <p className="mt-2 break-all font-mono text-xs">{totpEnrollment.otpauthUrl}</p>
                </div>
                <div className="rounded-md border border-[var(--border)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase text-[var(--muted)]">Manual key</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        void copyTotpValue(totpEnrollment.secret, "manual-key");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                      {copiedTotpValue === "manual-key" ? "Copied" : "Copy key"}
                    </Button>
                  </div>
                  <p className="mt-2 break-all font-mono text-sm">{totpEnrollment.secret}</p>
                </div>
              <form
                className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_auto] sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  verifyTotpMutation.mutate();
                }}
              >
                <TextField
                  label="Verification code"
                  value={totpCode}
                  inputMode="numeric"
                  maxLength={6}
                  pattern="\\d{6}"
                  onValueChange={(value) => setTotpCode(value.replace(/\D/g, "").slice(0, 6))}
                />
                <Button
                  type="submit"
                  variant="primary"
                  className="h-10"
                  disabled={verifyTotpMutation.isPending || totpCode.length !== 6}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {verifyTotpMutation.isPending ? "Verifying..." : "Verify Code"}
                </Button>
              </form>
              <p className="text-xs text-[var(--muted)]">
                Expires {formatDateTime(totpEnrollment.expiresAt)}
              </p>
              </div>
            </div>
          </div>
        )}

        {totpVerification && (
          <div className="rounded-md border border-green-200 bg-green-50 p-4 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              Authenticator app enrolled
            </div>
            <p className="mt-2 text-sm">
              {totpVerification.app.label} is now active. Recovery codes are shown below for your records.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {totpVerification.recoveryCodes.map((code) => (
                <code key={code} className={recoveryCodeClassName}>
                  {code}
                </code>
              ))}
            </div>
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  startTotpMutation.reset();
                  verifyTotpMutation.reset();
                  setTotpCode("");
                  setCopiedTotpValue("");
                }}
              >
                <Plus className="h-4 w-4" />
                Enroll another app
              </Button>
            </div>
          </div>
        )}

        {startTotpMutation.isError && (
          <p className="text-sm font-medium text-coral">{startTotpMutation.error.message}</p>
        )}
        {verifyTotpMutation.isError && (
          <p className="text-sm font-medium text-coral">{verifyTotpMutation.error.message}</p>
        )}
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Sessions</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">Current and recent sign-in sessions.</p>
          </div>
          {revokeSessionMutation.isPending && <StatusBadge label="Revoking" tone="yellow" />}
        </div>

        <div className="mt-4">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow className="text-left text-xs uppercase text-foreground hover:bg-transparent">
                <TableHead className="py-3 pr-4 font-semibold">Device</TableHead>
                <TableHead className="py-3 pr-4 font-semibold">Browser</TableHead>
                <TableHead className="py-3 pr-4 font-semibold">Location</TableHead>
                <TableHead className="py-3 pr-4 font-semibold">Last active</TableHead>
                <TableHead className="py-3 pr-4 font-semibold">Status</TableHead>
                <TableHead className="py-3 font-semibold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessionsQuery.data.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <Laptop className="h-4 w-4 text-[var(--muted)]" />
                      <div>
                        <p className="font-medium">{session.device}</p>
                        <p className="text-xs text-[var(--muted)]">{session.ipAddress}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 pr-4">{session.browser}</TableCell>
                  <TableCell className="py-3 pr-4">{session.location}</TableCell>
                  <TableCell className="py-3 pr-4">{formatDateTime(session.lastActiveAt)}</TableCell>
                  <TableCell className="py-3 pr-4">
                    <StatusBadge
                      label={session.current ? "Current" : sentenceCase(session.status)}
                      tone={session.status === "active" ? "green" : "red"}
                    />
                  </TableCell>
                  <TableCell className="py-3">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      title="Revoke session"
                      aria-label={`Revoke ${session.device} session`}
                      disabled={
                        session.current ||
                        session.status === "revoked" ||
                        revokeSessionMutation.isPending
                      }
                      onClick={() => revokeSessionMutation.mutate(session.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {revokeSessionMutation.isError && (
          <p className="mt-3 text-sm font-medium text-coral">{revokeSessionMutation.error.message}</p>
        )}
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">WebAuthn Devices</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">Registered passkeys and security keys.</p>
          </div>
          <form
            className="grid w-full gap-2 sm:w-auto sm:grid-cols-[minmax(0,14rem)_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              registerPasskeyMutation.mutate(passkeyLabel);
            }}
          >
            <TextField
              label="Passkey label"
              value={passkeyLabel}
              onValueChange={setPasskeyLabel}
              className="h-10"
              aria-label="Passkey label"
            />
            <Button
              type="submit"
              variant="primary"
              className="h-10"
              disabled={registerPasskeyMutation.isPending}
            >
              <Save className="h-4 w-4" />
              {registerPasskeyMutation.isPending ? "Registering..." : "Register Passkey"}
            </Button>
          </form>
        </div>

        <div className="mt-4">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="text-left text-xs uppercase text-foreground hover:bg-transparent">
                <TableHead className="py-3 pr-4 font-semibold">Label</TableHead>
                <TableHead className="py-3 pr-4 font-semibold">Credential</TableHead>
                <TableHead className="py-3 pr-4 font-semibold">Transports</TableHead>
                <TableHead className="py-3 pr-4 font-semibold">Last used</TableHead>
                <TableHead className="py-3 pr-4 font-semibold">Status</TableHead>
                <TableHead className="py-3 font-semibold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devicesQuery.data.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="py-3 pr-4 font-medium">{device.label}</TableCell>
                  <TableCell className="py-3 pr-4 text-muted-foreground">{device.credentialId}</TableCell>
                  <TableCell className="py-3 pr-4">{device.transports.map(sentenceCase).join(", ")}</TableCell>
                  <TableCell className="py-3 pr-4">{formatDateTime(device.lastUsedAt)}</TableCell>
                  <TableCell className="py-3 pr-4">
                    <StatusBadge
                      label={sentenceCase(device.status)}
                      tone={device.status === "active" ? "green" : "red"}
                    />
                  </TableCell>
                  <TableCell className="py-3">
                    <Button
                      variant="danger"
                      size="sm"
                      title="Revoke passkey"
                      aria-label="Revoke passkey"
                      disabled={device.status === "revoked" || revokeMutation.isPending}
                      onClick={() => revokeMutation.mutate(device.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {registerPasskeyMutation.isError && (
          <p className="mt-3 text-sm font-medium text-coral">{registerPasskeyMutation.error.message}</p>
        )}
        {registerPasskeyMutation.isSuccess && (
          <p className="mt-3 text-sm font-medium text-forest">Passkey registered.</p>
        )}
      </Panel>
    </div>
  );
}
