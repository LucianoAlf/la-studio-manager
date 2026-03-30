"use client";

import { useState } from "react";
import type { BrandIdentity } from "@/types/brand";
import { GOOGLE_FONTS } from "@/types/brand";
import type { LayerComposition, TextLayer } from "@/lib/types/layer-composition";
import { getBrandFontFamily, getBrandTextColor } from "@/lib/types/layer-composition";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";
import { EditorPanel } from "./EditorPanel";

const EXTRA_FONTS = ["Bebas Neue", "Anton", "DM Sans", "Space Grotesk", "Outfit", "Caveat", "Pacifico"];
const ALL_FONTS = [...GOOGLE_FONTS, ...EXTRA_FONTS];
const WEIGHT_OPTIONS = [
  { value: 400, label: "400 • Regular" },
  { value: 500, label: "500 • Medium" },
  { value: 600, label: "600 • Semibold" },
  { value: 700, label: "700 • Bold" },
  { value: 800, label: "800 • Extra Bold" },
  { value: 900, label: "900 • Black" },
];
const POSITION_PRESETS = [
  { label: "Topo", x: 0.5, y: 0.12 },
  { label: "Centro", x: 0.5, y: 0.5 },
  { label: "Abaixo", x: 0.5, y: 0.78 },
  { label: "Rodapé", x: 0.5, y: 0.88 },
];

interface Props {
  composition: LayerComposition;
  onChange: (composition: LayerComposition) => void;
  brandIdentity?: BrandIdentity | null;
}

