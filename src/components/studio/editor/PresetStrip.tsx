"use client";

import type { BrandIdentity } from "@/types/brand";
import type { LayerComposition } from "@/lib/types/layer-composition";
import { TEMPLATE_PRESETS, applyPresetToComposition } from "@/lib/canvas/template-presets";

interface Props {
  composition: LayerComposition;
  onChange: (composition: LayerComposition) => void;
  brandIdentity?: BrandIdentity | null;
}

export function PresetStrip({ composition, onChange, brandIdentity }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {TEMPLATE_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => onChange(applyPresetToComposition(preset.id, composition, brandIdentity))}
          className="flex-shrink-0 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-center transition-colors hover:border-cyan-500/50 hover:bg-slate-800"
        >
          <span className="block text-base">{preset.icon}</span>
          <span className="mt-0.5 block whitespace-nowrap text-[10px] text-slate-400">{preset.name}</span>
        </button>
      ))}
    </div>
  );
}
