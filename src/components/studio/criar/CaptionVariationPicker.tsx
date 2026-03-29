"use client";

import type { CaptionVariation } from "@/stores/create-post-store";

const TONE_COLORS: Record<string, string> = {
  inspirador: "bg-purple-500/20 text-purple-300",
  divertido: "bg-yellow-500/20 text-yellow-300",
  profissional: "bg-blue-500/20 text-blue-300",
  comemorativo: "bg-pink-500/20 text-pink-300",
  educativo: "bg-green-500/20 text-green-300",
};

interface Props {
  variations: CaptionVariation[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function CaptionVariationPicker({ variations, selectedIndex, onSelect }: Props) {
  if (variations.length === 0) return null;

  return (
    <div className="space-y-2">
      <label className="text-xs text-slate-400 block">Variações de legenda</label>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(variations.length, 3)}, 1fr)` }}>
        {variations.map((v, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={`rounded-lg border p-3 text-left transition-all ${
              selectedIndex === i
                ? "border-cyan-500 bg-cyan-500/10"
                : "border-slate-700 bg-slate-900/50 hover:border-slate-500"
            }`}
          >
            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium mb-2 ${TONE_COLORS[v.tone] || "bg-slate-700 text-slate-300"}`}>
              {v.tone}
            </span>
            <p className="text-xs text-slate-200 font-medium mb-1 line-clamp-1">{v.phrase}</p>
            <p className="text-[11px] text-slate-400 line-clamp-3">{v.caption}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
