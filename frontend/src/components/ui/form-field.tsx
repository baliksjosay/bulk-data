"use client";

import type { ComponentProps } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  isPossibleUgandaPhoneInput,
  normalizeUgandaPhoneInput,
  UGANDA_PHONE_PATTERN_SOURCE,
  UGANDA_PHONE_PLACEHOLDER,
  UGANDA_PHONE_TITLE,
} from "@/lib/uganda-phone";
import { cn } from "@/lib/utils";

export interface SelectFieldOption {
  label: string;
  value: string;
  disabled?: boolean;
}

type TextFieldProps = Omit<ComponentProps<typeof Input>, "onChange"> & {
  label: string;
  fieldClassName?: string;
  onValueChange: (value: string) => void;
};

type PhoneFieldProps = Omit<ComponentProps<typeof Input>, "onChange" | "type" | "inputMode" | "value"> & {
  label: string;
  fieldClassName?: string;
  value: string;
  onValueChange: (value: string) => void;
};

type TextareaFieldProps = Omit<ComponentProps<typeof Textarea>, "onChange"> & {
  label: string;
  fieldClassName?: string;
  onValueChange: (value: string) => void;
};

type SelectFieldProps = Omit<ComponentProps<typeof NativeSelect>, "onChange"> & {
  label: string;
  fieldClassName?: string;
  options: SelectFieldOption[];
  onValueChange: (value: string) => void;
};

export function TextField({ label, fieldClassName, className, onValueChange, ...props }: TextFieldProps) {
  if (props.type === "date") {
    return (
      <DatePicker
        label={label}
        fieldClassName={fieldClassName}
        className={className}
        value={typeof props.value === "string" ? props.value : ""}
        onValueChange={onValueChange}
        placeholder={typeof props.placeholder === "string" ? props.placeholder : undefined}
        disabled={props.disabled}
        required={props.required}
        name={props.name}
        min={props.min}
        max={props.max}
      />
    );
  }

  return (
    <Label className={cn("flex flex-col items-stretch gap-2 text-sm font-medium", fieldClassName)}>
      {label}
      <Input
        className={cn("h-10", className)}
        onChange={(event) => onValueChange(event.target.value)}
        {...props}
      />
    </Label>
  );
}

export function PhoneField({ label, fieldClassName, className, value, onValueChange, ...props }: PhoneFieldProps) {
  const phoneValue =
    value || props.required ? normalizeUgandaPhoneInput(value) : "";

  return (
    <Label className={cn("flex flex-col items-stretch gap-2 text-sm font-medium", fieldClassName)}>
      {label}
      <Input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={13}
        pattern={UGANDA_PHONE_PATTERN_SOURCE}
        placeholder={UGANDA_PHONE_PLACEHOLDER}
        title={UGANDA_PHONE_TITLE}
        className={cn("h-10", className)}
        value={phoneValue}
        onChange={(event) => {
          if (!event.target.value && !props.required) {
            onValueChange("");
            return;
          }

          const nextValue = normalizeUgandaPhoneInput(event.target.value);

          if (isPossibleUgandaPhoneInput(nextValue)) {
            onValueChange(nextValue);
          }
        }}
        {...props}
      />
    </Label>
  );
}

export function TextareaField({
  label,
  fieldClassName,
  className,
  onValueChange,
  ...props
}: TextareaFieldProps) {
  return (
    <Label className={cn("flex flex-col items-stretch gap-2 text-sm font-medium", fieldClassName)}>
      {label}
      <Textarea
        className={cn("min-h-32", className)}
        onChange={(event) => onValueChange(event.target.value)}
        {...props}
      />
    </Label>
  );
}

export function SelectField({
  label,
  fieldClassName,
  className,
  options,
  onValueChange,
  ...props
}: SelectFieldProps) {
  return (
    <Label className={cn("flex flex-col items-stretch gap-2 text-sm font-medium", fieldClassName)}>
      {label}
      <NativeSelect
        className={cn("h-10", className)}
        onChange={(event) => onValueChange(event.target.value)}
        {...props}
      >
        {options.map((option) => (
          <NativeSelectOption key={`${label}-${option.value}`} value={option.value} disabled={option.disabled}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Label>
  );
}
