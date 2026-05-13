"use client";

import { useMutation } from "@tanstack/react-query";
import { Radio, RefreshCw, Save, Trash2, UserPlus, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PhoneField, TextField, TextareaField } from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import { formatDateTime, sentenceCase } from "@/lib/format";
import { normalizeUgandaPhoneInput, UGANDA_PHONE_COUNTRY_CODE } from "@/lib/uganda-phone";
import type {
  ProvisioningAddGroupMembersBulkRequest,
  ProvisioningAddSubscriberRequest,
  ProvisioningCommandResult,
  ProvisioningDeleteGroupMemberRequest,
  ProvisioningGroupMemberPair,
  ProvisioningUpdateSubscriptionRequest,
} from "@/types/domain";

const liveApiEnabled = process.env.NEXT_PUBLIC_API_MODE === "live";

function toProvisioningMsisdn(value: string) {
  return normalizeUgandaPhoneInput(value).replace(/^\+/, "");
}

function ResultCard<TRequest>({
  title,
  result,
}: {
  title: string;
  result: ProvisioningCommandResult<TRequest>;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-[var(--background)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {sentenceCase(result.operation)} / provider {result.providerStatusCode}
          </p>
        </div>
        <StatusBadge label={result.accepted ? "Accepted" : "Rejected"} tone={result.accepted ? "green" : "red"} />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-[var(--muted)] sm:grid-cols-2">
        <p>Request ID: {result.requestId}</p>
        <p>Processed: {formatDateTime(result.processedAt)}</p>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-md bg-black px-3 py-2 text-xs text-white">
        {JSON.stringify(result.providerResponse ?? {}, null, 2)}
      </pre>
    </div>
  );
}

export function ProvisioningOperationsPanel() {
  const [primaryMsisdn, setPrimaryMsisdn] = useState(UGANDA_PHONE_COUNTRY_CODE);
  const [secondaryMsisdn, setSecondaryMsisdn] = useState(UGANDA_PHONE_COUNTRY_CODE);
  const [bulkSecondaryMsisdns, setBulkSecondaryMsisdns] = useState("");
  const [deleteSecondaryMsisdn, setDeleteSecondaryMsisdn] = useState(UGANDA_PHONE_COUNTRY_CODE);
  const [subscriberMsisdn, setSubscriberMsisdn] = useState(UGANDA_PHONE_COUNTRY_CODE);
  const [subscriberTransactionId, setSubscriberTransactionId] = useState("");
  const [subscriptionPrimaryMsisdn, setSubscriptionPrimaryMsisdn] = useState(UGANDA_PHONE_COUNTRY_CODE);
  const [serviceCode, setServiceCode] = useState("");
  const [subscriptionTransactionId, setSubscriptionTransactionId] = useState("");
  const [topupValue, setTopupValue] = useState("1024");
  const [updateAttemptCount, setUpdateAttemptCount] = useState("1");

  const parsedBulkMembers = useMemo(() => {
    const normalizedPrimaryMsisdn = toProvisioningMsisdn(primaryMsisdn);

    return bulkSecondaryMsisdns
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => ({
        secondaryMsisdn: toProvisioningMsisdn(value),
        primaryMsisdn: normalizedPrimaryMsisdn,
      }));
  }, [bulkSecondaryMsisdns, primaryMsisdn]);

  const addGroupMemberMutation = useMutation({
    mutationFn: (payload: ProvisioningGroupMemberPair) => api.provisioningAddGroupMember(payload),
  });
  const addGroupMembersBulkMutation = useMutation({
    mutationFn: (payload: ProvisioningAddGroupMembersBulkRequest) => api.provisioningAddGroupMembersBulk(payload),
  });
  const deleteGroupMemberMutation = useMutation({
    mutationFn: (payload: ProvisioningDeleteGroupMemberRequest) => api.provisioningDeleteGroupMember(payload),
  });
  const addSubscriberMutation = useMutation({
    mutationFn: (payload: ProvisioningAddSubscriberRequest) => api.provisioningAddSubscriber(payload),
  });
  const updateSubscriptionMutation = useMutation({
    mutationFn: (payload: ProvisioningUpdateSubscriptionRequest) => api.provisioningUpdateSubscription(payload),
  });

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Provisioning Operations</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Admin and support tools for direct subscriber and group-member provisioning.
          </p>
        </div>
        <StatusBadge label={liveApiEnabled ? "Live API" : "Fake mode"} tone={liveApiEnabled ? "green" : "yellow"} />
      </div>

      {!liveApiEnabled && (
        <div className="mt-4 rounded-md border border-border/70 bg-[var(--background)] p-3 text-sm text-[var(--muted)]">
          Switch `NEXT_PUBLIC_API_MODE=live` and configure the provisioning backend to enable these controls.
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-lg border border-border/70 p-4">
            <div className="flex items-center gap-2">
              <UsersRound className="h-4 w-4" />
              <h4 className="font-semibold">Add Group Member</h4>
            </div>
            <div className="mt-4 grid gap-3">
              <PhoneField label="Primary MSISDN" value={primaryMsisdn} onValueChange={setPrimaryMsisdn} />
              <PhoneField label="Secondary MSISDN" value={secondaryMsisdn} onValueChange={setSecondaryMsisdn} />
              <Button
                type="button"
                variant="primary"
                disabled={!liveApiEnabled || addGroupMemberMutation.isPending}
                onClick={() =>
                  addGroupMemberMutation.mutate({
                    primaryMsisdn: toProvisioningMsisdn(primaryMsisdn),
                    secondaryMsisdn: toProvisioningMsisdn(secondaryMsisdn),
                  })
                }
              >
                <Save className="h-4 w-4" />
                Add member
              </Button>
            </div>
            {addGroupMemberMutation.isError && (
              <p className="mt-3 text-sm text-destructive">{addGroupMemberMutation.error.message}</p>
            )}
            {addGroupMemberMutation.data && (
              <div className="mt-4">
                <ResultCard title="Latest group-member request" result={addGroupMemberMutation.data} />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border/70 p-4">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              <h4 className="font-semibold">Delete Group Member</h4>
            </div>
            <div className="mt-4 grid gap-3">
              <PhoneField
                label="Secondary MSISDN"
                value={deleteSecondaryMsisdn}
                onValueChange={setDeleteSecondaryMsisdn}
              />
              <Button
                type="button"
                variant="primary"
                disabled={!liveApiEnabled || deleteGroupMemberMutation.isPending}
                onClick={() =>
                  deleteGroupMemberMutation.mutate({
                    secondaryMsisdn: toProvisioningMsisdn(deleteSecondaryMsisdn),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
                Remove member
              </Button>
            </div>
            {deleteGroupMemberMutation.isError && (
              <p className="mt-3 text-sm text-destructive">{deleteGroupMemberMutation.error.message}</p>
            )}
            {deleteGroupMemberMutation.data && (
              <div className="mt-4">
                <ResultCard title="Latest delete request" result={deleteGroupMemberMutation.data} />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border/70 p-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              <h4 className="font-semibold">Add Subscriber</h4>
            </div>
            <div className="mt-4 grid gap-3">
              <PhoneField label="Subscriber MSISDN" value={subscriberMsisdn} onValueChange={setSubscriberMsisdn} />
              <TextField
                label="Transaction ID"
                value={subscriberTransactionId}
                onValueChange={setSubscriberTransactionId}
                placeholder="78954566743"
              />
              <Button
                type="button"
                variant="primary"
                disabled={!liveApiEnabled || addSubscriberMutation.isPending}
                onClick={() =>
                  addSubscriberMutation.mutate({
                    msisdn: toProvisioningMsisdn(subscriberMsisdn),
                    transactionId: subscriberTransactionId.trim(),
                  })
                }
              >
                <UserPlus className="h-4 w-4" />
                Add subscriber
              </Button>
            </div>
            {addSubscriberMutation.isError && (
              <p className="mt-3 text-sm text-destructive">{addSubscriberMutation.error.message}</p>
            )}
            {addSubscriberMutation.data && (
              <div className="mt-4">
                <ResultCard title="Latest subscriber request" result={addSubscriberMutation.data} />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-border/70 p-4">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4" />
              <h4 className="font-semibold">Bulk Group Members</h4>
            </div>
            <div className="mt-4 grid gap-3">
              <PhoneField label="Primary MSISDN" value={primaryMsisdn} onValueChange={setPrimaryMsisdn} />
              <TextareaField
                label="Secondary MSISDNs"
                value={bulkSecondaryMsisdns}
                onValueChange={setBulkSecondaryMsisdns}
                placeholder="+256772000001, +256772000002"
              />
              <p className="text-xs text-[var(--muted)]">
                {parsedBulkMembers.length} secondary number{parsedBulkMembers.length === 1 ? "" : "s"} prepared for upload.
              </p>
              <Button
                type="button"
                variant="primary"
                disabled={!liveApiEnabled || addGroupMembersBulkMutation.isPending || parsedBulkMembers.length === 0}
                onClick={() =>
                  addGroupMembersBulkMutation.mutate({
                    groupMembers: parsedBulkMembers,
                  })
                }
              >
                <UsersRound className="h-4 w-4" />
                Upload bulk members
              </Button>
            </div>
            {addGroupMembersBulkMutation.isError && (
              <p className="mt-3 text-sm text-destructive">{addGroupMembersBulkMutation.error.message}</p>
            )}
            {addGroupMembersBulkMutation.data && (
              <div className="mt-4">
                <ResultCard title="Latest bulk request" result={addGroupMembersBulkMutation.data} />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border/70 p-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              <h4 className="font-semibold">Update Subscription</h4>
            </div>
            <div className="mt-4 grid gap-3">
              <PhoneField
                label="Primary MSISDN"
                value={subscriptionPrimaryMsisdn}
                onValueChange={setSubscriptionPrimaryMsisdn}
              />
              <TextField label="Service Code" value={serviceCode} onValueChange={setServiceCode} placeholder="DATA_BUNDLE_CODE" />
              <TextField
                label="Transaction ID"
                value={subscriptionTransactionId}
                onValueChange={setSubscriptionTransactionId}
                placeholder="567123456"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  label="Top-up value"
                  type="number"
                  min={1}
                  value={topupValue}
                  onValueChange={setTopupValue}
                />
                <TextField
                  label="Update attempts"
                  type="number"
                  min={0}
                  value={updateAttemptCount}
                  onValueChange={setUpdateAttemptCount}
                />
              </div>
              <Button
                type="button"
                variant="primary"
                disabled={!liveApiEnabled || updateSubscriptionMutation.isPending}
                onClick={() =>
                  updateSubscriptionMutation.mutate({
                    primaryMsisdn: toProvisioningMsisdn(subscriptionPrimaryMsisdn),
                    serviceCode: serviceCode.trim(),
                    transactionId: subscriptionTransactionId.trim(),
                    topupValue: Number(topupValue),
                    updateAttemptCount: Number(updateAttemptCount),
                  })
                }
              >
                <RefreshCw className="h-4 w-4" />
                Update subscription
              </Button>
            </div>
            {updateSubscriptionMutation.isError && (
              <p className="mt-3 text-sm text-destructive">{updateSubscriptionMutation.error.message}</p>
            )}
            {updateSubscriptionMutation.data && (
              <div className="mt-4">
                <ResultCard title="Latest subscription update" result={updateSubscriptionMutation.data} />
              </div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}
