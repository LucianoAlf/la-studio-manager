"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// SWITCH — Design System LA Studio Manager
// Toggle on/off estilizado
// ============================================================

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  description?: string;
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ checked, onCheckedChange, label, description, disabled, className, id, ...props }, ref) => {
    const switchId = id || `switch-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <div className={cn("flex items-center justify-between gap-3", className)}>
        {(label || description) && (
          <label htmlFor={switchId} className="flex-1 cursor-pointer select-none">
            {label && (
              <span className="block text-sm font-medium text-slate-200">{label}</span>
            )}
            {description && (
              <span className="block text-xs text-slate-500 mt-0.5">{description}</span>
            )}
          </label>
        )}
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          id={switchId}
          role="switch"
          type="button"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onCheckedChange(!checked)}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50",
            checked ? "bg-accent-cyan" : "bg-slate-700",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          <span
            className={cn(
              "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
              checked ? "translate-x-[18px]" : "translate-x-[2px]"
            )}
          />
        </button>
      </div>
    );
  }
);

Switch.displayName = "Switch";

export { Switch, type SwitchProps };
