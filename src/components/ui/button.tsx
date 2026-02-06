import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// BUTTON — Design System LA Studio Manager
// Variantes: primary, accent, ghost, outline, danger
// Tamanhos: sm, md, lg
// ============================================================

type ButtonVariant = "primary" | "accent" | "ghost" | "outline" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon-sm" | "icon-md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-cyan text-slate-950 hover:bg-accent-cyan/90 font-semibold",
  accent:
    "bg-brand-accent-500 text-white hover:bg-brand-accent-600 font-semibold",
  ghost:
    "text-slate-400 hover:text-white hover:bg-slate-800/50 font-medium",
  outline:
    "border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 font-medium",
  danger:
    "bg-error-500/20 text-error-500 hover:bg-error-500/30 font-semibold",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-9 px-4 text-sm rounded-lg gap-2",
  lg: "h-10 px-5 text-sm rounded-lg gap-2",
  "icon-sm": "h-8 w-8 rounded-lg",
  "icon-md": "h-10 w-10 rounded-xl",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50 disabled:pointer-events-none disabled:opacity-50",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button, type ButtonVariant, type ButtonSize, type ButtonProps };
