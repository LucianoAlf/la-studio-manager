import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// ============================================================
// AVATAR — Design System LA Studio Manager
// Tamanhos: xs (16px), sm (24px), md (32px), lg (48px)
// ============================================================

type AvatarSize = "xs" | "sm" | "md" | "lg";

interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** Inicial(is) a exibir */
  initial: string;
  /** Cor de fundo (hex) */
  color: string;
  size?: AvatarSize;
  /** Borda para sobreposição (stack de avatares) */
  bordered?: boolean;
}

const sizeStyles: Record<AvatarSize, string> = {
  xs: "h-4 w-4 text-[7px]",
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-12 w-12 text-lg",
};

function Avatar({
  initial,
  color,
  size = "sm",
  bordered = false,
  className,
  style,
  ...props
}: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white",
        sizeStyles[size],
        bordered && "border-2 border-slate-900",
        className
      )}
      style={{ backgroundColor: color, ...style }}
      {...props}
    >
      {initial}
    </span>
  );
}

Avatar.displayName = "Avatar";

export { Avatar, type AvatarSize, type AvatarProps };
