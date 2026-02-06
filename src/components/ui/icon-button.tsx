import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// ICON BUTTON — Design System LA Studio Manager
// Tamanhos: sm (32px), md (40px)
// Variantes: outline, ghost
// ============================================================

type IconButtonSize = "sm" | "md";
type IconButtonVariant = "outline" | "ghost";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  children: ReactNode;
}

const sizeStyles: Record<IconButtonSize, string> = {
  sm: "h-8 w-8 rounded-lg",
  md: "h-10 w-10 rounded-xl",
};

const variantStyles: Record<IconButtonVariant, string> = {
  outline:
    "border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 bg-transparent",
  ghost:
    "text-slate-500 hover:text-white hover:bg-slate-800/50",
};

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = "sm", variant = "outline", className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50 disabled:pointer-events-none disabled:opacity-50",
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";

export { IconButton, type IconButtonSize, type IconButtonVariant, type IconButtonProps };
