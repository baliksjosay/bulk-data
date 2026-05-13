"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { BundleInsightDialog } from "@/features/customer/bundle-insight-dialog";
import { PaymentStatusCenter } from "@/features/customer/payment-status-center";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <BundleInsightDialog />
      <PaymentStatusCenter />
    </QueryClientProvider>
  );
}
