"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("rounded-md bg-popover p-3 text-popover-foreground", className)}
      classNames={{
        root: cn("w-fit", classNames?.root),
        months: cn("flex flex-col gap-4", classNames?.months),
        month: cn("space-y-3", classNames?.month),
        month_caption: cn("flex h-9 items-center justify-center", classNames?.month_caption),
        caption_label: cn("text-sm font-semibold", classNames?.caption_label),
        nav: cn("absolute inset-x-3 top-3 flex items-center justify-between", classNames?.nav),
        button_previous: cn(
          "inline-flex size-8 items-center justify-center rounded-md border border-border/60 bg-transparent text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40",
          classNames?.button_previous,
        ),
        button_next: cn(
          "inline-flex size-8 items-center justify-center rounded-md border border-border/60 bg-transparent text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40",
          classNames?.button_next,
        ),
        chevron: cn("size-4", classNames?.chevron),
        month_grid: cn("w-full border-collapse", classNames?.month_grid),
        weekdays: cn("flex", classNames?.weekdays),
        weekday: cn("size-9 text-center text-xs font-medium text-muted-foreground", classNames?.weekday),
        week: cn("mt-1 flex w-full", classNames?.week),
        day: cn(
          "relative size-9 p-0 text-center text-sm",
          "[&[aria-selected=true]_button]:bg-primary [&[aria-selected=true]_button]:text-primary-foreground",
          "[&[data-today=true]_button]:border [&[data-today=true]_button]:border-primary/70",
          "[&[data-outside=true]_button]:text-muted-foreground [&[data-outside=true]_button]:opacity-45",
          "[&[data-disabled=true]_button]:pointer-events-none [&[data-disabled=true]_button]:opacity-35",
          classNames?.day,
        ),
        day_button: cn(
          "inline-flex size-9 items-center justify-center rounded-md bg-transparent text-sm font-normal text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 aria-selected:hover:bg-primary/85 aria-selected:hover:text-primary-foreground",
          classNames?.day_button,
        ),
        selected: cn("", classNames?.selected),
        range_start: cn("[&_button]:!bg-primary [&_button]:!text-primary-foreground", classNames?.range_start),
        range_middle: cn(
          "[&_button]:!rounded-none [&_button]:!bg-accent [&_button]:!text-accent-foreground",
          classNames?.range_middle,
        ),
        range_end: cn("[&_button]:!bg-primary [&_button]:!text-primary-foreground", classNames?.range_end),
        today: cn("", classNames?.today),
        outside: cn("", classNames?.outside),
        disabled: cn("", classNames?.disabled),
        hidden: cn("invisible", classNames?.hidden),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, size, disabled, ...chevronProps }) =>
          orientation === "left" ? (
            <ChevronLeft
              className={cn("size-4", chevronClassName)}
              data-disabled={disabled ? "true" : undefined}
              size={size}
              {...chevronProps}
            />
          ) : (
            <ChevronRight
              className={cn("size-4", chevronClassName)}
              data-disabled={disabled ? "true" : undefined}
              size={size}
              {...chevronProps}
            />
          ),
        ...props.components,
      }}
      {...props}
    />
  );
}

export { Calendar };
