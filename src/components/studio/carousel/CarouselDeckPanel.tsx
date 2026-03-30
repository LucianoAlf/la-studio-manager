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
  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-slate-800 bg-slate-950/65 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Deck</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-100">
              {project.title || "Carrossel"}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              {project.slideCount} slides · {project.kind === "educational" ? "Educacional" : "Foto-driven"}
            </p>
          </div>
          <button
            type="button"
            onClick={onApplyBrandingToAll}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-cyan-300 transition-colors hover:bg-slate-800"
          >
            Resetar branding
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onAddSlide}
            disabled={project.slides.length >= 8}
            className="rounded-xl border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-cyan-500 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-45"
          >
            + Novo slide
          </button>
          <button
            type="button"
            onClick={onRegenerateDeck}
            className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800"
          >
            Regenerar deck
          </button>
          <button
            type="button"
            onClick={onExportDeck}
            className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800"
          >
            Exportar tudo
          </button>
        </div>

        <div className="mt-4 overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
          {project.slides.map((slide, index) => (
            <div key={slide.id} className="w-[230px] shrink-0 space-y-2">
              <CarouselThumb
                slide={slide}
                active={activeSlideIndex === index}
                onClick={() => onSelectSlide(index)}
                isCover={project.coverSlideIndex === index}
                isGenerating={generatingSlideIndex === index}
                renderWidth={210}
                className="w-full"
              />
              <div className="grid grid-cols-3 gap-1">
                <ActionButton label="Capa" disabled={project.coverSlideIndex === index} onClick={() => onSetCoverSlide(index)} />
                <ActionButton label="Regen" onClick={() => onRegenerateSlide(index)} />
                <ActionButton label="Dup" onClick={() => onDuplicateSlide(index)} />
              </div>
              <div className="grid grid-cols-3 gap-1">
                <ActionButton label="↑" disabled={index === 0} onClick={() => onMoveSlide(index, -1)} />
                <ActionButton label="↓" disabled={index === project.slides.length - 1} onClick={() => onMoveSlide(index, 1)} />
                <ActionButton label="Del" disabled={project.slides.length <= 4} onClick={() => onRemoveSlide(index)} danger />
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-slate-800 bg-slate-950/55 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Estrutura</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {project.slides.map((slide) => (
            <div key={`${slide.id}-outline`} className="rounded-xl border border-slate-800 bg-slate-900/55 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {slide.role}
                </span>
                <span className="text-[10px] text-slate-500">{slide.layoutType}</span>
              </div>
              <p className="mt-1 text-xs text-slate-200">{slide.summary || slide.headline}</p>
              {project.coverSlideIndex === slide.index && (
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Capa do deck</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-2 py-1.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        danger
          ? "border-red-900/60 text-red-300 hover:bg-red-500/10"
          : "border-slate-700 text-slate-300 hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );
}
