"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { BundleInsightDialog } from "@/features/customer/bundle-insight-dialog";
import { PaymentStatusCenter } from "@/features/customer/payment-status-center";
import { RealtimeUpdates } from "@/features/realtime/realtime-updates";
import { ApiClientError } from "@/lib/api-client";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: (failureCount, error) => {
              if (error instanceof ApiClientError) {
                return error.status >= 500 && failureCount < 2;
              }

              return failureCount < 2;
            },
            retryDelay: (attemptIndex) =>
              Math.min(1000 * 2 ** attemptIndex, 5000),
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <BundleInsightDialog />
      <RealtimeUpdates />
      <PaymentStatusCenter />
    </QueryClientProvider>
  );
}
