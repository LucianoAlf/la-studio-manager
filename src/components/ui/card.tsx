import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// CARD — Design System LA Studio Manager
// Variantes: default, compact, interactive
// ============================================================

type CardVariant = "default" | "compact" | "interactive";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Borda esquerda colorida (hex) */
  borderLeftColor?: string;
  children: ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
  default: "rounded-xl border border-slate-800 bg-slate-900/60 p-6",
  compact: "rounded-lg border border-slate-800 bg-slate-900/60 p-4",
  interactive:
    "rounded-xl border border-slate-800 bg-slate-900/80 p-4 transition-colors hover:bg-slate-800/60 cursor-pointer",
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", borderLeftColor, className, style, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(variantStyles[variant], className)}
        style={{
          ...(borderLeftColor ? { borderLeft: `3px solid ${borderLeftColor}` } : {}),
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export { Card, type CardVariant, type CardProps };
