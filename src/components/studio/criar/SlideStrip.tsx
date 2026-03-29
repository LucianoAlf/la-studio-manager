"use client";

import { useRef, useEffect } from "react";
import type { LayerComposition } from "@/lib/types/layer-composition";
import { ASPECT_RATIOS } from "@/lib/types/layer-composition";

interface Props {
  slides: LayerComposition[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
  maxSlides?: number;
}

export function SlideStrip({ slides, activeIndex, onSelect, onAdd, onRemove, onDuplicate, maxSlides = 10 }: Props) {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  // Render mini thumbnails
  useEffect(() => {
    slides.forEach((slide, i) => {
      const canvas = canvasRefs.current[i];
      if (!canvas) return;
      const dims = ASPECT_RATIOS[slide.aspectRatio];
      const scale = 60 / dims.width;
      canvas.width = 60;
      canvas.height = Math.round(dims.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // Simple placeholder — full render would be heavy
      ctx.fillStyle = "#1E293B";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#64748B";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${i + 1}`, canvas.width / 2, canvas.height / 2);
      // Show text preview
      if (slide.textLayers[0]?.content) {
        ctx.fillStyle = "#94A3B8";
        ctx.font = "8px sans-serif";
        ctx.fillText(slide.textLayers[0].content.substring(0, 10), canvas.width / 2, canvas.height / 2 + 12);
      }
    });
  }, [slides]);

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {slides.map((slide, i) => (
        <div key={i} className="flex-shrink-0 relative group">
          <button
            type="button"
            onClick={() => onSelect(i)}
            className={`rounded-lg overflow-hidden border-2 transition-all ${
              activeIndex === i ? "border-cyan-500 ring-1 ring-cyan-500" : "border-slate-700 hover:border-slate-500"
            }`}
          >
            <canvas
              ref={(el) => { canvasRefs.current[i] = el; }}
              className="block"
              style={{ width: 60 }}
            />
          </button>
          {/* Actions on hover */}
          <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDuplicate(i); }}
              className="h-4 w-4 rounded bg-slate-700 text-[8px] text-slate-300 hover:bg-cyan-600"
              title="Duplicar"
            >
              ⧉
            </button>
            {slides.length > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                className="h-4 w-4 rounded bg-slate-700 text-[8px] text-red-400 hover:bg-red-600 hover:text-white"
                title="Remover"
              >
                ✕
              </button>
            )}
          </div>
          <p className="text-[9px] text-slate-500 text-center mt-0.5">{i + 1}</p>
        </div>
      ))}
      {/* Add slide */}
      {slides.length < maxSlides && (
        <button
          type="button"
          onClick={onAdd}
          className="flex-shrink-0 h-[80px] w-[60px] rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-500 hover:border-cyan-500 hover:text-cyan-400 transition-colors"
        >
          <span className="text-lg">+</span>
        </button>
      )}
    </div>
  );
}
