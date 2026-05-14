"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppSection =
  | "overview"
  | "admin"
  | "service-requests"
  | "users"
  | "packages"
  | "customer"
  | "reports"
  | "report-transactions"
  | "report-service-requests"
  | "report-customer-activity"
  | "report-bundle-purchases"
  | "report-secondary-numbers"
  | "report-balances"
  | "security"
  | "preferences"
  | "audit";
export type ReportSection = Extract<AppSection, `report-${string}`>;
export type ThemePreference = "light" | "dark" | "system";

interface UiState {
  activeSection: AppSection;
  sidebarCollapsed: boolean;
  theme: ThemePreference;
  selectedCustomerId: string;
  selectedPrimaryMsisdn: string;
  setActiveSection: (section: AppSection) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: ThemePreference) => void;
  setSelectedCustomerContext: (
    customerId: string,
    primaryMsisdn?: string,
  ) => void;
  setSelectedPrimaryMsisdn: (primaryMsisdn: string) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      activeSection: "overview",
      sidebarCollapsed: false,
      theme: "light",
      selectedCustomerId: "",
      selectedPrimaryMsisdn: "",
      setActiveSection: (activeSection) => set({ activeSection }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setTheme: (theme) => set({ theme }),
      setSelectedCustomerContext: (
        selectedCustomerId,
        selectedPrimaryMsisdn = "",
      ) => set({ selectedCustomerId, selectedPrimaryMsisdn }),
      setSelectedPrimaryMsisdn: (selectedPrimaryMsisdn) =>
        set({ selectedPrimaryMsisdn }),
    }),
    {
      name: "mtn-bds-ui",
    },
  ),
);
