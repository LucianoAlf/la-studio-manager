import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// CHIP — Design System LA Studio Manager
// Filter chip com toggle on/off e dot colorido
// ============================================================

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Texto do chip */
  label: string;
  /** Cor do dot (hex) */
  dotColor?: string;
  /** Se o chip está ativo */
  active?: boolean;
}

function Chip({
  label,
  dotColor,
  active = true,
  className,
  ...props
}: ChipProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1 text-xs font-medium transition-all",
        active ? "text-slate-200 bg-slate-800/50" : "opacity-40 text-slate-500",
        className
      )}
      {...props}
    >
      {dotColor && (
        <span
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
      )}
      {label}
    </button>
  );
}

Chip.displayName = "Chip";

export { Chip, type ChipProps };
