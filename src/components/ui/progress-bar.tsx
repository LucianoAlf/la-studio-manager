import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// PROGRESS BAR — Design System LA Studio Manager
// Tamanhos: thin (3px), normal (6px), thick (10px)
// ============================================================

type ProgressSize = "thin" | "normal" | "thick";

interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Valor de 0 a 100 */
  value: number;
  /** Cor da barra preenchida (hex ou classe Tailwind) */
  color?: string;
  /** Classe Tailwind para cor (alternativa a hex) */
  colorClass?: string;
  size?: ProgressSize;
}

const sizeStyles: Record<ProgressSize, string> = {
  thin: "h-[3px]",
  normal: "h-1.5",
  thick: "h-2.5",
};

function ProgressBar({
  value,
  color,
  colorClass,
  size = "normal",
  className,
  ...props
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div
      className={cn("w-full rounded-full bg-slate-800", sizeStyles[size], className)}
      {...props}
    >
      <div
        className={cn("h-full rounded-full transition-all", colorClass)}
        style={{
          width: `${clampedValue}%`,
          ...(color && !colorClass ? { backgroundColor: color } : {}),
        }}
      />
    </div>
  );
}

ProgressBar.displayName = "ProgressBar";

export { ProgressBar, type ProgressSize, type ProgressBarProps };
