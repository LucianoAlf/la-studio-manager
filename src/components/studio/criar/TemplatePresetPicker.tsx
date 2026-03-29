"use client";

import { TEMPLATE_PRESETS, applyPresetToComposition } from "@/lib/canvas/template-presets";
import type { LayerComposition } from "@/lib/types/layer-composition";

interface Props {
  composition: LayerComposition;
  onChange: (composition: LayerComposition) => void;
}

export function TemplatePresetPicker({ composition, onChange }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {TEMPLATE_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => {
            const applied = applyPresetToComposition(preset.id, composition);
            onChange(applied);
          }}
          className="flex-shrink-0 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-center hover:border-cyan-500/50 hover:bg-slate-800 transition-colors"
        >
          <span className="block text-base">{preset.icon}</span>
          <span className="block text-[10px] text-slate-400 mt-0.5 whitespace-nowrap">{preset.name}</span>
        </button>
      ))}
    </div>
  );
}
