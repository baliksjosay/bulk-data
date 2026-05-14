"use client"

import { Eye, EyeOff } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

const inputClassName =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"

const inputFocusClassName =
  "focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-primary/45 dark:focus-visible:border-primary dark:focus-visible:ring-primary/35"

const inputInvalidClassName =
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40"

function PasswordInput({
  className,
  disabled,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const [passwordVisible, setPasswordVisible] = React.useState(false)
  const Icon = passwordVisible ? EyeOff : Eye

  return (
    <div className="relative w-full">
      <input
        type={passwordVisible ? "text" : "password"}
        data-slot="input"
        disabled={disabled}
        className={cn(
          inputClassName,
          inputFocusClassName,
          inputInvalidClassName,
          "pr-11",
          className
        )}
        {...props}
      />
      <button
        type="button"
        aria-label={passwordVisible ? "Hide password" : "Show password"}
        aria-pressed={passwordVisible}
        className="absolute inset-y-0 right-1.5 grid w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:pointer-events-none disabled:opacity-40"
        disabled={disabled}
        onClick={() => setPasswordVisible((current) => !current)}
      >
        <Icon aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}

function Input({ className, type, disabled, ...props }: React.ComponentProps<"input">) {
  if (type === "password") {
    return <PasswordInput className={className} disabled={disabled} {...props} />
  }

  return (
    <input
      type={type}
      data-slot="input"
      disabled={disabled}
      className={cn(
        inputClassName,
        inputFocusClassName,
        inputInvalidClassName,
        className
      )}
      {...props}
    />
  )
}

export { Input }
