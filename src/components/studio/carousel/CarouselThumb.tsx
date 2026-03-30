"use client";

import type { CarouselSlide } from "@/lib/carousel/types";

interface Props {
  slide: CarouselSlide;
  active?: boolean;
  onClick?: () => void;
  isCover?: boolean;
  isGenerating?: boolean;
  className?: string;
}

export function CarouselThumb({
  slide,
  active = false,
  onClick,
  isCover = false,
  isGenerating = false,
  className = "",
}: Props) {
  let content: React.ReactNode;

  if (slide.renderUrl) {
    content = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={slide.renderUrl}
        alt={`Slide ${slide.index + 1}`}
        className="block w-full object-cover"
        style={{ aspectRatio: "4/5" }}
      />
    );
  } else if (isGenerating) {
    content = (
      <div className="flex items-center justify-center bg-slate-950" style={{ aspectRatio: "4/5" }}>
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <span className="text-[10px] text-cyan-400">Gerando...</span>
        </div>
      </div>
    );
  } else {
    content = (
      <div
        className="flex flex-col items-center justify-center bg-slate-950 text-slate-500"
        style={{ aspectRatio: "4/5" }}
      >
        <span className="text-2xl font-bold text-slate-600">{slide.index + 1}</span>
        <span className="mt-1 text-[10px] uppercase tracking-wider">{slide.role}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-2xl border p-2 text-left transition-all ${
        active
          ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
          : "border-slate-800 bg-slate-950/60 hover:border-slate-600 hover:bg-slate-900/70"
      } ${className}`}
    >
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
        {content}
      </div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Slide {slide.index + 1}
          </span>
          <span className="text-[10px] text-slate-500">{isCover ? "cover" : slide.role}</span>
        </div>
        <p className="line-clamp-2 text-xs font-medium text-slate-200">
          {slide.summary || slide.headline || `Slide ${slide.index + 1}`}
        </p>
        {isCover && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Capa do deck</p>
        )}
      </div>
    </button>
  );
}
