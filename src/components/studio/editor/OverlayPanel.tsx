"use client";

import type { BrandIdentity } from "@/types/brand";
import type { GradientLayer, LayerComposition, OverlayPresetId } from "@/lib/types/layer-composition";
import { createOverlayPreset, getBrandGradientColor } from "@/lib/types/layer-composition";
import { EditorPanel } from "./EditorPanel";

const OVERLAY_PRESETS: Array<{ id: OverlayPresetId; label: string }> = [
  { id: "base", label: "Base" },
  { id: "top", label: "Topo" },
  { id: "split", label: "Topo + Base" },
  { id: "vignette", label: "Vinheta" },
  { id: "none", label: "Sem gradiente" },
];

interface Props {
  composition: LayerComposition;
  onChange: (composition: LayerComposition) => void;
  brandIdentity?: BrandIdentity | null;
}

export function OverlayPanel({ composition, onChange, brandIdentity }: Props) {
  const gradient = composition.gradient;
  const colorOptions = [
    brandIdentity?.color_gradient_end,
    brandIdentity?.color_gradient_start,
    brandIdentity?.color_bg_dark,
    "#000000",
    "#111827",
    "#1E293B",
  ].filter((color, index, list): color is string => Boolean(color) && list.indexOf(color) === index);

  const setGradient = (gradient: GradientLayer) => onChange({ ...composition, gradient });

  return (
    <EditorPanel title="Overlay" defaultOpen>
      <div className="space-y-3">
        <Field label="Presets rápidos">
          <div className="grid grid-cols-2 gap-1">
            {OVERLAY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setGradient(createOverlayPreset(preset.id, gradient.color || getBrandGradientColor(brandIdentity)))}
                className="rounded-md border border-slate-700 px-2 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Tipo de overlay">
          <div className="grid grid-cols-3 gap-1">
            {([
              ["linear", "Linear"],
              ["dual", "Dual"],
              ["vignette", "Vinheta"],
            ] as const).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  if (kind === "linear") setGradient(createOverlayPreset("base", gradient.color));
                  if (kind === "dual") setGradient(createOverlayPreset("split", gradient.color));
                  if (kind === "vignette") setGradient(createOverlayPreset("vignette", gradient.color));
                }}
                className={`rounded-md border px-2 py-1.5 text-xs ${
                  gradient.kind === kind
                    ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                    : "border-slate-700 text-slate-400 hover:bg-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Cor do overlay">
          <div className="flex flex-wrap items-center gap-1">
            {colorOptions.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setGradient({ ...gradient, color: rgbFromHex(color) })}
                className="h-7 w-7 rounded-md border-2 border-slate-700"
                style={{ backgroundColor: color }}
              />
            ))}
            <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-slate-600 hover:border-slate-400">
              <span className="text-[10px] text-slate-500">+</span>
              <input
                type="color"
                value={rgbStringToHex(gradient.color)}
                onChange={(event) => setGradient({ ...gradient, color: rgbFromHex(event.target.value) })}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
        </Field>

        {"opacity" in gradient ? (
          <SliderField
            label={`Opacidade (${Math.round(gradient.opacity * 100)}%)`}
            min={0}
            max={1}
            step={0.05}
            value={gradient.opacity}
            onChange={(value) => setGradient({ ...gradient, enabled: value > 0, opacity: value })}
          />
        ) : null}

        {gradient.kind === "linear" ? (
          <>
            <Field label="Direção">
              <div className="grid grid-cols-2 gap-1">
                {([
                  ["bottom", "Base"],
                  ["top", "Topo"],
                ] as const).map(([direction, label]) => (
                  <button
                    key={direction}
                    type="button"
                    onClick={() => setGradient({ ...gradient, direction })}
                    className={`rounded-md border px-2 py-1.5 text-xs ${
                      gradient.direction === direction
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
                label={`Início (${Math.round(gradient.startRatio * 100)}%)`}
                min={0}
                max={0.95}
                step={0.01}
                value={gradient.startRatio}
                onChange={(value) => setGradient({ ...gradient, startRatio: value })}
              />
              <SliderField
                label={`Fim (${Math.round(gradient.endRatio * 100)}%)`}
                min={0.05}
                max={1}
                step={0.01}
                value={gradient.endRatio}
                onChange={(value) => setGradient({ ...gradient, endRatio: value })}
              />
            </div>
          </>
        ) : null}

        {gradient.kind === "dual" ? (
          <div className="grid grid-cols-2 gap-2">
            <SliderField
              label={`Topo (${Math.round(gradient.topStartRatio * 100)}%)`}
              min={0}
              max={0.9}
              step={0.01}
              value={gradient.topStartRatio}
              onChange={(value) => setGradient({ ...gradient, topStartRatio: value })}
            />
            <SliderField
              label={`Base (${Math.round(gradient.bottomStartRatio * 100)}%)`}
              min={0}
              max={0.95}
              step={0.01}
              value={gradient.bottomStartRatio}
              onChange={(value) => setGradient({ ...gradient, bottomStartRatio: value })}
            />
          </div>
        ) : null}

        {gradient.kind === "vignette" ? (
          <div className="grid grid-cols-2 gap-2">
            <SliderField
              label={`Raio interno (${Math.round(gradient.innerRadiusRatio * 100)}%)`}
              min={0.15}
              max={0.8}
              step={0.01}
              value={gradient.innerRadiusRatio}
              onChange={(value) => setGradient({ ...gradient, innerRadiusRatio: value })}
            />
            <SliderField
              label={`Feather (${Math.round(gradient.feather * 100)}%)`}
              min={0.1}
              max={0.8}
              step={0.01}
              value={gradient.feather}
              onChange={(value) => setGradient({ ...gradient, feather: value })}
            />
          </div>
        ) : null}
      </div>
    </EditorPanel>
  );
}

function rgbStringToHex(value: string): string {
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return "#000000";
  return `#${parts.map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

function rgbFromHex(value: string): string {
  const clean = value.replace("#", "");
  const normalized = clean.length === 3 ? clean.split("").map((char) => `${char}${char}`).join("") : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "0,0,0";
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ].join(",");
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
