"use client";

import {
  Activity,
  BarChart3,
  Bell,
  CheckCheck,
  ChevronDown,
  CreditCard,
  FileClock,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  MonitorCog,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  TableProperties,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandLoader } from "@/components/ui/brand-loader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminWorkspace } from "@/features/admin/admin-workspace";
import { CustomerPortal } from "@/features/customer/customer-portal";
import { AuditPage } from "@/features/dashboard/audit-page";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { PackageManagementPage } from "@/features/packages/package-management-page";
import { PreferencesPanel } from "@/features/preferences/preferences-panel";
import { ReportsPage } from "@/features/reports/reports-page";
import { SecuritySettings } from "@/features/security/security-settings";
import { api } from "@/lib/api-client";
import { clearAuthSession, useAuthSessionSnapshot } from "@/lib/auth-session";
import { cn } from "@/lib/cn";
import { formatDateTime, sentenceCase } from "@/lib/format";
import {
  type AppSection,
  type ReportSection,
  useUiStore,
} from "@/store/ui-store";
import type {
  AuthRole,
  AuthenticatedUser,
  InAppNotification,
} from "@/types/domain";

const sections: Array<{
  id: AppSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isReportsMenu?: boolean;
  roles: AuthRole[];
}> = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    roles: ["admin", "support", "customer"],
  },
  {
    id: "admin",
    label: "Accounts",
    icon: MonitorCog,
    roles: ["admin", "support"],
  },
  { id: "packages", label: "Packages", icon: Package, roles: ["admin"] },
  {
    id: "customer",
    label: "Customer",
    icon: UsersRound,
    roles: ["admin", "support", "customer"],
  },
  {
    id: "reports",
    label: "Reports",
    icon: ReceiptText,
    isReportsMenu: true,
    roles: ["admin", "support"],
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    roles: ["admin", "support", "customer"],
  },
  {
    id: "preferences",
    label: "Preferences",
    icon: SlidersHorizontal,
    roles: ["admin", "support", "customer"],
  },
  { id: "audit", label: "Audit", icon: FileClock, roles: ["admin"] },
];

const reportSections: Array<{
  id: ReportSection;
  label: string;
  description: string;
  group: "Operations" | "Customer";
  icon: React.ComponentType<{ className?: string }>;
  roles: AuthRole[];
}> = [
  {
    id: "report-transactions",
    label: "Transactions",
    description: "Bundle payments and provisioning status",
    group: "Operations",
    icon: ReceiptText,
    roles: ["admin", "support"],
  },
  {
    id: "report-service-requests",
    label: "Service Requests",
    description: "Public requests and customer conversion",
    group: "Operations",
    icon: FileClock,
    roles: ["admin", "support"],
  },
  {
    id: "report-customer-activity",
    label: "Customer Activity",
    description: "Customer lifecycle, spend, and status",
    group: "Operations",
    icon: BarChart3,
    roles: ["admin", "support"],
  },
  {
    id: "report-bundle-purchases",
    label: "Bundle Purchases",
    description: "Customer bundle purchase history",
    group: "Customer",
    icon: CreditCard,
    roles: ["admin", "support"],
  },
  {
    id: "report-secondary-numbers",
    label: "Secondary Numbers",
    description: "Provisioned secondary MSISDNs",
    group: "Customer",
    icon: TableProperties,
    roles: ["admin", "support"],
  },
  {
    id: "report-balances",
    label: "Balances",
    description: "Bundle balance and expiry report",
    group: "Customer",
    icon: Activity,
    roles: ["admin", "support"],
  },
];

const appSectionIds = new Set<AppSection>([
  ...sections.map((section) => section.id),
  ...reportSections.map((section) => section.id),
]);

const inactiveNavigationButtonClass =
  "!border-transparent !bg-transparent !text-[var(--foreground)] !shadow-none hover:!bg-[var(--panel-strong)] hover:!text-[var(--foreground)] dark:!border-transparent dark:!bg-transparent dark:!text-[var(--foreground)] dark:hover:!bg-[var(--panel-strong)]";

const headerIconButtonClass =
  "!border-transparent !bg-transparent !text-[var(--foreground)] !shadow-none hover:!bg-[var(--panel-strong)] hover:!text-[var(--foreground)] dark:!border-transparent dark:!bg-transparent dark:!text-[var(--foreground)] dark:hover:!bg-[var(--panel-strong)]";

function isReportSection(section: AppSection) {
  return section === "reports" || section.startsWith("report-");
}

