"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { clearAuthSession, persistAuthSession } from "@/lib/auth-session";

type AuthSessionRedirectProps = Readonly<{
  children: ReactNode;
}>;

export function AuthSessionRedirect({ children }: AuthSessionRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    api
      .currentAuthSession()
      .then((session) => {
        if (!isMounted) {
          return;
        }

        persistAuthSession(session);
        router.replace(session.nextRoute as Route);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        clearAuthSession();
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  return <>{children}</>;
}
