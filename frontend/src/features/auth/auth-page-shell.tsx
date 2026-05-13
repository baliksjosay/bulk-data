import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

type AuthPageShellProps = Readonly<{
  title: string;
  description: string;
  children: ReactNode;
  aside?: ReactNode;
}>;

export function AuthPageShell({
  title,
  description,
  children,
  aside,
}: AuthPageShellProps) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-transparent">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/auth/yellow-banner.jpg)" }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_38%,rgba(255,255,255,0.1)_100%)]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl items-center p-4 sm:p-6">
        <section className="grid w-full gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <aside className="hidden p-4 text-black lg:flex lg:flex-col lg:justify-between lg:pr-8">
            <div>
              <Link href="/" className="inline-flex">
                <Image
                  src="/logos/mtn-logo-black.svg"
                  alt="MTN logo"
                  width={88}
                  height={40}
                  className="h-10 w-auto"
                  style={{ width: "auto" }}
                  priority
                />
              </Link>
              <h1 className="mt-6 text-4xl font-semibold leading-tight text-balance sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-black/78">
                {description}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-black/68">
                The Unstoppable Network
              </p>
              {aside ? (
                <div className="max-w-md rounded-[1.2rem] border border-white/18 bg-white/10 p-4 text-sm text-black/82 backdrop-blur-[10px]">
                  {aside}
                </div>
              ) : null}
            </div>
          </aside>

          <div className="w-full rounded-[1.45rem] border border-white/20 bg-white/9 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.14)] backdrop-blur-[22px] sm:p-6">
            <div className="mb-5 flex items-center gap-3 lg:hidden">
              <Link href="/" className="inline-flex shrink-0">
                <Image
                  src="/logos/mtn-logo-black.svg"
                  alt="MTN logo"
                  width={80}
                  height={36}
                  className="h-9 w-auto"
                  style={{ width: "auto" }}
                  priority
                />
              </Link>
              <p className="text-base font-semibold text-black/72">{title}</p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
