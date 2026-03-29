"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type LayerComposition,
  type AspectRatioKey,
  ASPECT_RATIOS,
} from "@/lib/types/layer-composition";
import {
  renderComposition,
  exportCompositionToBlob,
  loadImage,
  recomposeForAspectRatio,
} from "@/lib/canvas/render-composition";

interface Props {
  composition: LayerComposition;
  onChange: (composition: LayerComposition) => void;
  onExport?: (blob: Blob) => void;
}

/**
 * LayerComposer — APENAS o canvas de preview.
 * Todos os controles ficam na sidebar externa (page.tsx coluna 3).
 */
export function LayerComposer({ composition, onChange, onExport }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const renderTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (composition.background.photoUrl) {
      loadImage(composition.background.photoUrl).then(setPhotoImg).catch(() => setPhotoImg(null));
    }
  }, [composition.background.photoUrl]);

  useEffect(() => {
    if (composition.logoLayer?.logoUrl) {
      loadImage(composition.logoLayer.logoUrl).then(setLogoImg).catch(() => setLogoImg(null));
    }
  }, [composition.logoLayer?.logoUrl]);

  const doRender = useCallback(async () => {
    if (!canvasRef.current || !photoImg) return;
    try {
      await renderComposition(canvasRef.current, composition, { photo: photoImg, logo: logoImg });
    } catch (e) { console.error("[LayerComposer] Render:", e); }
  }, [composition, photoImg, logoImg]);

  useEffect(() => {
    if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    renderTimerRef.current = setTimeout(doRender, 120);
    return () => { if (renderTimerRef.current) clearTimeout(renderTimerRef.current); };
  }, [doRender]);

  // Expor função para aspect ratio change (usado pela sidebar)
  const handleAspectRatioChange = useCallback((ar: AspectRatioKey) => {
    if (!photoImg) return;
    onChange(recomposeForAspectRatio(composition, ar, photoImg.naturalWidth, photoImg.naturalHeight));
  }, [composition, onChange, photoImg]);

  // Expor via ref ou callback — por enquanto via window event
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__layerComposerAspectChange = handleAspectRatioChange;
    return () => { delete (window as unknown as Record<string, unknown>).__layerComposerAspectChange; };
  }, [handleAspectRatioChange]);

  const dims = ASPECT_RATIOS[composition.aspectRatio];
  const isVertical = composition.aspectRatio === "story" || composition.aspectRatio === "reels";

  return (
    <div className="flex items-center justify-center h-full">
      {photoImg ? (
        <canvas
          ref={canvasRef}
          className="rounded-lg shadow-2xl"
          style={{
            maxHeight: isVertical ? "70vh" : "55vh",
            maxWidth: "100%",
            width: "auto",
            display: "block",
          }}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/30 text-sm text-slate-500"
          style={{ aspectRatio: `${dims.width}/${dims.height}`, width: isVertical ? 250 : 350, maxHeight: "65vh" }}
        >
          Gere uma arte com a Nina primeiro.
        </div>
      )}
    </div>
  );
}

// Re-export utilities for external use
export { loadImage, exportCompositionToBlob, recomposeForAspectRatio } from "@/lib/canvas/render-composition";
