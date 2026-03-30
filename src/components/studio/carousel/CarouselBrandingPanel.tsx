"use client";

import { GOOGLE_FONTS, LOGO_VARIANTS } from "@/types/brand";
import type { CarouselProject, CarouselTheme } from "@/lib/carousel/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/shadcn/select";

const OVERLAY_OPTIONS: Array<{ value: NonNullable<CarouselTheme["overlayPreset"]>; label: string }> = [
  { value: "auto", label: "Automático" },
  { value: "base", label: "Base" },
  { value: "top", label: "Topo" },
  { value: "split", label: "Topo + base" },
  { value: "vignette", label: "Vinheta" },
  { value: "none", label: "Sem overlay" },
];

interface Props {
  project: CarouselProject;
  onThemeChange: (themePatch: Partial<CarouselTheme>) => void;
  onResetBranding: () => void;
}

export function CarouselBrandingPanel({ project, onThemeChange, onResetBranding }: Props) {
  const theme = project.theme;
  const palette = theme.palette.filter(Boolean).slice(0, 6);

  return (
    <div className="rounded-[22px] border border-slate-800 bg-slate-950/65 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Branding</p>
          <h3 className="mt-1 text-sm font-semibold text-slate-100">Tema global do deck</h3>
          <p className="mt-1 text-xs text-slate-400">Ajuste tipografia, overlay e assinatura da marca para todas as páginas.</p>
        </div>
        <button
          type="button"
          onClick={onResetBranding}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:bg-slate-800"
        >
          Resetar marca
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="Fonte título">
          <Select value={theme.fontHeading} onValueChange={(value) => onThemeChange({ fontHeading: value })}>
            <SelectTrigger className="h-10 border-slate-700 bg-slate-900/70 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOOGLE_FONTS.map((font) => (
                <SelectItem key={font} value={font}>{font}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Fonte corpo">
          <Select value={theme.fontBody} onValueChange={(value) => onThemeChange({ fontBody: value })}>
            <SelectTrigger className="h-10 border-slate-700 bg-slate-900/70 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOOGLE_FONTS.map((font) => (
                <SelectItem key={font} value={font}>{font}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Variante da logo">
          <Select
            value={theme.logoVariant}
            onValueChange={(value) => onThemeChange({ logoVariant: value as CarouselTheme["logoVariant"] })}
          >
            <SelectTrigger className="h-10 border-slate-700 bg-slate-900/70 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOGO_VARIANTS.map((variant) => (
                <SelectItem key={variant.key} value={variant.key}>{variant.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Overlay padrão">
          <Select
            value={theme.overlayPreset || "auto"}
            onValueChange={(value) => onThemeChange({ overlayPreset: value as NonNullable<CarouselTheme["overlayPreset"]> })}
          >
            <SelectTrigger className="h-10 border-slate-700 bg-slate-900/70 text-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OVERLAY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Gradiente inicial">
          <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3">
            <input
              type="color"
              value={theme.gradientStart || "#0f172a"}
              onChange={(event) => onThemeChange({ gradientStart: event.target.value })}
              className="h-8 w-8 rounded bg-transparent"
            />
            <input
              value={theme.gradientStart || ""}
              onChange={(event) => onThemeChange({ gradientStart: event.target.value })}
              className="h-10 flex-1 bg-transparent text-sm text-slate-200 outline-none"
              placeholder="#0F172A"
            />
          </div>
        </Field>

        <Field label="Gradiente final">
          <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3">
            <input
              type="color"
              value={theme.gradientEnd || theme.gradientStart || "#020617"}
              onChange={(event) => onThemeChange({ gradientEnd: event.target.value })}
              className="h-8 w-8 rounded bg-transparent"
            />
            <input
              value={theme.gradientEnd || ""}
              onChange={(event) => onThemeChange({ gradientEnd: event.target.value })}
              className="h-10 flex-1 bg-transparent text-sm text-slate-200 outline-none"
              placeholder="#020617"
            />
          </div>
        </Field>
      </div>

      {palette.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Paleta rápida</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {palette.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onThemeChange({ gradientStart: color, gradientEnd: color })}
                className="h-8 w-8 rounded-full border border-white/10 shadow-[0_0_0_1px_rgba(15,23,42,0.45)]"
                style={{ backgroundColor: color }}
                aria-label={`Usar ${color}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-slate-400">{label}</label>
      {children}
    </div>
  );
}
