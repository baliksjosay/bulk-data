"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { BrandLoader } from "@/components/ui/brand-loader";
import type { SocialLoginProvider } from "@/types/domain";

function getProvider(value: unknown): SocialLoginProvider | null {
  const provider = Array.isArray(value) ? value[0] : value;

  return provider === "google" || provider === "microsoft" ? provider : null;
}

export default function SocialAuthCallbackPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const provider = getProvider(params.provider);
    const hashParams = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    );
    const queryParams = new URLSearchParams(window.location.search);
    const idToken = hashParams.get("id_token") ?? queryParams.get("id_token");
    const state = hashParams.get("state") ?? queryParams.get("state");
    const error = hashParams.get("error") ?? queryParams.get("error");
    const errorDescription =
      hashParams.get("error_description") ??
      queryParams.get("error_description");

    if (window.opener && provider && (idToken || error)) {
      window.opener.postMessage(
        {
          type: "mtn-bds-social-auth",
          provider,
          idToken: idToken ?? undefined,
          state: state ?? undefined,
          error: error ?? undefined,
          errorDescription: errorDescription ?? undefined,
        },
        window.location.origin,
      );
      window.close();
      return;
    }

    router.replace("/auth/login");
  }, [params.provider, router]);

  return <BrandLoader overlay label="Completing sign in" />;
}
