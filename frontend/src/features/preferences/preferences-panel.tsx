"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { Toggle } from "@/components/ui/toggle";
import { api } from "@/lib/api-client";
import { useUiStore } from "@/store/ui-store";
import type { UserPreferences } from "@/types/domain";

const timezones = ["Africa/Kampala", "Africa/Nairobi", "UTC"];

export function PreferencesPanel() {
  const preferencesQuery = useQuery({
    queryKey: ["preferences"],
    queryFn: api.preferences,
  });

  if (preferencesQuery.isLoading || !preferencesQuery.data) {
    return <Panel>Loading preferences...</Panel>;
  }

  if (preferencesQuery.isError) {
    return <Panel>Preferences could not be loaded.</Panel>;
  }

  return (
    <PreferencesForm
      key={JSON.stringify(preferencesQuery.data)}
      initialPreferences={preferencesQuery.data}
    />
  );
}

function PreferencesForm({
  initialPreferences,
}: {
  initialPreferences: UserPreferences;
}) {
  const queryClient = useQueryClient();
  const setTheme = useUiStore((state) => state.setTheme);
  const [draft, setDraft] = useState<UserPreferences>(initialPreferences);
  const updateMutation = useMutation({
    mutationFn: api.updatePreferences,
    onSuccess: async (preferences) => {
      setTheme(preferences.theme);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["preferences"] }),
        queryClient.invalidateQueries({ queryKey: ["audit-events"] }),
      ]);
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Preferences</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Workspace defaults, notification channels, and delivery windows.
        </p>
      </div>

      <form
        className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]"
        onSubmit={(event) => {
          event.preventDefault();
          updateMutation.mutate(draft);
        }}
      >
        <Panel className="space-y-4">
          <h3 className="font-semibold">Workspace</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Theme"
              value={draft.theme}
              onValueChange={(value) =>
                setDraft({ ...draft, theme: value as UserPreferences["theme"] })
              }
              options={[
                { label: "Light", value: "light" },
                { label: "Dark", value: "dark" },
                { label: "System", value: "system" },
              ]}
            />

            <SelectField
              label="Timezone"
              value={draft.timezone}
              onValueChange={(value) => setDraft({ ...draft, timezone: value })}
              options={timezones.map((timezone) => ({
                label: timezone,
                value: timezone,
              }))}
            />

            <SelectField
              label="Density"
              value={draft.dataDensity}
              onValueChange={(value) =>
                setDraft({
                  ...draft,
                  dataDensity: value as UserPreferences["dataDensity"],
                })
              }
              options={[
                { label: "Comfortable", value: "comfortable" },
                { label: "Compact", value: "compact" },
              ]}
            />

            <SelectField
              label="Landing"
              value={draft.defaultLanding}
              onValueChange={(value) =>
                setDraft({
                  ...draft,
                  defaultLanding: value as UserPreferences["defaultLanding"],
                })
              }
              options={[
                { label: "Overview", value: "overview" },
                { label: "Accounts", value: "admin" },
                { label: "Customer", value: "customer" },
                { label: "Security", value: "security" },
              ]}
            />
          </div>
        </Panel>

        <Panel className="space-y-4">
          <h3 className="font-semibold">Notification Channels</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["email", "Email"],
                ["sms", "SMS"],
                ["whatsapp", "WhatsApp"],
                ["inApp", "In-app"],
              ] as const
            ).map(([key, label]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] p-3"
              >
                <span className="text-sm font-medium">{label}</span>
                <Toggle
                  checked={draft.notifications[key]}
                  label={`${label} notifications`}
                  onChange={(checked) =>
                    setDraft({
                      ...draft,
                      notifications: {
                        ...draft.notifications,
                        [key]: checked,
                      },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="space-y-4 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">Quiet Hours</h3>
            <Toggle
              checked={draft.quietHours.enabled}
              label="Quiet hours"
              onChange={(checked) =>
                setDraft({
                  ...draft,
                  quietHours: {
                    ...draft.quietHours,
                    enabled: checked,
                  },
                })
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Start"
              type="time"
              value={draft.quietHours.start}
              onValueChange={(value) =>
                setDraft({
                  ...draft,
                  quietHours: {
                    ...draft.quietHours,
                    start: value,
                  },
                })
              }
            />
            <TextField
              label="End"
              type="time"
              value={draft.quietHours.end}
              onValueChange={(value) =>
                setDraft({
                  ...draft,
                  quietHours: {
                    ...draft.quietHours,
                    end: value,
                  },
                })
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border)] pt-4">
            {updateMutation.isError && (
              <p className="mr-auto text-sm font-medium text-coral">
                {updateMutation.error.message}
              </p>
            )}
            {updateMutation.isSuccess && (
              <p className="mr-auto text-sm font-medium text-forest">
                Preferences saved.
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={updateMutation.isPending}
            >
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </Panel>
      </form>
    </div>
  );
}
