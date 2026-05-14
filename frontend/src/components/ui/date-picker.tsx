"use client";

import { CalendarIcon, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const dateValuePattern = /^\d{4}-\d{2}-\d{2}$/;

function parseDateValue(value: string | undefined) {
  if (!value || !dateValuePattern.test(value)) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return date;
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-UG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export interface DatePickerProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  fieldClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  min?: string | number;
  max?: string | number;
}

export function DatePicker({
  label,
  value,
  onValueChange,
  className,
  fieldClassName,
  placeholder = "Pick date",
  disabled,
  required,
  name,
  min,
  max,
}: DatePickerProps) {
  const generatedId = useId();
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateValue(value);
  const minDate = parseDateValue(typeof min === "string" ? min : undefined);
  const maxDate = parseDateValue(typeof max === "string" ? max : undefined);
  const labelText = selectedDate ? formatDateLabel(selectedDate) : placeholder;
  const disabledDateMatcher = useMemo(() => {
    if (!minDate && !maxDate) {
      return undefined;
    }

    return (date: Date) => {
      if (minDate && date < minDate) {
        return true;
      }

      if (maxDate && date > maxDate) {
        return true;
      }

      return false;
    };
  }, [maxDate, minDate]);

  return (
    <div className={cn("flex flex-col items-stretch gap-2 text-sm font-medium", fieldClassName)}>
      <Label htmlFor={generatedId}>{label}</Label>
      {name && <input type="hidden" name={name} value={value} required={required} />}
      <div className="flex min-w-0 items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              id={generatedId}
              type="button"
              disabled={disabled}
              className={cn(
                "flex h-10 min-w-0 flex-1 items-center justify-start gap-2 rounded-md border border-input bg-transparent px-4 py-2 text-left text-sm font-normal text-foreground shadow-xs transition-[color,box-shadow] outline-none hover:bg-secondary/70 focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-primary/45 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:focus-visible:border-primary dark:focus-visible:ring-primary/35",
                !selectedDate && "text-muted-foreground",
                className,
              )}
            >
              <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{labelText}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto border-border/70 p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate}
              disabled={disabledDateMatcher}
              onSelect={(date) => {
                if (!date) {
                  return;
                }

                onValueChange(toDateValue(date));
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>

        <button
          type="button"
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border/60 bg-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 dark:focus-visible:ring-primary/35",
            (!value || disabled) && "invisible pointer-events-none",
          )}
          aria-label={`Clear ${label}`}
          tabIndex={!value || disabled ? -1 : undefined}
          onClick={() => onValueChange("")}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
