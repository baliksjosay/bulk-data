import { LoginPage } from "@/features/auth/login-page";
import { redirectAuthenticatedUserFromAuthPage } from "@/lib/auth-page-redirect";

export default async function AuthLoginPage() {
  await redirectAuthenticatedUserFromAuthPage();

  return <LoginPage />;
}
