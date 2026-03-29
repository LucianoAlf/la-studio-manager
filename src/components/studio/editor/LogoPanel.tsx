"use client";

import type { BrandIdentity } from "@/types/brand";
import type { LayerComposition, LogoLayer, LogoPresetPosition, LogoVariant } from "@/lib/types/layer-composition";
import { getBrandLogoUrl } from "@/lib/types/layer-composition";
import { EditorPanel } from "./EditorPanel";

const POSITIONS: { key: LogoPresetPosition; label: string }[] = [
  { key: "top-left", label: "↖" },
  { key: "top-center", label: "↑" },
  { key: "top-right", label: "↗" },
  { key: "bottom-left", label: "↙" },
  { key: "bottom-center", label: "↓" },
  { key: "bottom-right", label: "↘" },
];

const VARIANTS: { key: LogoVariant; label: string }[] = [
  { key: "primary", label: "Principal" },
  { key: "light", label: "Clara" },
  { key: "dark", label: "Escura" },
  { key: "horizontal", label: "Horizontal" },
  { key: "icon", label: "Ícone" },
];

interface Props {
  composition: LayerComposition;
  onChange: (composition: LayerComposition) => void;
  brandIdentity?: BrandIdentity | null;
}

export function LogoPanel({ composition, onChange, brandIdentity }: Props) {
  const activeLayer = composition.logoLayer;
  const hasBrandLogo = VARIANTS.some((variant) => Boolean(getBrandLogoUrl(brandIdentity, variant.key)));

  const updateLogo = (updates: Partial<LogoLayer>) => {
    if (!activeLayer) return;
    onChange({
      ...composition,
      logoLayer: { ...activeLayer, ...updates },
    });
  };

  return (
    <EditorPanel
      title="Logo"
      defaultOpen
      action={activeLayer ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onChange({ ...composition, logoLayer: null });
          }}
          className="text-[10px] uppercase tracking-wider text-red-400 transition-colors hover:text-red-300"
        >
          Remover
        </button>
      ) : hasBrandLogo ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            const logoUrl = getBrandLogoUrl(brandIdentity, "primary");
            if (!logoUrl) return;
            onChange({
              ...composition,
              logoLayer: {
                logoUrl,
                position: "bottom-center",
                scale: 0.12,
                opacity: 1,
                variant: "primary",
                offset: { x: 0, y: 0 },
              },
            });
          }}
          className="text-[10px] text-cyan-400 transition-colors hover:text-cyan-300"
        >
          + Adicionar
        </button>
      ) : null}
    >
      {!activeLayer ? (
        <p className="text-xs text-slate-500">Nenhuma logo disponível para esta marca.</p>
      ) : (
        <div className="space-y-3">
          <Field label="Variante">
            <div className="grid grid-cols-2 gap-1">
              {VARIANTS.map((variant) => {
                const resolvedUrl = getBrandLogoUrl(brandIdentity, variant.key, activeLayer.logoUrl);
                return (
                  <button
                    key={variant.key}
                    type="button"
                    onClick={() => updateLogo({
                      variant: variant.key,
                      logoUrl: resolvedUrl || activeLayer.logoUrl,
                    })}
                    className={`rounded-md border px-2 py-1.5 text-xs ${
                      activeLayer.variant === variant.key
                        ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                        : "border-slate-700 text-slate-400 hover:bg-slate-800"
                    }`}
                  >
                    {variant.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Posição da logo">
            <div className="grid grid-cols-3 gap-1">
              {POSITIONS.map((position) => (
                <button
                  key={position.key}
                  type="button"
                  onClick={() => updateLogo({ position: position.key })}
                  className={`rounded-md border py-2 text-sm ${
                    activeLayer.position === position.key
                      ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                      : "border-slate-700 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  {position.label}
                </button>
              ))}
            </div>
          </Field>

          <SliderField
            label={`Tamanho (${Math.round(activeLayer.scale * 100)}%)`}
            min={0.05}
            max={0.28}
            step={0.01}
            value={activeLayer.scale}
            onChange={(value) => updateLogo({ scale: value })}
          />
          <SliderField
            label={`Opacidade (${Math.round(activeLayer.opacity * 100)}%)`}
            min={0.1}
            max={1}
            step={0.05}
            value={activeLayer.opacity}
            onChange={(value) => updateLogo({ opacity: value })}
          />
          <SliderField
            label={`Offset X (${Math.round((activeLayer.offset?.x || 0) * 100)}%)`}
            min={-0.18}
            max={0.18}
            step={0.01}
            value={activeLayer.offset?.x || 0}
            onChange={(value) => updateLogo({ offset: { x: value, y: activeLayer.offset?.y || 0 } })}
          />
          <SliderField
            label={`Offset Y (${Math.round((activeLayer.offset?.y || 0) * 100)}%)`}
            min={-0.18}
            max={0.18}
            step={0.01}
            value={activeLayer.offset?.y || 0}
            onChange={(value) => updateLogo({ offset: { x: activeLayer.offset?.x || 0, y: value } })}
          />
        </div>
      )}
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
