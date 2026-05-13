import type { HTMLAttributes } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <Card
      className={cn(
        "gap-0 rounded-lg border-border bg-card p-4 py-4 text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
