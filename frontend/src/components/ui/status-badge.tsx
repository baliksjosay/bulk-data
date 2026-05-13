import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  label: string;
  tone?: "green" | "yellow" | "red" | "blue" | "neutral";
}

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-sm px-2 py-1 font-semibold",
        tone === "green" && "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
        tone === "yellow" && "bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200",
        tone === "red" && "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
        tone === "blue" && "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
        tone === "neutral" && "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
      )}
    >
      {label}
    </Badge>
  );
}
