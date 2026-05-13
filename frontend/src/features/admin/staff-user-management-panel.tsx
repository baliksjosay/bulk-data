"use client";

import { useMutation } from "@tanstack/react-query";
import { ShieldCheck, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { PhoneField, SelectField, TextField } from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { api } from "@/lib/api-client";
import type { StaffUserCreateRequest, UserAccount } from "@/types/domain";

const emptyStaffForm: StaffUserCreateRequest = {
  phoneNumber: "+256",
  email: "",
  lanId: "",
  role: "SUPPORT",
};

export function StaffUserManagementPanel() {
  const [form, setForm] = useState<StaffUserCreateRequest>(emptyStaffForm);
  const [createdUser, setCreatedUser] = useState<UserAccount | null>(null);

  const createStaffMutation = useMutation({
    mutationFn: (payload: StaffUserCreateRequest) =>
      api.createStaffUser(payload),
    onSuccess: (user) => {
      setCreatedUser(user);
      setForm(emptyStaffForm);
    },
  });

  function updateForm<K extends keyof StaffUserCreateRequest>(
    key: K,
    value: StaffUserCreateRequest[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
    createStaffMutation.reset();
  }

  function submitStaffUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatedUser(null);
    createStaffMutation.mutate({
      ...form,
      email: form.email.trim().toLowerCase(),
      lanId: form.lanId.trim(),
    });
  }

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Access Users</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Create admin and support access with verified contact details.
          </p>
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <ShieldCheck className="h-4 w-4" />
        </span>
      </div>

      <form
        className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_12rem_auto]"
        onSubmit={submitStaffUser}
      >
        <PhoneField
          label="Phone Number"
          value={form.phoneNumber}
          onValueChange={(value) => updateForm("phoneNumber", value)}
          required
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onValueChange={(value) => updateForm("email", value)}
          required
        />
        <TextField
          label="Login ID"
          value={form.lanId}
          onValueChange={(value) => updateForm("lanId", value)}
          required
        />
        <SelectField
          label="Role"
          value={form.role}
          onValueChange={(value) =>
            updateForm("role", value as StaffUserCreateRequest["role"])
          }
          options={[
            { label: "Support", value: "SUPPORT" },
            { label: "Admin", value: "ADMIN" },
          ]}
        />
        <div className="flex items-end">
          <Button
            type="submit"
            className="h-10 w-full"
            disabled={createStaffMutation.isPending}
          >
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        </div>
      </form>

      <div aria-live="polite" className="min-h-5 text-sm">
        {createStaffMutation.isError && (
          <p className="text-destructive">
            {createStaffMutation.error instanceof Error
              ? createStaffMutation.error.message
              : "User could not be created"}
          </p>
        )}
        {createdUser && (
          <p className="text-[var(--muted)]">
            {createdUser.email} was added as {createdUser.roles.join(", ")}.
          </p>
        )}
      </div>
    </Panel>
  );
}
