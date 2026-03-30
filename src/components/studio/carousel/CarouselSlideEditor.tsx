"use client";

import type { BrandIdentity } from "@/types/brand";
import type { CarouselProject, CarouselSlide } from "@/lib/carousel/types";
import { LayerComposer } from "@/components/studio/LayerComposer";

const EDUCATIONAL_LAYOUTS = [
  { id: "cover-hero", label: "Capa" },
  { id: "headline-body", label: "Headline" },
  { id: "stat-highlight", label: "Destaque" },
  { id: "checklist", label: "Checklist" },
  { id: "quote-proof", label: "Prova" },
  { id: "cta-end", label: "CTA" },
];

const PHOTO_LAYOUTS = [
  { id: "photo-hero", label: "Hero" },
  { id: "photo-caption", label: "Legenda" },
  { id: "split-photo-copy", label: "Split" },
  { id: "photo-quote", label: "Quote" },
  { id: "cta-photo-end", label: "CTA" },
];

interface Props {
  project: CarouselProject;
  slide: CarouselSlide;
  brandIdentity?: BrandIdentity | null;
  onChangeComposition: (composition: CarouselSlide["composition"]) => void;
  onChangeMeta: (updates: Partial<CarouselSlide>) => void;
  onLayoutChange: (layoutType: string) => void;
  onDuplicatePreviousStyle: () => void;
  onSetCoverSlide: () => void;
  onRegenerateSlide: () => void;
  isCoverSlide: boolean;
}

export function CarouselSlideEditor({
  project,
  slide,
  brandIdentity,
  onChangeComposition,
  onChangeMeta,
  onLayoutChange,
  onDuplicatePreviousStyle,
  onSetCoverSlide,
  onRegenerateSlide,
  isCoverSlide,
}: Props) {
  const layouts = project.kind === "educational" ? EDUCATIONAL_LAYOUTS : PHOTO_LAYOUTS;

  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-slate-800 bg-slate-950/65 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Slide atual</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-100">
              Slide {slide.index + 1} · {slide.role}
            </h3>
            {isCoverSlide && (
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Capa do deck</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSetCoverSlide}
              disabled={isCoverSlide}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Definir como capa
            </button>
            <button
              type="button"
              onClick={onRegenerateSlide}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:bg-slate-800"
            >
              Regenerar slide
            </button>
            <button
              type="button"
              onClick={onDuplicatePreviousStyle}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:bg-slate-800"
            >
              Duplicar estilo anterior
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
          <Field label="Resumo do slide">
            <input
              value={slide.summary || ""}
              onChange={(event) => onChangeMeta({ summary: event.target.value })}
              className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
              placeholder="Resumo curto que aparece no outline"
            />
          </Field>
          <Field label="Layout">
            <div className="grid grid-cols-3 gap-1">
              {layouts.map((layout) => (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => onLayoutChange(layout.id)}
                  className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
                    slide.layoutType === layout.id
                      ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                      : "border-slate-700 text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  {layout.label}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>

      <LayerComposer
        composition={slide.composition}
        onChange={onChangeComposition}
        brandIdentity={brandIdentity}
        showAspectSwitcher={false}
        showPresetStrip={false}
      />
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
