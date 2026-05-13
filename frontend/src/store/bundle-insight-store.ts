import { create } from "zustand";
import type { BalanceResult, SecondaryUsageResult } from "@/types/domain";

type BundleInsightView = "balance" | "usage";
type BundleInsightStatus = "idle" | "loading" | "ready" | "error";

interface BundleInsightRequestContext {
  primaryMsisdn?: string;
  secondaryMsisdn?: string;
}

interface BundleInsightState {
  open: boolean;
  view: BundleInsightView;
  status: BundleInsightStatus;
  balance?: BalanceResult;
  usage?: SecondaryUsageResult;
  errorMessage: string;
  requestContext: BundleInsightRequestContext;
  openBalanceLoading: (primaryMsisdn: string) => void;
  openUsageLoading: (primaryMsisdn: string, secondaryMsisdn: string) => void;
  showBalance: (balance: BalanceResult) => void;
  showUsage: (usage: SecondaryUsageResult) => void;
  showError: (message: string) => void;
  close: () => void;
}

export const useBundleInsightStore = create<BundleInsightState>()((set) => ({
  open: false,
  view: "balance",
  status: "idle",
  errorMessage: "",
  requestContext: {},
  openBalanceLoading: (primaryMsisdn) =>
    set({
      open: true,
      view: "balance",
      status: "loading",
      balance: undefined,
      usage: undefined,
      errorMessage: "",
      requestContext: { primaryMsisdn },
    }),
  openUsageLoading: (primaryMsisdn, secondaryMsisdn) =>
    set({
      open: true,
      view: "usage",
      status: "loading",
      balance: undefined,
      usage: undefined,
      errorMessage: "",
      requestContext: { primaryMsisdn, secondaryMsisdn },
    }),
  showBalance: (balance) =>
    set({
      open: true,
      view: "balance",
      status: "ready",
      balance,
      usage: undefined,
      errorMessage: "",
      requestContext: { primaryMsisdn: balance.primaryMsisdn },
    }),
  showUsage: (usage) =>
    set({
      open: true,
      view: "usage",
      status: "ready",
      balance: undefined,
      usage,
      errorMessage: "",
      requestContext: {
        primaryMsisdn: usage.primaryMsisdn,
        secondaryMsisdn: usage.secondaryMsisdn,
      },
    }),
  showError: (message) =>
    set((state) => ({
      open: true,
      status: "error",
      errorMessage: message,
      balance: undefined,
      usage: undefined,
      requestContext: state.requestContext,
      view: state.view,
    })),
  close: () =>
    set({
      open: false,
      status: "idle",
      errorMessage: "",
      balance: undefined,
      usage: undefined,
      requestContext: {},
    }),
}));
