"use client";

import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

type OtpCodeInputProps = Readonly<{
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  inputClassName?: string;
}>;

export function OtpCodeInput({
  value,
  onChange,
  length = 5,
  disabled = false,
  ariaLabel = "OTP Code",
  className,
  inputClassName,
}: OtpCodeInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = useMemo(() => {
    const cleaned = value.replace(/\D/g, "").slice(0, length);
    return Array.from({ length }, (_, idx) => cleaned[idx] ?? "");
  }, [length, value]);

  const commitDigits = (nextDigits: readonly string[]) => {
    onChange(nextDigits.join("").replace(/\D/g, "").slice(0, length));
  };

  const replaceAt = (index: number, digit: string) => {
    const nextDigits = [...digits];
    nextDigits[index] = digit;
    commitDigits(nextDigits);
  };

  const clearFrom = (index: number) => {
    const nextDigits = [...digits];
    for (let cursor = index; cursor < length; cursor += 1) {
      nextDigits[cursor] = "";
    }
    commitDigits(nextDigits);
  };

  const fillFrom = (startIndex: number, raw: string) => {
    const chunk = raw.replace(/\D/g, "");
    if (!chunk) return;
    const nextDigits = [...digits];
    let writeIndex = startIndex;
    for (const item of chunk) {
      if (writeIndex >= length) break;
      nextDigits[writeIndex] = item;
      writeIndex += 1;
    }
    commitDigits(nextDigits);
    focusAt(Math.min(writeIndex, length - 1));
  };

  const focusAt = (index: number) => {
    if (index < 0 || index >= length) return;
    refs.current[index]?.focus();
    refs.current[index]?.select();
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-center gap-2">
        {digits.map((digit, index) => (
          <input
            key={`otp-${index}`}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            disabled={disabled}
            aria-label={`${ariaLabel} digit ${index + 1}`}
            className={cn(
              "h-10 w-10 rounded-md border bg-background text-center text-base font-semibold",
              inputClassName,
            )}
            onChange={(event) => {
              const raw = event.target.value.replace(/\D/g, "");
              if (!raw) {
                clearFrom(index);
                return;
              }
              if (raw.length === 1) {
                replaceAt(index, raw);
                focusAt(index + 1);
                return;
              }
              fillFrom(index, raw);
            }}
            onKeyDown={(event) => {
              if (/^\d$/.test(event.key)) {
                event.preventDefault();
                replaceAt(index, event.key);
                focusAt(index + 1);
                return;
              }

              if (event.key === "Backspace") {
                event.preventDefault();
                if (digits[index]) {
                  clearFrom(index);
                  return;
                }
                const previousIndex = index - 1;
                if (previousIndex >= 0) {
                  clearFrom(previousIndex);
                  focusAt(previousIndex);
                }
                return;
              }
              if (event.key === "Delete") {
                event.preventDefault();
                clearFrom(index);
                return;
              }
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                focusAt(index - 1);
                return;
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                focusAt(index + 1);
              }
            }}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
              if (!pasted) return;
              event.preventDefault();
              fillFrom(index, pasted);
            }}
            onFocus={(event) => {
              event.currentTarget.select();
            }}
            onClick={(event) => {
              event.currentTarget.select();
            }}
          />
        ))}
      </div>
    </div>
  );
}
