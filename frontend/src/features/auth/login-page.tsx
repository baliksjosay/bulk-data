import { LoginForm } from "@/features/auth/login-form";
import { AuthPageShell } from "@/features/auth/auth-page-shell";

export function LoginPage() {
  const isFakeMode = process.env.NEXT_PUBLIC_API_MODE !== "live";

  return (
    <AuthPageShell
      title="Bulk Data Wholesale Service"
      description="Sign in to buy packages, track payments, view reports, manage security settings, and control your service account."
      aside={<p>Built for customer teams across desktop and mobile.</p>}
    >
      <div className="space-y-4">
        <div className="space-y-2 text-center">
          <div>
            <h2 className="text-2xl font-semibold text-black">Sign in</h2>
            <p className="text-sm text-black/62">
              Use OTP or email and password to continue.
              {isFakeMode ? " Fake mode." : null}
            </p>
          </div>
        </div>

        <LoginForm />

        <p className="text-center text-[11px] font-medium tracking-[0.12em] text-black/54">
          The Unstoppable Network
        </p>
      </div>
    </AuthPageShell>
  );
}
