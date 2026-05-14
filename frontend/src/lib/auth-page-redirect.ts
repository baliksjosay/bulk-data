import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAuthSessionCookieName,
  getSessionDashboardRoute,
  verifySessionJwt,
} from "@/lib/auth-session-cookie";

export async function redirectAuthenticatedUserFromAuthPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAuthSessionCookieName())?.value;
  const payload = token ? verifySessionJwt(token) : null;

  if (payload) {
    redirect(getSessionDashboardRoute(payload));
  }
}