function isAppSection(value: string | null): value is AppSection {
  return Boolean(value && appSectionIds.has(value as AppSection));
}

function normalizeReportSection(section: AppSection): ReportSection {
  return section.startsWith("report-")
    ? (section as ReportSection)
    : "report-transactions";
}

function renderSection(activeSection: AppSection, currentRole: AuthRole) {
  if (activeSection === "overview") {
    return <DashboardPage />;
  }

  if (activeSection === "admin") {
    return <AdminWorkspace currentRole={currentRole} />;
  }

  if (activeSection === "packages") {
    return <PackageManagementPage />;
  }

  if (activeSection === "customer") {
    return <CustomerPortal />;
  }

  if (isReportSection(activeSection)) {
    return <ReportsPage report={normalizeReportSection(activeSection)} />;
  }

  if (activeSection === "security") {
    return <SecuritySettings />;
  }

  if (activeSection === "preferences") {
    return <PreferencesPanel />;
  }

  return <AuditPage />;
}

function ReportsMegaMenu({
  activeSection,
  setActiveSection,
  variant,
  visibleReportSections,
}: {
  activeSection: AppSection;
  setActiveSection: (section: AppSection) => void;
  variant: "inline" | "flyout";
  visibleReportSections: typeof reportSections;
}) {
  const selectedReport = normalizeReportSection(activeSection);
  const groupedReports = {
    Operations: visibleReportSections.filter(
      (section) => section.group === "Operations",
    ),
    Customer: visibleReportSections.filter(
      (section) => section.group === "Customer",
    ),
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-sm",
        variant === "inline" && "mt-2 p-2",
        variant === "flyout" &&
          "absolute left-[calc(100%+0.75rem)] top-0 z-[80] w-80 bg-[var(--panel)] p-3 shadow-xl ring-1 ring-black/5 dark:ring-white/10",
      )}
    >
      {variant === "flyout" && (
        <div className="mb-3 border-b border-[var(--border)] pb-2">
          <p className="text-sm font-semibold">Reports</p>
          <p className="text-xs text-[var(--muted)]">
            Open one report per page
          </p>
        </div>
      )}
      {Object.entries(groupedReports).map(([groupName, reports]) => (
        <div key={groupName} className="space-y-1 py-1">
          <p className="px-2 py-1 text-[11px] font-semibold uppercase text-[var(--muted)]">
            {groupName}
          </p>
          {reports.map((report) => {
            const Icon = report.icon;
            const selected = selectedReport === report.id;

            return (
              <Button
                key={report.id}
                type="button"
                variant={selected ? "primary" : "ghost"}
                onClick={() => setActiveSection(report.id)}
                className={cn(
                  "h-auto w-full items-start justify-start gap-3 rounded-md p-2 text-left whitespace-normal",
                  !selected && inactiveNavigationButtonClass,
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {report.label}
                  </span>
                  <span
                    className={cn(
                      "block text-xs leading-snug whitespace-normal",
                      selected ? "text-ink/75" : "text-[var(--muted)]",
                    )}
                  >
                    {report.description}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function notificationToneClass(
  priority: InAppNotification["notification"]["priority"],
) {
  if (priority === "critical") {
    return "bg-red-500";
  }

  if (priority === "high") {
    return "bg-amber-500";
  }

  if (priority === "low") {
    return "bg-slate-400";
  }

  return "bg-sky-500";
}

function NotificationsMenu({ user }: { user: AuthenticatedUser }) {
  const queryClient = useQueryClient();
  const notificationQueryKey = ["notifications", user.id] as const;
  const unreadCountQueryKey = ["notifications-unread-count", user.id] as const;
  const notificationsQuery = useQuery({
    queryKey: [...notificationQueryKey, { limit: 8 }],
    queryFn: () => api.notifications({ limit: 8 }),
    refetchInterval: 30_000,
  });
  const unreadCountQuery = useQuery({
    queryKey: unreadCountQueryKey,
    queryFn: api.unreadNotificationsCount,
    refetchInterval: 30_000,
  });
  const notifications = notificationsQuery.data?.data ?? [];
  const unreadCount =
    unreadCountQuery.data?.count ??
    notifications.filter((notification) => !notification.isRead).length;

  function refreshNotifications() {
    void queryClient.invalidateQueries({ queryKey: notificationQueryKey });
    void queryClient.invalidateQueries({ queryKey: unreadCountQueryKey });
  }

  const markReadMutation = useMutation({
    mutationFn: (notificationIds: string[]) =>
      api.markNotificationsRead(notificationIds),
    onSuccess: refreshNotifications,
  });
  const markAllReadMutation = useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: refreshNotifications,
  });

  function openNotification(notification: InAppNotification) {
    if (!notification.isRead) {
      markReadMutation.mutate([notification.notificationId]);
    }

    const actionUrl = notification.notification.actionUrl;

    if (actionUrl?.startsWith("/")) {
      window.location.assign(actionUrl);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Notifications"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
          className={cn("relative", headerIconButtonClass)}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 px-1 text-[10px] leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(calc(100vw-1.5rem),26rem)] p-0"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2">
          <DropdownMenuLabel className="p-0">
            <span className="block text-sm font-semibold">Notifications</span>
            <span className="block text-xs font-normal text-[var(--muted)]">
              {unreadCount === 1 ? "1 unread" : `${unreadCount} unread`}
            </span>
          </DropdownMenuLabel>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="Mark all read"
            aria-label="Mark all read"
            disabled={unreadCount === 0 || markAllReadMutation.isPending}
            onClick={() => markAllReadMutation.mutate()}
            className={headerIconButtonClass}
          >
            <CheckCheck className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[22rem] overflow-y-auto p-1">
          {notificationsQuery.isError ? (
            <div className="grid gap-2 px-4 py-8 text-center text-sm text-[var(--muted)]">
              <Inbox className="mx-auto h-5 w-5" />
              Notifications unavailable
            </div>
          ) : notifications.length === 0 ? (
            <div className="grid gap-2 px-4 py-8 text-center text-sm text-[var(--muted)]">
              <Inbox className="mx-auto h-5 w-5" />
              No notifications
            </div>
          ) : (
            notifications.map((item) => {
              const title =
                item.notification.subject ||
                sentenceCase(item.notification.type);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  className={cn(
                    "flex w-full gap-3 rounded-md px-3 py-2 text-left outline-none transition hover:bg-[var(--panel-strong)] focus-visible:ring-2 focus-visible:ring-primary/50",
                    !item.isRead && "bg-primary/10",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                      item.isRead
                        ? "bg-[var(--border)]"
                        : notificationToneClass(item.notification.priority),
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-semibold">
                        {title}
                      </span>
                      <span className="shrink-0 text-[11px] text-[var(--muted)]">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">
                      {item.notification.body}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenu({
  user,
  setActiveSection,
  closeMobileMenu,
  onSignOut,
}: {
  user: AuthenticatedUser;
  setActiveSection: (section: AppSection) => void;
  closeMobileMenu: () => void;
  onSignOut: () => void;
}) {
  function openSection(section: AppSection) {
    setActiveSection(section);
    closeMobileMenu();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          title="Open account menu"
          aria-label="Open account menu"
          className={headerIconButtonClass}
        >
          <span className="grid size-8 place-items-center rounded-full bg-primary-foreground text-xs font-semibold text-primary">
            SA
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block">{user.name}</span>
          <span className="block text-xs font-normal text-[var(--muted)]">
            {user.email}
          </span>
          <span className="mt-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
            {sentenceCase(user.role)}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => openSection("preferences")}>
            <UserRound className="h-4 w-4" />
            Account settings
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openSection("security")}>
            <ShieldCheck className="h-4 w-4" />
            Security and sessions
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openSection("preferences")}>
            <SlidersHorizontal className="h-4 w-4" />
            Preferences
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNavigationMenu({
  open,
  activeSection,
  setActiveSection,
  reportsOpen,
  setReportsOpen,
  closeMenu,
  visibleSections,
  visibleReportSections,
}: {
  open: boolean;
  activeSection: AppSection;
  setActiveSection: (section: AppSection) => void;
  reportsOpen: boolean;
  setReportsOpen: (open: boolean) => void;
  closeMenu: () => void;
  visibleSections: typeof sections;
  visibleReportSections: typeof reportSections;
}) {
  const reportActive = isReportSection(activeSection);
  const selectedReport = normalizeReportSection(activeSection);

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out lg:hidden",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="overflow-hidden">
        <nav
          className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2 shadow-sm"
          aria-label="Mobile navigation"
        >
          {visibleSections.map((section) => {
            const Icon = section.icon;
            const selected = section.isReportsMenu
              ? reportActive
              : activeSection === section.id;

            return (
              <div key={section.id}>
                <Button
                  type="button"
                  variant={selected ? "primary" : "ghost"}
                  onClick={() => {
                    if (section.isReportsMenu) {
                      setReportsOpen(!reportsOpen);

                      if (!reportActive) {
                        setActiveSection("report-transactions");
                      }

                      return;
                    }

                    setReportsOpen(false);
                    setActiveSection(section.id);
                    closeMenu();
                  }}
                  className={cn(
                    "h-11 w-full justify-start gap-3 px-3 text-left",
                    !selected && inactiveNavigationButtonClass,
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{section.label}</span>
                  {section.isReportsMenu && (
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        reportsOpen && "rotate-180",
                      )}
                    />
                  )}
                </Button>

                {section.isReportsMenu && reportsOpen && (
                  <div className="my-1 ml-4 grid gap-1 border-l border-[var(--border)] pl-2">
                    {visibleReportSections.map((report) => {
                      const ReportIcon = report.icon;
                      const reportSelected = selectedReport === report.id;

                      return (
                        <Button
                          key={report.id}
                          type="button"
                          variant={reportSelected ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => {
                            setActiveSection(report.id);
                            closeMenu();
                          }}
                          className={cn(
                            "h-auto justify-start gap-3 px-3 py-2 text-left whitespace-normal",
                            !reportSelected && inactiveNavigationButtonClass,
                          )}
                        >
                          <ReportIcon className="h-4 w-4 shrink-0" />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">
                              {report.label}
                            </span>
                            <span className="block text-xs leading-snug text-[var(--muted)]">
                              {report.description}
                            </span>
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid h-10 w-14 shrink-0 place-items-center rounded-md bg-mtn-yellow p-2 dark:bg-ink",
        className,
      )}
    >
      <Image
        src="/logos/mtn-logo-black.svg"
        alt="MTN"
        width={56}
        height={24}
        className="block h-6 w-auto dark:hidden"
        style={{ width: "auto" }}
        priority
      />
      <Image
        src="/logos/mtn-logo-white.svg"
        alt="MTN"
        width={56}
        height={24}
        className="hidden h-6 w-auto dark:block"
        style={{ width: "auto" }}
        priority
      />
    </div>
  );
}

export function AppShell() {
  const authSession = useAuthSessionSnapshot();
  const activeSection = useUiStore((state) => state.activeSection);
  const setActiveSection = useUiStore((state) => state.setActiveSection);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const currentUser = authSession?.user ?? null;
  const currentRole = currentUser?.role ?? "customer";
  const visibleSections = sections.filter((section) =>
    section.roles.includes(currentRole),
  );
  const visibleReportSections = reportSections.filter((section) =>
    section.roles.includes(currentRole),
  );
  const allowedSectionIds = new Set<AppSection>([
    ...visibleSections.map((section) => section.id),
    ...visibleReportSections.map((section) => section.id),
  ]);
  const fallbackSection = visibleSections[0]?.id ?? "overview";
  const effectiveActiveSection = allowedSectionIds.has(activeSection)
    ? activeSection
    : fallbackSection;
  const reportActive = isReportSection(effectiveActiveSection);
  const [reportsMenuOpen, setReportsMenuOpen] = useState(reportActive);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileReportsOpen, setMobileReportsOpen] = useState(reportActive);

  useEffect(() => {
    if (authSession === null) {
      window.location.replace("/auth/login");
    }
  }, [authSession]);

  useEffect(() => {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const shouldUseDark =
      theme === "dark" || (theme === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", shouldUseDark);
  }, [theme]);

  useEffect(() => {
    const section = new URLSearchParams(window.location.search).get("section");

    if (isAppSection(section)) {
      setActiveSection(section);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [setActiveSection]);

  useEffect(() => {
    if (activeSection !== effectiveActiveSection) {
      setActiveSection(effectiveActiveSection);
    }
  }, [activeSection, effectiveActiveSection, setActiveSection]);

  if (!currentUser) {
    return <BrandLoader fullScreen label="Loading secure workspace" />;
  }

  function handleSignOut() {
    clearAuthSession();
    window.location.assign("/auth/login");
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[70] hidden flex-col overflow-visible border-r border-[var(--border)] bg-[var(--panel)] transition-all lg:flex",
          sidebarCollapsed ? "w-20 p-3" : "w-72 p-5",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3",
            sidebarCollapsed && "justify-center",
          )}
        >
          <BrandMark />
          {!sidebarCollapsed && (
            <div>
              <p className="text-sm font-semibold">Bulk Data Wholesale</p>
              <p className="text-xs text-[var(--muted)]">
                BDS operating console
              </p>
            </div>
          )}
        </div>

        <nav className={cn("mt-8 space-y-1", sidebarCollapsed && "space-y-2")}>
          {visibleSections.map((section) => {
            const Icon = section.icon;
            const selected = section.isReportsMenu
              ? reportActive
              : effectiveActiveSection === section.id;

            if (section.isReportsMenu) {
              return (
                <div key={section.id} className="relative">
                  <Button
                    type="button"
                    variant={selected ? "primary" : "ghost"}
                    title={section.label}
                    aria-label={section.label}
                    aria-expanded={reportsMenuOpen}
                    onClick={() => {
                      setReportsMenuOpen((current) => !current);
                      if (!reportActive) {
                        setActiveSection(
                          visibleReportSections[0]?.id ?? fallbackSection,
                        );
                      }
                    }}
                    className={cn(
                      "h-11 w-full",
                      sidebarCollapsed
                        ? "justify-center px-0"
                        : "justify-start gap-3 px-3 text-left",
                      !selected && inactiveNavigationButtonClass,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {!sidebarCollapsed && (
                      <>
                        <span className="flex-1">{section.label}</span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition",
                            reportsMenuOpen && "rotate-180",
                          )}
                        />
                      </>
                    )}
                  </Button>
                  {reportsMenuOpen && !sidebarCollapsed && (
                    <ReportsMegaMenu
                      activeSection={activeSection}
                      visibleReportSections={visibleReportSections}
                      setActiveSection={setActiveSection}
                      variant="inline"
                    />
                  )}
                  {reportsMenuOpen && sidebarCollapsed && (
                    <ReportsMegaMenu
                      activeSection={activeSection}
                      visibleReportSections={visibleReportSections}
                      setActiveSection={setActiveSection}
                      variant="flyout"
                    />
                  )}
                </div>
              );
            }

            return (
              <Button
                key={section.id}
                type="button"
                variant={selected ? "primary" : "ghost"}
                title={section.label}
                aria-label={section.label}
                onClick={() => {
                  setReportsMenuOpen(false);
                  setActiveSection(section.id);
                }}
                className={cn(
                  "h-11 w-full",
                  sidebarCollapsed
                    ? "justify-center px-0"
                    : "justify-start gap-3 px-3 text-left",
                  !selected && inactiveNavigationButtonClass,
                )}
              >
                <Icon className="h-4 w-4" />
                {!sidebarCollapsed && section.label}
              </Button>
            );
          })}
        </nav>
      </aside>

      <div
        className={cn(
          "min-w-0 transition-all",
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-72",
        )}
      >
        <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--panel)]/95 px-3 py-3 backdrop-blur sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((current) => !current)}
                className={cn("relative lg:hidden", headerIconButtonClass)}
              >
                <Menu
                  className={cn(
                    "absolute h-4 w-4 transition-all duration-300",
                    mobileMenuOpen
                      ? "rotate-90 scale-0 opacity-0"
                      : "rotate-0 scale-100 opacity-100",
                  )}
                />
                <X
                  className={cn(
                    "absolute h-4 w-4 transition-all duration-300",
                    mobileMenuOpen
                      ? "rotate-0 scale-100 opacity-100"
                      : "-rotate-90 scale-0 opacity-0",
                  )}
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-label={
                  sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                }
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className={cn("hidden lg:inline-flex", headerIconButtonClass)}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </Button>
              <BrandMark className="lg:hidden" />
              <div className={cn("min-w-0", !sidebarCollapsed && "lg:hidden")}>
                <h1 className="text-lg font-semibold md:text-xl">
                  Bulk Data Wholesale Service
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationsMenu user={currentUser} />
              <Button
                variant="secondary"
                size="sm"
                title="Toggle theme"
                aria-label="Toggle theme"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className={headerIconButtonClass}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
              <AccountMenu
                user={currentUser}
                setActiveSection={setActiveSection}
                closeMobileMenu={() => setMobileMenuOpen(false)}
                onSignOut={handleSignOut}
              />
            </div>
          </div>
          <MobileNavigationMenu
            open={mobileMenuOpen}
            activeSection={effectiveActiveSection}
            setActiveSection={setActiveSection}
            reportsOpen={mobileReportsOpen}
            setReportsOpen={setMobileReportsOpen}
            closeMenu={() => setMobileMenuOpen(false)}
            visibleSections={visibleSections}
            visibleReportSections={visibleReportSections}
          />
        </header>

        <main className="w-full min-w-0 px-2 py-3 sm:px-3 md:px-4">
          {renderSection(effectiveActiveSection, currentRole)}
        </main>
      </div>
    </div>
  );
}
