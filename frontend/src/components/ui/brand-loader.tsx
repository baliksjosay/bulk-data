import Image from "next/image";
import { cn } from "@/lib/cn";

type BrandLoaderProps = Readonly<{
  label?: string;
  fullScreen?: boolean;
  overlay?: boolean;
  overlayBackdrop?: boolean;
  className?: string;
}>;

export function BrandLoader({
  label = "Loading Bulk Data Wholesale",
  fullScreen = false,
  overlay = false,
  overlayBackdrop = true,
  className,
}: BrandLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "grid place-items-center bg-background text-foreground",
        fullScreen && "min-h-screen",
        overlay && "fixed inset-0 z-50 p-4",
        overlayBackdrop
          ? overlay && "bg-background/76 backdrop-blur-sm"
          : overlay && "bg-transparent",
        className,
      )}
    >
      <div className="relative flex w-full max-w-xs flex-col items-center gap-5 rounded-[1.35rem] border border-border/60 bg-card/86 p-7 text-card-foreground shadow-[0_24px_70px_rgba(20,20,20,0.14)] backdrop-blur-md dark:bg-card/78 dark:shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
        <div className="relative grid size-28 place-items-center">
          <div className="absolute inset-0 rounded-full border border-current/12" />
          <div className="absolute inset-2 animate-[brand-loader-spin_1.8s_linear_infinite] rounded-full border-2 border-transparent border-r-current/35 border-t-current/80" />
          <div className="absolute inset-5 animate-[brand-loader-pulse_1.4s_ease-in-out_infinite] rounded-full bg-primary/25" />
          <div className="relative grid size-16 place-items-center rounded-full bg-primary shadow-[0_10px_28px_rgba(255,203,5,0.24)]">
            <Image
              src="/logos/mtn-logo-black.svg"
              alt="MTN"
              width={58}
              height={28}
              className="h-7 w-auto"
              style={{ width: "auto", height: "auto" }}
            />
          </div>
        </div>

        <div className="relative w-full text-center">
          <p className="text-sm font-semibold">{label}</p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-current/15">
            <div className="h-full w-1/2 animate-table-progress-main rounded-full bg-current" />
          </div>
        </div>

        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}
