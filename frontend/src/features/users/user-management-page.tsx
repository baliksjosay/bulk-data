"use client";

import {
  CheckCircle2,
  Lock,
  Phone,
  ShieldCheck,
  Unlock,
  UserCog,
  UserPlus,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { TextField, PhoneField, SelectField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { api } from "@/lib/api-client";
import { formatDateTime, sentenceCase } from "@/lib/format";
import { isUgandaPhoneNumber } from "@/lib/uganda-phone";
import type {
  AuthenticatedUser,
  StaffUserRole,
  UserAccount,
  UserAccountStatus,
} from "@/types/domain";

type StaffFilters = {
  page: number;
  limit: number;
  search: string;
  role: "" | StaffUserRole;
  status: "" | UserAccountStatus;
};

type CreateUserForm = {
  email: string;
  role: StaffUserRole;
};

const initialFilters: StaffFilters = {
  page: 1,
  limit: 10,
  search: "",
  role: "",
  status: "",
};

const emptyCreateForm: CreateUserForm = {
  email: "",
  role: "SUPPORT",
};

function displayName(user: UserAccount) {
  return (
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
    user.email.split("@")[0] ||
    user.email
  );
}

function primaryRole(user: UserAccount) {
  if (user.roles.includes("SUPER_ADMIN")) {
    return "SUPER_ADMIN";
  }

  if (user.roles.includes("ADMIN")) {
    return "ADMIN";
  }

  return "SUPPORT";
}

function statusTone(status: UserAccountStatus) {
  if (status === "ACTIVE") {
    return "green" as const;
  }

  if (status === "PENDING") {
    return "yellow" as const;
  }

  if (status === "LOCKED" || status === "SUSPENDED") {
    return "red" as const;
  }

  return "neutral" as const;
}

function formatRole(role: string) {
  return role === "SUPER_ADMIN" ? "Super admin" : sentenceCase(role);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function UserManagementPage({
  currentUser,
}: {
  currentUser: AuthenticatedUser;
}) {
  const queryClient = useQueryClient();
  const canManageStaff = currentUser.role === "admin";
  const [filters, setFilters] = useState<StaffFilters>(initialFilters);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserForm>(emptyCreateForm);
  const [createError, setCreateError] = useState("");
  const [contactUser, setContactUser] = useState<UserAccount | null>(null);
  const [contactPhone, setContactPhone] = useState("");
  const [contactError, setContactError] = useState("");

  const usersQuery = useQuery({
    queryKey: ["staff-users", filters],
    queryFn: () => api.staffUsers(filters),
    placeholderData: (previousData) => previousData,
  });

  const invalidateStaffUsers = async () => {
    await queryClient.invalidateQueries({ queryKey: ["staff-users"] });
  };

  const createMutation = useMutation({
    mutationFn: api.createStaffUser,
    onSuccess: async () => {
      setCreateOpen(false);
      setCreateForm(emptyCreateForm);
      await invalidateStaffUsers();
    },
  });

  const updatePhoneMutation = useMutation({
    mutationFn: ({
      userId,
      phoneNumber,
    }: {
      userId: string;
      phoneNumber: string;
    }) => api.updateUser(userId, { phoneNumber }),
    onSuccess: async () => {
      setContactUser(null);
      setContactPhone("");
      await invalidateStaffUsers();
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: StaffUserRole;
    }) => api.setUserRoles(userId, [role]),
    onSuccess: invalidateStaffUsers,
  });

  const statusMutation = useMutation({
    mutationFn: ({
      userId,
      status,
    }: {
      userId: string;
      status: UserAccountStatus;
    }) =>
      api.changeUserStatus(userId, {
        status,
        reason: "Updated from user management",
      }),
    onSuccess: invalidateStaffUsers,
  });

  const lockMutation = useMutation({
    mutationFn: (userId: string) =>
      api.lockUser(userId, {
        minutes: 30,
        reason: "Locked from user management",
      }),
    onSuccess: invalidateStaffUsers,
  });

  const unlockMutation = useMutation({
    mutationFn: api.unlockUser,
    onSuccess: invalidateStaffUsers,
  });

  const actionError = [
    roleMutation.error,
    statusMutation.error,
    lockMutation.error,
    unlockMutation.error,
  ].find(Boolean);

  function updateFilters(nextFilters: Partial<StaffFilters>) {
    setFilters((current) => ({
      ...current,
      ...nextFilters,
      page: nextFilters.page ?? 1,
    }));
  }

  function submitCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError("");
    createMutation.reset();

    const email = createForm.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCreateError("Enter a valid email address.");
      return;
    }

    createMutation.mutate({
      email,
      role: createForm.role,
    });
  }

  function openContactDialog(user: UserAccount) {
    setContactUser(user);
    setContactPhone(user.phoneNumber ?? "+256");
    setContactError("");
    updatePhoneMutation.reset();
  }

  function submitContactUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactError("");
    updatePhoneMutation.reset();

    if (!contactUser) {
      return;
    }

    const phoneNumber = contactPhone.trim();
    if (!isUgandaPhoneNumber(phoneNumber)) {
      setContactError("Enter a valid MTN Uganda phone number.");
      return;
    }

    updatePhoneMutation.mutate({
      userId: contactUser.id,
      phoneNumber,
    });
  }

  const columns = useMemo<Array<DataTableColumn<UserAccount>>>(
    () => [
      {
        id: "user",
        header: "User",
        exportValue: (user) => `${displayName(user)} <${user.email}>`,
        cell: (user) => (
          <div className="min-w-48">
            <p className="font-semibold text-[var(--foreground)]">
              {displayName(user)}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">{user.email}</p>
          </div>
        ),
      },
      {
        id: "role",
        header: "Role",
        exportValue: (user) => primaryRole(user),
        cell: (user) => (
          <StatusBadge label={formatRole(primaryRole(user))} tone="blue" />
        ),
      },
      {
        id: "directory",
        header: "Directory Details",
        exportValue: (user) =>
          `${user.externalId ?? "Pending"} / ${user.phoneNumber ?? "Pending"}`,
        cell: (user) => (
          <div className="grid gap-1 text-sm">
            <span>
              Username:{" "}
              <span className="font-medium">
                {user.externalId || "Completes on first login"}
              </span>
            </span>
            <span className="text-[var(--muted)]">
              Phone: {user.phoneNumber || "Not added"}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        exportValue: (user) => user.status,
        cell: (user) => (
          <StatusBadge
            label={sentenceCase(user.status)}
            tone={statusTone(user.status)}
          />
        ),
      },
      {
        id: "created",
        header: "Created",
        exportValue: (user) => user.createdAt,
        cell: (user) => (
          <span className="text-sm text-[var(--muted)]">
            {formatDateTime(user.createdAt)}
          </span>
        ),
      },
    ],
    [],
  );

  function getRowActions(user: UserAccount): Array<DataTableRowAction<UserAccount>> {
    if (!canManageStaff) {
      return [];
    }

    const userRole = primaryRole(user);
    const canChangeRole = userRole !== "SUPER_ADMIN";
    const isCurrentUser = user.id === currentUser.id;
    const isLocked = user.isLocked || user.status === "LOCKED";
    const isInactive = user.status === "SUSPENDED" || user.status === "INACTIVE";

    return [
      {
        id: "update-phone",
        label: "Update phone",
        icon: Phone,
        onSelect: openContactDialog,
      },
      {
        id: "toggle-role",
        label: userRole === "ADMIN" ? "Set as support" : "Set as admin",
        icon: ShieldCheck,
        disabled: !canChangeRole || isCurrentUser || roleMutation.isPending,
        onSelect: (row) =>
          roleMutation.mutate({
            userId: row.id,
            role: userRole === "ADMIN" ? "SUPPORT" : "ADMIN",
          }),
      },
      {
        id: "toggle-status",
        label: isInactive ? "Activate user" : "Suspend user",
        icon: isInactive ? CheckCircle2 : UserCog,
        disabled: isCurrentUser || statusMutation.isPending,
        onSelect: (row) =>
          statusMutation.mutate({
            userId: row.id,
            status: isInactive ? "ACTIVE" : "SUSPENDED",
          }),
      },
      {
        id: "toggle-lock",
        label: isLocked ? "Unlock user" : "Lock user",
        icon: isLocked ? Unlock : Lock,
        variant: isLocked ? "default" : "destructive",
        disabled:
          isCurrentUser || lockMutation.isPending || unlockMutation.isPending,
        onSelect: (row) =>
          isLocked ? unlockMutation.mutate(row.id) : lockMutation.mutate(row.id),
      },
    ];
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">User Management</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Manage administrator and support access.
          </p>
        </div>
        {canManageStaff && (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Create User
          </Button>
        )}
      </div>

      {actionError && (
        <Panel className="border-destructive/30 bg-destructive/10 text-sm text-destructive">
          {getErrorMessage(actionError, "User action failed.")}
        </Panel>
      )}

      <Panel>
        <DataTable
          columns={columns}
          rows={usersQuery.data?.data ?? []}
          getRowKey={(user) => user.id}
          minWidth={880}
          isLoading={usersQuery.isLoading}
          emptyMessage="No admin or support users found."
          exportOptions={{
            title: "Staff Users",
            filename: "staff-users",
          }}
          filters={
            <div className="grid gap-3 md:grid-cols-3">
              <FilterInput
                label="Search"
                value={filters.search}
                onChange={(value) => updateFilters({ search: value })}
              />
              <FilterSelect
                label="Role"
                value={filters.role}
                onChange={(value) =>
                  updateFilters({ role: value as StaffFilters["role"] })
                }
                options={[
                  { label: "All roles", value: "" },
                  { label: "Admin", value: "ADMIN" },
                  { label: "Support", value: "SUPPORT" },
                ]}
              />
              <FilterSelect
                label="Status"
                value={filters.status}
                onChange={(value) =>
                  updateFilters({ status: value as StaffFilters["status"] })
                }
                options={[
                  { label: "All statuses", value: "" },
                  { label: "Active", value: "ACTIVE" },
                  { label: "Suspended", value: "SUSPENDED" },
                  { label: "Locked", value: "LOCKED" },
                  { label: "Inactive", value: "INACTIVE" },
                ]}
              />
            </div>
          }
          pagination={
            usersQuery.data
              ? {
                  ...usersQuery.data.meta,
                  mode: "controls",
                  windowKey: JSON.stringify({
                    search: filters.search,
                    role: filters.role,
                    status: filters.status,
                    limit: filters.limit,
                  }),
                  isFetchingPage: usersQuery.isFetching,
                  onPageChange: (page) => updateFilters({ page }),
                  onLimitChange: (limit) => updateFilters({ limit }),
                }
              : undefined
          }
          rowActions={canManageStaff ? getRowActions : undefined}
        />
      </Panel>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>
              Only the email address is required. Other details are completed on
              first successful login or updated later.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submitCreateUser}>
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              value={createForm.email}
              onValueChange={(email) =>
                setCreateForm((current) => ({ ...current, email }))
              }
              required
            />
            <SelectField
              label="Role"
              value={createForm.role}
              onValueChange={(role) =>
                setCreateForm((current) => ({
                  ...current,
                  role: role as StaffUserRole,
                }))
              }
              options={[
                { label: "Support", value: "SUPPORT" },
                { label: "Admin", value: "ADMIN" },
              ]}
            />
            <div aria-live="polite" className="min-h-5 text-sm">
              {(createError || createMutation.isError) && (
                <p className="text-destructive">
                  {createError ||
                    getErrorMessage(
                      createMutation.error,
                      "User could not be created.",
                    )}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                <UserPlus className="h-4 w-4" />
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(contactUser)}
        onOpenChange={(open) => {
          if (!open) {
            setContactUser(null);
            setContactPhone("");
            setContactError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update phone number</DialogTitle>
            <DialogDescription>
              Add or correct the phone number for {contactUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submitContactUpdate}>
            <PhoneField
              label="Phone Number"
              value={contactPhone}
              onValueChange={setContactPhone}
              required
            />
            <div aria-live="polite" className="min-h-5 text-sm">
              {(contactError || updatePhoneMutation.isError) && (
                <p className="text-destructive">
                  {contactError ||
                    getErrorMessage(
                      updatePhoneMutation.error,
                      "Phone number could not be updated.",
                    )}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setContactUser(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updatePhoneMutation.isPending}>
                <Phone className="h-4 w-4" />
                Save Phone
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterInput({
  label,
  type = "search",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Label className="grid gap-2 text-sm font-medium">
      {label}
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Label>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <Label className="grid gap-2 text-sm font-medium">
      {label}
      <NativeSelect
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <NativeSelectOption key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Label>
  );
}
