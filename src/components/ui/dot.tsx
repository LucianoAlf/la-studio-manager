import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// DOT — Design System LA Studio Manager
// Dot colorido para indicadores de status/tipo/plataforma
// Tamanhos: xs (4px), sm (6px), md (8px), lg (10px)
// ============================================================

type DotSize = "xs" | "sm" | "md" | "lg";

interface DotProps extends HTMLAttributes<HTMLSpanElement> {
  /** Cor do dot (hex) */
  color: string;
  size?: DotSize;
}

const sizeStyles: Record<DotSize, string> = {
  xs: "h-1 w-1",
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-2.5 w-2.5",
};

function Dot({ color, size = "md", className, style, ...props }: DotProps) {
  return (
    <span
      className={cn("inline-block flex-shrink-0 rounded-full", sizeStyles[size], className)}
      style={{ backgroundColor: color, ...style }}
      {...props}
    />
  );
}

Dot.displayName = "Dot";

export { Dot, type DotSize, type DotProps };