export function TextPanel({ composition, onChange, brandIdentity }: Props) {
  const [advancedOpenById, setAdvancedOpenById] = useState<Record<string, boolean>>({});
  const brandFonts = [brandIdentity?.font_display, brandIdentity?.font_body, brandIdentity?.font_accent].filter(Boolean) as string[];
  const brandColors = [
    "#FFFFFF",
    "#000000",
    brandIdentity?.color_primary,
    brandIdentity?.color_secondary,
    brandIdentity?.color_accent,
    brandIdentity?.color_gradient_start,
    brandIdentity?.color_gradient_end,
  ].filter((color, index, list): color is string => Boolean(color) && list.indexOf(color) === index);

  const fontList = brandFonts.length ? [...new Set([...brandFonts, ...ALL_FONTS])] : ALL_FONTS;

  const updateLayer = (layerId: string, updates: Partial<TextLayer>) => {
    onChange({
      ...composition,
      textLayers: composition.textLayers.map((layer) => layer.id === layerId ? { ...layer, ...updates } : layer),
    });
  };

  const removeLayer = (layerId: string) => {
    onChange({
      ...composition,
      textLayers: composition.textLayers.filter((layer) => layer.id !== layerId),
    });
  };

  const addLayer = () => {
    onChange({
      ...composition,
      textLayers: [
        ...composition.textLayers,
        {
          id: `text-${Date.now()}`,
          content: "Novo texto",
          fontFamily: getBrandFontFamily(brandIdentity),
          fontSize: 0.04,
          fontWeight: 600,
          fontStyle: "normal",
          color: getBrandTextColor(brandIdentity),
          opacity: 1,
          position: { x: 0.5, y: 0.5 },
          anchor: "center",
          maxWidthRatio: 0.85,
          lineHeight: 1.1,
          shadow: { color: "rgba(0,0,0,0.5)", blur: 6, offsetX: 0, offsetY: 2 },
          letterSpacing: 0,
          textTransform: "none",
        },
      ],
    });
  };

  const toggleAdvanced = (layerId: string) => {
    setAdvancedOpenById((current) => ({ ...current, [layerId]: !current[layerId] }));
  };

  return (
    <EditorPanel
      title={`Textos (${composition.textLayers.length})`}
      defaultOpen
      action={(
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            addLayer();
          }}
          className="text-[10px] text-cyan-400 transition-colors hover:text-cyan-300"
        >
          + Adicionar
        </button>
      )}
    >
      <div className="space-y-4">
        {composition.textLayers.map((layer, index) => (
          <div key={layer.id} className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/35 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-300">Texto {index + 1}</p>
              {composition.textLayers.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeLayer(layer.id)}
                  className="text-[10px] uppercase tracking-wider text-red-400 transition-colors hover:text-red-300"
                >
                  Remover
                </button>
              ) : null}
            </div>

            <Field label="Texto">
              <textarea
                value={layer.content}
                onChange={(event) => updateLayer(layer.id, { content: event.target.value })}
                className="min-h-[74px] w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200"
              />
            </Field>

            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Field label="Fonte">
                <Select value={layer.fontFamily} onValueChange={(value) => updateLayer(layer.id, { fontFamily: value })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {fontList.map((font) => (
                      <SelectItem key={font} value={font}>{font}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Peso">
                <Select value={String(layer.fontWeight)} onValueChange={(value) => updateLayer(layer.id, { fontWeight: Number(value) })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEIGHT_OPTIONS.map((weight) => (
                      <SelectItem key={weight.value} value={String(weight.value)}>{weight.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label=" ">
                <button
                  type="button"
                  onClick={() => updateLayer(layer.id, { fontStyle: layer.fontStyle === "italic" ? "normal" : "italic" })}
                  className={`h-9 rounded-lg border px-3 text-xs font-medium ${
                    layer.fontStyle === "italic"
                      ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                      : "border-slate-700 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  Itálico
                </button>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <SliderField
                label={`Tamanho (${Math.round(layer.fontSize * 100)}%)`}
                min={0.02}
                max={0.16}
                step={0.005}
                value={layer.fontSize}
                onChange={(value) => updateLayer(layer.id, { fontSize: value })}
              />
              <SliderField
                label={`Espaçamento (${layer.letterSpacing ?? 0}px)`}
                min={-2}
                max={10}
                step={0.5}
                value={layer.letterSpacing ?? 0}
                onChange={(value) => updateLayer(layer.id, { letterSpacing: value })}
              />
            </div>

            <Field label="Cor">
              <div className="flex flex-wrap items-center gap-1">
                {brandColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => updateLayer(layer.id, { color })}
                    className={`h-7 w-7 rounded-md border-2 ${layer.color === color ? "border-cyan-400 ring-1 ring-cyan-400" : "border-slate-700"}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-slate-600 hover:border-slate-400">
                  <span className="text-[10px] text-slate-500">+</span>
                  <input
                    type="color"
                    value={layer.color}
                    onChange={(event) => updateLayer(layer.id, { color: event.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
                {layer.stroke ? (
                  <label className="ml-2 flex items-center gap-2 rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-400">
                    Stroke
                    <input
                      type="color"
                      value={layer.stroke.color}
                      onChange={(event) => updateLayer(layer.id, {
                        stroke: { ...layer.stroke!, color: event.target.value },
                      })}
                      className="h-5 w-5 rounded bg-transparent"
                    />
                  </label>
                ) : null}
              </div>
            </Field>

            <Field label="Posição">
              <div className="grid grid-cols-4 gap-1">
                {POSITION_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => updateLayer(layer.id, { position: { x: preset.x, y: preset.y } })}
                    className={`rounded-md border px-2 py-1.5 text-xs ${
                      Math.abs(layer.position.y - preset.y) < 0.04
                        ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                        : "border-slate-700 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => toggleAdvanced(layer.id)}
                className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
              >
                {advancedOpenById[layer.id] ? "Ocultar ajustes avançados" : "Mostrar ajustes avançados"}
              </button>
            </div>

            {advancedOpenById[layer.id] ? (
              <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                <Field label="Alinhamento">
                  <div className="grid grid-cols-3 gap-1">
                    {([
                      ["left", "Esquerda"],
                      ["center", "Centro"],
                      ["right", "Direita"],
                    ] as const).map(([anchor, label]) => (
                      <button
                        key={anchor}
                        type="button"
                        onClick={() => updateLayer(layer.id, { anchor })}
                        className={`rounded-md border px-2 py-1.5 text-xs ${
                          layer.anchor === anchor
                            ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                            : "border-slate-700 text-slate-400 hover:bg-slate-800"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="grid grid-cols-2 gap-2">
                  <SliderField
                    label={`Largura (${Math.round(layer.maxWidthRatio * 100)}%)`}
                    min={0.4}
                    max={0.95}
                    step={0.01}
                    value={layer.maxWidthRatio}
                    onChange={(value) => updateLayer(layer.id, { maxWidthRatio: value })}
                  />
                  <SliderField
                    label={`Entrelinhas (${(layer.lineHeight ?? 1.1).toFixed(2)})`}
                    min={0.8}
                    max={2}
                    step={0.05}
                    value={layer.lineHeight ?? 1.1}
                    onChange={(value) => updateLayer(layer.id, { lineHeight: value })}
                  />
                  <SliderField
                    label={`Opacidade (${Math.round((layer.opacity ?? 1) * 100)}%)`}
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={layer.opacity ?? 1}
                    onChange={(value) => updateLayer(layer.id, { opacity: value })}
                  />
                  <SliderField
                    label={`Nudge X (${Math.round(layer.position.x * 100)}%)`}
                    min={0.05}
                    max={0.95}
                    step={0.01}
                    value={layer.position.x}
                    onChange={(value) => updateLayer(layer.id, { position: { ...layer.position, x: value } })}
                  />
                  <SliderField
                    label={`Nudge Y (${Math.round(layer.position.y * 100)}%)`}
                    min={0.05}
                    max={0.95}
                    step={0.01}
                    value={layer.position.y}
                    onChange={(value) => updateLayer(layer.id, { position: { ...layer.position, y: value } })}
                  />
                  <SliderField
                    label={`Stroke (${layer.stroke?.width ?? 0}px)`}
                    min={0}
                    max={8}
                    step={0.5}
                    value={layer.stroke?.width ?? 0}
                    onChange={(value) => updateLayer(layer.id, {
                      stroke: value <= 0
                        ? undefined
                        : {
                            color: layer.stroke?.color || "#000000",
                            opacity: layer.stroke?.opacity ?? 0.9,
                            width: value,
                          },
                    })}
                  />
                </div>

                <Field label="Estilo">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => updateLayer(layer.id, { textTransform: layer.textTransform === "uppercase" ? "none" : "uppercase" })}
                      className={`rounded-md border px-2 py-1.5 text-xs ${
                        layer.textTransform === "uppercase"
                          ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                          : "border-slate-700 text-slate-400 hover:bg-slate-800"
                      }`}
                    >
                      CAIXA ALTA
                    </button>
                    {([
                      ["Sem sombra", undefined],
                      ["Sombra suave", { color: "rgba(0,0,0,0.45)", blur: 5, offsetX: 0, offsetY: 2 }],
                      ["Sombra forte", { color: "rgba(0,0,0,0.8)", blur: 12, offsetX: 0, offsetY: 4 }],
                    ] as const).map(([label, shadow]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => updateLayer(layer.id, { shadow })}
                        className={`rounded-md border px-2 py-1.5 text-xs ${
                          JSON.stringify(layer.shadow || null) === JSON.stringify(shadow || null)
                            ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                            : "border-slate-700 text-slate-400 hover:bg-slate-800"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </EditorPanel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-400">{label}</label>
      {children}
    </div>
  );
}

function SliderField({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-cyan-500"
      />
    </Field>
  );
}
