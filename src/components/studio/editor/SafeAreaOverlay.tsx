"use client";

import type { AspectRatioKey } from "@/lib/types/layer-composition";

interface Props {
  aspectRatio: AspectRatioKey;
}

const SAFE_AREAS: Record<AspectRatioKey, { top: number; right: number; bottom: number; left: number; label: string }> = {
  story: { top: 12, right: 5, bottom: 14, left: 5, label: "Safe area Story" },
  reels: { top: 12, right: 5, bottom: 14, left: 5, label: "Safe area Reels" },
  feed: { top: 5, right: 6, bottom: 8, left: 6, label: "Safe area Feed" },
  carousel: { top: 5, right: 6, bottom: 8, left: 6, label: "Safe area Carrossel" },
};

export function SafeAreaOverlay({ aspectRatio }: Props) {
  const area = SAFE_AREAS[aspectRatio];

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="absolute rounded-[18px] border border-dashed border-cyan-300/70 shadow-[0_0_0_1px_rgba(6,182,212,0.2)]"
        style={{
          top: `${area.top}%`,
          right: `${area.right}%`,
          bottom: `${area.bottom}%`,
          left: `${area.left}%`,
        }}
      />
      <div className="absolute left-3 top-3 rounded-full bg-slate-950/70 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-200">
        {area.label}
      </div>
    </div>
  );
}
