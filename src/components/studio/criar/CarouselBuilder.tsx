"use client";

import { useState } from "react";
import type { LayerComposition, CarouselComposition } from "@/lib/types/layer-composition";
import { createDefaultComposition } from "@/lib/types/layer-composition";
import { SlideStrip } from "./SlideStrip";
import { Button } from "@/components/ui";

interface Props {
  carousel: CarouselComposition;
  onChange: (carousel: CarouselComposition) => void;
  renderSlideEditor: (slide: LayerComposition, index: number, onChange: (slide: LayerComposition) => void) => React.ReactNode;
}

export function CarouselBuilder({ carousel, onChange, renderSlideEditor }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = carousel.slides[activeIndex];

  const updateSlide = (index: number, updated: LayerComposition) => {
    const newSlides = [...carousel.slides];
    newSlides[index] = updated;
    onChange({ ...carousel, slides: newSlides });
  };

  const addSlide = () => {
    if (carousel.slides.length >= 10) return;
    // Duplica o último slide como base
    const lastSlide = carousel.slides[carousel.slides.length - 1];
    const newSlide: LayerComposition = {
      ...lastSlide,
      textLayers: lastSlide.textLayers.map((l) => ({
        ...l,
        id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        content: "Novo slide",
      })),
    };
    onChange({ ...carousel, slides: [...carousel.slides, newSlide] });
    setActiveIndex(carousel.slides.length);
  };

  const removeSlide = (index: number) => {
    if (carousel.slides.length <= 1) return;
    const newSlides = carousel.slides.filter((_, i) => i !== index);
    onChange({ ...carousel, slides: newSlides });
    if (activeIndex >= newSlides.length) setActiveIndex(newSlides.length - 1);
  };

  const duplicateSlide = (index: number) => {
    if (carousel.slides.length >= 10) return;
    const src = carousel.slides[index];
    const dup: LayerComposition = {
      ...src,
      textLayers: src.textLayers.map((l) => ({
        ...l,
        id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      })),
    };
    const newSlides = [...carousel.slides];
    newSlides.splice(index + 1, 0, dup);
    onChange({ ...carousel, slides: newSlides });
    setActiveIndex(index + 1);
  };

  const applyBrandingToAll = () => {
    const newSlides = carousel.slides.map((slide) => ({
      ...slide,
      logoLayer: carousel.sharedBranding.logoLayer,
      gradient: carousel.sharedBranding.gradient,
      textLayers: slide.textLayers.map((t) => ({
        ...t,
        fontFamily: carousel.sharedBranding.fontFamily,
        color: carousel.sharedBranding.accentColor || t.color,
      })),
    }));
    onChange({ ...carousel, slides: newSlides });
  };

  return (
    <div className="space-y-4">
      {/* Slide strip */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Slides ({carousel.slides.length}/10)
          </h4>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-cyan-400"
            onClick={applyBrandingToAll}
          >
            Aplicar branding a todos
          </Button>
        </div>
        <SlideStrip
          slides={carousel.slides}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          onAdd={addSlide}
          onRemove={removeSlide}
          onDuplicate={duplicateSlide}
        />
      </div>

      {/* Active slide editor */}
      {activeSlide && (
        <div>
          <p className="text-xs text-slate-400 mb-2">Editando slide {activeIndex + 1} de {carousel.slides.length}</p>
          {renderSlideEditor(activeSlide, activeIndex, (updated) => updateSlide(activeIndex, updated))}
        </div>
      )}
    </div>
  );
}

/**
 * Helper para criar um CarouselComposition inicial
 */
export function createDefaultCarousel(
  photoUrl: string,
  slideTexts: string[],
  logoUrl: string | null,
): CarouselComposition {
  const slides = slideTexts.map((text, i) => {
    const comp = createDefaultComposition(photoUrl, text, logoUrl, "carousel");
    // Variar posição dos textos pra ficar dinâmico
    if (comp.textLayers[0]) {
      comp.textLayers[0].id = `text-carousel-${i}`;
      comp.textLayers[0].position.y = i === 0 ? 0.45 : 0.78;
      comp.textLayers[0].fontSize = i === 0 ? 0.06 : 0.05;
    }
    return comp;
  });

  return {
    version: 1,
    slides,
    sharedBranding: {
      logoLayer: slides[0]?.logoLayer ?? null,
      gradient: slides[0]?.gradient ?? { enabled: true, direction: "bottom", startRatio: 0.5, opacity: 0.6, color: "0,0,0" },
      fontFamily: "Inter",
      accentColor: "#FFFFFF",
    },
  };
}
