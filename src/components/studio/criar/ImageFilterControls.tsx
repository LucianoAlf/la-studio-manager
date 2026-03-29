"use client";

interface Filters {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
}

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

const SLIDERS: { key: keyof Filters; label: string; min: number; max: number }[] = [
  { key: "brightness", label: "Brilho", min: -50, max: 50 },
  { key: "contrast", label: "Contraste", min: -50, max: 50 },
  { key: "saturation", label: "Saturação", min: -50, max: 50 },
  { key: "warmth", label: "Warmth", min: -30, max: 30 },
];

export function ImageFilterControls({ filters, onChange }: Props) {
  const update = (key: keyof Filters, value: number) => onChange({ ...filters, [key]: value });
  const isDefault = SLIDERS.every((s) => filters[s.key] === 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-slate-400">Ajustes de imagem</label>
        {!isDefault && (
          <button
            type="button"
            onClick={() => onChange({ brightness: 0, contrast: 0, saturation: 0, warmth: 0 })}
            className="text-[10px] text-slate-500 hover:text-slate-300"
          >
            Resetar
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {SLIDERS.map((s) => (
          <div key={s.key}>
            <div className="flex justify-between">
              <span className="text-[10px] text-slate-500">{s.label}</span>
              <span className="text-[10px] text-slate-500">{filters[s.key] > 0 ? "+" : ""}{filters[s.key]}</span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step="1"
              value={filters[s.key]}
              onChange={(e) => update(s.key, parseInt(e.target.value))}
              className="w-full accent-cyan-500 h-1"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
