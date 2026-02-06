import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// BADGE — Design System LA Studio Manager
// Variantes: neutral, status, type, priority, platform
// Tamanhos: sm, md
// ============================================================

type BadgeVariant = "neutral" | "status" | "type" | "platform";
type BadgeSize = "sm" | "md";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Cor customizada (hex) — usada para variantes type/status/platform */
  color?: string;
  children: ReactNode;
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 text-[9px]",
  md: "px-2 py-0.5 text-[10px]",
};

function Badge({
  variant = "neutral",
  size = "md",
  color,
  className,
  style,
  children,
  ...props
}: BadgeProps) {
  const baseClasses = "inline-flex items-center gap-1 rounded-full font-semibold leading-tight whitespace-nowrap";

  // Variante com cor dinâmica (type, status, platform)
  if (color && variant !== "neutral") {
    return (
      <span
        className={cn(baseClasses, sizeStyles[size], className)}
        style={{
          backgroundColor: `${color}20`,
          color: color,
          ...style,
        }}
        {...props}
      >
        {children}
      </span>
    );
  }

  // Variante neutra (sem cor dinâmica)
  return (
    <span
      className={cn(
        baseClasses,
        sizeStyles[size],
        "bg-slate-800/80 text-slate-400",
        className
      )}
      style={style}
      {...props}
    >
      {children}
    </span>
  );
}

Badge.displayName = "Badge";

export { Badge, type BadgeVariant, type BadgeSize, type BadgeProps };
