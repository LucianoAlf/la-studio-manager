"use client";

import { type TextLayer } from "@/lib/types/layer-composition";
import { GOOGLE_FONTS } from "@/types/brand";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";

// Fontes extras além do brand.ts
const EXTRA_FONTS = ["Bebas Neue", "Anton", "DM Sans", "Space Grotesk", "Outfit", "Caveat", "Pacifico"];
const ALL_FONTS = [...GOOGLE_FONTS, ...EXTRA_FONTS];

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
  brandColors?: string[]; // cores da marca (hex)
  brandFonts?: string[]; // fontes da marca (mostrar no topo)
}

export function TextLayerEditor({ layer, onChange, brandColors, brandFonts }: Props) {
  const update = (partial: Partial<TextLayer>) => onChange({ ...layer, ...partial });

  // Fontes: marca no topo, depois genéricas
  const fontList = brandFonts?.length
    ? [...new Set([...brandFonts.filter(Boolean), ...ALL_FONTS])]
    : ALL_FONTS;

  // Cores: marca + fixas + custom
  const defaultColors = ["#FFFFFF", "#000000"];
  const colorPalette = brandColors?.length
    ? [...defaultColors, ...brandColors.filter(c => c && !defaultColors.includes(c))]
    : [...defaultColors, "#14B8A6", "#F97316", "#EF4444", "#A855F7"];

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

      {/* Fonte + Peso + Itálico */}
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Fonte</label>
          <Select value={layer.fontFamily} onValueChange={(v) => update({ fontFamily: v })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {brandFonts?.length ? (
                <>
                  {brandFonts.filter(Boolean).map((f) => (
                    <SelectItem key={`brand-${f}`} value={f}>⭐ {f}</SelectItem>
                  ))}
                  <div className="mx-2 my-1 border-t border-slate-700" />
                </>
              ) : null}
              {ALL_FONTS.map((f) => (
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
        <div>
          <label className="text-xs text-slate-400 mb-1 block">&nbsp;</label>
          <button
            type="button"
            onClick={() => update({ fontStyle: layer.fontStyle === "italic" ? "normal" : "italic" })}
            className={`h-9 w-9 rounded-lg border text-sm font-serif italic ${
              layer.fontStyle === "italic"
                ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                : "border-slate-700 text-slate-400 hover:bg-slate-800"
            }`}
          >
            I
          </button>
        </div>
      </div>

      {/* Tamanho + Letter Spacing */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Tamanho ({Math.round(layer.fontSize * 100)}%)</label>
          <input
            type="range"
            min="0.02"
            max="0.15"
            step="0.005"
            value={layer.fontSize}
            onChange={(e) => update({ fontSize: parseFloat(e.target.value) })}
            className="w-full accent-cyan-500"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Espaçamento ({layer.letterSpacing ?? 0}px)</label>
          <input
            type="range"
            min="-2"
            max="10"
            step="0.5"
            value={layer.letterSpacing ?? 0}
            onChange={(e) => update({ letterSpacing: parseFloat(e.target.value) })}
            className="w-full accent-cyan-500"
          />
        </div>
      </div>

      {/* Cor */}
      <div>
        <label className="text-xs text-slate-400 mb-1 block">Cor</label>
        <div className="flex items-center gap-1 flex-wrap">
          {colorPalette.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => update({ color: c })}
              className={`h-7 w-7 rounded-md border-2 flex-shrink-0 ${layer.color === c ? "border-cyan-400 ring-1 ring-cyan-400" : "border-slate-700"}`}
              style={{ backgroundColor: c }}
            />
          ))}
          {/* Custom color input */}
          <label className="relative h-7 w-7 rounded-md border-2 border-dashed border-slate-600 cursor-pointer flex items-center justify-center hover:border-slate-400">
            <span className="text-[10px] text-slate-500">+</span>
            <input
              type="color"
              value={layer.color}
              onChange={(e) => update({ color: e.target.value })}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
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
