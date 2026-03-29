"use client";

import { cn } from "@/lib/utils";
import { type AspectRatioKey, ASPECT_RATIOS } from "@/lib/types/layer-composition";

interface Props {
  value: AspectRatioKey;
  onChange: (value: AspectRatioKey) => void;
}

const KEYS: AspectRatioKey[] = ["story", "feed", "reels", "carousel"];

export function AspectRatioSwitcher({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            value === key
              ? "bg-cyan-600 text-white"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          )}
        >
          {ASPECT_RATIOS[key].label}
          <span className="ml-1 text-[10px] opacity-60">{ASPECT_RATIOS[key].ratio}</span>
        </button>
      ))}
    </div>
  );
}
