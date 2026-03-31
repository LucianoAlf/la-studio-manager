"use client";

import type { CarouselProject } from "@/lib/carousel/types";
import { CarouselThumb } from "./CarouselThumb";

interface Props {
  project: CarouselProject;
  activeSlideIndex: number;
  generatingSlideIndex?: number | null;
  onSelectSlide: (index: number) => void;
  onAddSlide: () => void;
  onRemoveSlide: (index: number) => void;
  onDuplicateSlide: (index: number) => void;
  onMoveSlide: (index: number, direction: -1 | 1) => void;
  onApplyBrandingToAll: () => void;
  onRegenerateDeck: () => void;
  onSetCoverSlide: (index: number) => void;
  onRegenerateSlide: (index: number) => void;
  onExportDeck: () => void;
}

export function CarouselDeckPanel({
  project,
  activeSlideIndex,
  generatingSlideIndex,
  onSelectSlide,
  onAddSlide,
  onRemoveSlide,
  onDuplicateSlide,
  onMoveSlide,
  onApplyBrandingToAll,
  onRegenerateDeck,
  onSetCoverSlide,
  onRegenerateSlide,
  onExportDeck,
}: Props) {
  const isGeneratingAny = generatingSlideIndex != null;
  const generatedCount = isGeneratingAny
    ? project.slides.filter((_, i) => i < (generatingSlideIndex ?? 0)).length
    : project.slides.length;
  const progressPct = isGeneratingAny
    ? Math.round((generatedCount / project.slides.length) * 100)
    : 100;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">
            {project.title || "Carrossel"}
          </p>
          <p className="text-xs text-slate-400">
            {project.slides.length} slides &middot;{" "}
            {project.kind === "educational" ? "Educacional" : "Foto-driven"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onApplyBrandingToAll}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"
          >
            Aplicar branding
          </button>
          <button
            type="button"
            onClick={onRegenerateDeck}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"
          >
            Regenerar deck
          </button>
          <button
            type="button"
            onClick={onExportDeck}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"
          >
            Exportar tudo
          </button>
        </div>
      </div>

      {/* Progress bar (visible during generation) */}
      {isGeneratingAny && (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-cyan-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
            <span className="text-[11px] text-slate-400">
              Gerando slide {(generatingSlideIndex ?? 0) + 1} de {project.slides.length}...
            </span>
          </div>
        </>
      )}

      {/* Slide grid */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
      >
        {project.slides.map((slide, index) => (
          <div key={`${slide.id}-${slide.renderUrl || "pending"}`} className="space-y-1.5">
            <CarouselThumb
              slide={slide}
              active={activeSlideIndex === index}
              onClick={() => onSelectSlide(index)}
              isCover={project.coverSlideIndex === index}
              isGenerating={generatingSlideIndex === index}
              className="w-full"
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onSelectSlide(index)}
                className="flex-1 rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => onRegenerateSlide(index)}
                className="flex-1 rounded-lg border border-amber-800/50 px-2 py-1 text-[10px] text-amber-400 hover:bg-amber-900/20"
              >
                Regen
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => onSetCoverSlide(index)}
                className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
              >
                {project.coverSlideIndex === index ? "Capa" : "Definir capa"}
              </button>
              <button
                type="button"
                onClick={() => onDuplicateSlide(index)}
                className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
              >
                Duplicar
              </button>
              <button
                type="button"
                onClick={() => onMoveSlide(index, -1)}
                disabled={index === 0}
                className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-300 disabled:opacity-40 hover:bg-slate-800"
              >
                Subir
              </button>
              <button
                type="button"
                onClick={() => onMoveSlide(index, 1)}
                disabled={index === project.slides.length - 1}
                className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-300 disabled:opacity-40 hover:bg-slate-800"
              >
                Descer
              </button>
            </div>
            <button
              type="button"
              onClick={() => onRemoveSlide(index)}
              disabled={project.slides.length <= 4}
              className="w-full rounded-lg border border-rose-900/50 px-2 py-1 text-[10px] text-rose-400 disabled:opacity-40 hover:bg-rose-950/20"
            >
              Remover
            </button>
          </div>
        ))}

        {/* Add slide card */}
        <button
          type="button"
          onClick={onAddSlide}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-slate-500 transition-colors hover:border-cyan-500 hover:text-cyan-400"
          style={{ minHeight: 200 }}
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          <span className="text-xs">Novo slide</span>
        </button>
      </div>
    </div>
  );
}
