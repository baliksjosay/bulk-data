import Image from "next/image";
import { cn } from "@/lib/cn";

type BrandLoaderProps = Readonly<{
  label?: string;
  fullScreen?: boolean;
  overlay?: boolean;
  className?: string;
}>;

export function BrandLoader({
  label = "Loading Bulk Data Wholesale",
  fullScreen = false,
  overlay = false,
  className,
}: BrandLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "grid place-items-center bg-[var(--background)] text-[var(--foreground)]",
        fullScreen && "min-h-screen",
        overlay && "fixed inset-0 z-50 bg-black/35 p-4 backdrop-blur-md",
        className,
      )}
    >
      <div className="relative flex w-full max-w-xs flex-col items-center gap-5 rounded-[1.35rem] border border-white/18 bg-primary p-7 text-primary-foreground shadow-[0_28px_90px_rgba(0,0,0,0.2)]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.35rem]">
          <div className="absolute -left-16 top-4 size-36 rounded-full bg-white/20 blur-2xl" />
          <div className="absolute -right-20 bottom-0 size-44 rounded-full bg-black/15 blur-2xl" />
        </div>

        <div className="relative grid size-28 place-items-center">
          <div className="absolute inset-0 rounded-full border border-black/12" />
          <div className="absolute inset-2 animate-[brand-loader-spin_1.8s_linear_infinite] rounded-full border-2 border-transparent border-t-black/80 border-r-black/35" />
          <div className="absolute inset-5 animate-[brand-loader-pulse_1.4s_ease-in-out_infinite] rounded-full bg-white/55" />
          <div className="relative grid size-16 place-items-center rounded-full bg-white shadow-[0_14px_34px_rgba(0,0,0,0.18)]">
            <Image
              src="/logos/mtn-logo-black.svg"
              alt="MTN"
              width={58}
              height={28}
              className="h-7 w-auto"
              style={{ width: "auto" }}
              priority={fullScreen}
            />
          </div>
        </div>

        <div className="relative w-full text-center">
          <p className="text-sm font-semibold">{label}</p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/15">
            <div className="h-full w-1/2 animate-table-progress-main rounded-full bg-black" />
          </div>
        </div>

        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}
