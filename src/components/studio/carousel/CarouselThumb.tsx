"use client";

import { useEffect, useRef, useState } from "react";
import type { CarouselSlide } from "@/lib/carousel/types";
import { ASPECT_RATIOS } from "@/lib/types/layer-composition";
import { loadImage, renderComposition } from "@/lib/canvas/render-composition";

interface Props {
  slide: CarouselSlide;
  active?: boolean;
  onClick?: () => void;
  isCover?: boolean;
  renderWidth?: number;
  className?: string;
}

export function CarouselThumb({
  slide,
  active = false,
  onClick,
  isCover = false,
  renderWidth = 220,
  className = "",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!slide.composition.background.photoUrl) {
      setPhoto(null);
      return;
    }

    loadImage(slide.composition.background.photoUrl)
      .then(setPhoto)
      .catch(() => setPhoto(null));
  }, [slide.composition.background.photoUrl]);

  useEffect(() => {
    if (!slide.composition.logoLayer?.logoUrl) {
      setLogo(null);
      return;
    }

    loadImage(slide.composition.logoLayer.logoUrl)
      .then(setLogo)
      .catch(() => setLogo(null));
  }, [slide.composition.logoLayer?.logoUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dims = ASPECT_RATIOS.carousel;
    const scale = renderWidth / dims.width;
    canvas.width = renderWidth;
    canvas.height = Math.round(dims.height * scale);

    if (!photo) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const tempCanvas = document.createElement("canvas");
    void renderComposition(tempCanvas, slide.composition, { photo, logo })
      .then(() => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
      })
      .catch(() => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      });
  }, [logo, photo, renderWidth, slide.composition]);

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
        <canvas ref={canvasRef} className="block w-full" />
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
