"use client";

import { type TextLayer } from "@/lib/types/layer-composition";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";

const FONT_OPTIONS = [
  "Inter", "Montserrat", "Poppins", "Roboto", "Open Sans",
  "Oswald", "Playfair Display", "Raleway", "Bebas Neue", "Anton",
  "Lato", "Nunito", "DM Sans", "Space Grotesk", "Outfit",
];

const WEIGHT_OPTIONS = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
  { value: 800, label: "Extra Bold" },
  { value: 900, label: "Black" },
];

const POSITION_PRESETS = [
  { label: "Topo", x: 0.5, y: 0.12 },
  { label: "Centro", x: 0.5, y: 0.5 },
  { label: "Abaixo", x: 0.5, y: 0.78 },
  { label: "Rodapé", x: 0.5, y: 0.88 },
];

interface Props {
  layer: TextLayer;
  onChange: (layer: TextLayer) => void;
}

export function TextLayerEditor({ layer, onChange }: Props) {
  const update = (partial: Partial<TextLayer>) => onChange({ ...layer, ...partial });

  return (
    <div className="space-y-3">
      {/* Texto */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Texto</label>
        <input
          value={layer.content}
          onChange={(e) => update({ content: e.target.value })}
          className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200"
        />
      </div>

      {/* Fonte + Peso */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Fonte</label>
          <Select value={layer.fontFamily} onValueChange={(v) => update({ fontFamily: v })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Peso</label>
          <Select value={String(layer.fontWeight)} onValueChange={(v) => update({ fontWeight: Number(v) })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {WEIGHT_OPTIONS.map((w) => (
                <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tamanho + Cor */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Tamanho ({Math.round(layer.fontSize * 100)}%)</label>
          <input
            type="range"
            min="0.03"
            max="0.12"
            step="0.005"
            value={layer.fontSize}
            onChange={(e) => update({ fontSize: parseFloat(e.target.value) })}
            className="w-full accent-cyan-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Cor</label>
          <div className="flex gap-1">
            {["#FFFFFF", "#000000", "#14B8A6", "#F97316", "#EF4444", "#A855F7"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => update({ color: c })}
                className={`h-7 w-7 rounded-md border-2 ${layer.color === c ? "border-cyan-400" : "border-slate-700"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Posição */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Posição</label>
        <div className="flex gap-1">
          {POSITION_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => update({ position: { x: p.x, y: p.y } })}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs border ${
                Math.abs(layer.position.y - p.y) < 0.05
                  ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                  : "border-slate-700 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
