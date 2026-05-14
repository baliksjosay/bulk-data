import { Suspense } from "react";
import { BrandLoader } from "@/components/ui/brand-loader";
import { ActivationPage } from "@/features/auth/activation-page";
import { AuthSessionRedirect } from "@/features/auth/auth-session-redirect";
import { redirectAuthenticatedUserFromAuthPage } from "@/lib/auth-page-redirect";

export default async function AuthActivatePage() {
  await redirectAuthenticatedUserFromAuthPage();

  return (
    <AuthSessionRedirect>
      <Suspense fallback={<BrandLoader fullScreen label="Loading activation" />}>
        <ActivationPage />
      </Suspense>
    </AuthSessionRedirect>
  );
}
