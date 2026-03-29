"use client";

import { type LogoLayer, type LogoPresetPosition } from "@/lib/types/layer-composition";

const POSITIONS: { key: LogoPresetPosition; label: string }[] = [
  { key: "top-left", label: "↖" },
  { key: "top-center", label: "↑" },
  { key: "top-right", label: "↗" },
  { key: "bottom-left", label: "↙" },
  { key: "bottom-center", label: "↓" },
  { key: "bottom-right", label: "↘" },
];

interface Props {
  layer: LogoLayer;
  onChange: (layer: LogoLayer) => void;
}

export function LogoPositioner({ layer, onChange }: Props) {
  const update = (partial: Partial<LogoLayer>) => onChange({ ...layer, ...partial });
  const currentPreset = typeof layer.position === "string" ? layer.position : null;

  return (
    <div className="space-y-3">
      <label className="text-xs text-slate-400 block">Posição da logo</label>

      {/* Grid 2x3 de posições */}
      <div className="grid grid-cols-3 gap-1">
        {POSITIONS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => update({ position: p.key })}
            className={`rounded-md py-2 text-sm border ${
              currentPreset === p.key
                ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                : "border-slate-700 text-slate-400 hover:bg-slate-800"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Escala */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Tamanho ({Math.round(layer.scale * 100)}%)</label>
        <input
          type="range"
          min="0.05"
          max="0.25"
          step="0.01"
          value={layer.scale}
          onChange={(e) => update({ scale: parseFloat(e.target.value) })}
          className="w-full accent-cyan-500"
        />
      </div>

      {/* Opacidade */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Opacidade ({Math.round(layer.opacity * 100)}%)</label>
        <input
          type="range"
          min="0.3"
          max="1"
          step="0.05"
          value={layer.opacity}
          onChange={(e) => update({ opacity: parseFloat(e.target.value) })}
          className="w-full accent-cyan-500"
        />
      </div>
    </div>
  );
}
