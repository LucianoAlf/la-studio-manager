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
import { AspectRatioSwitcher } from "./AspectRatioSwitcher";
import { TextLayerEditor } from "./TextLayerEditor";
import { LogoPositioner } from "./LogoPositioner";
import { TemplatePresetPicker } from "./criar/TemplatePresetPicker";
import { Card } from "@/components/ui";

interface Props {
  composition: LayerComposition;
  onChange: (composition: LayerComposition) => void;
  onExport?: (blob: Blob) => void;
  brandColors?: string[];
  brandFonts?: string[];
}

export function LayerComposer({ composition, onChange, onExport, brandColors, brandFonts }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [rendering, setRendering] = useState(false);
  const renderTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Carregar imagens quando URLs mudam
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

  // Renderizar canvas (debounced)
  const doRender = useCallback(async () => {
    if (!canvasRef.current || !photoImg) return;
    setRendering(true);
    try {
      await renderComposition(canvasRef.current, composition, {
        photo: photoImg,
        logo: logoImg,
      });
    } catch (e) {
      console.error("[LayerComposer] Render error:", e);
    }
    setRendering(false);
  }, [composition, photoImg, logoImg]);

  useEffect(() => {
    if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    renderTimerRef.current = setTimeout(doRender, 150);
    return () => { if (renderTimerRef.current) clearTimeout(renderTimerRef.current); };
  }, [doRender]);

  // Trocar proporção
  const handleAspectRatioChange = useCallback((ar: AspectRatioKey) => {
    if (!photoImg) return;
    const recomposed = recomposeForAspectRatio(
      composition, ar, photoImg.naturalWidth, photoImg.naturalHeight,
    );
    onChange(recomposed);
  }, [composition, onChange, photoImg]);

  // Exportar
  const handleExport = useCallback(async () => {
    if (!photoImg) return;
    const blob = await exportCompositionToBlob(composition, { photo: photoImg, logo: logoImg });
    onExport?.(blob);
  }, [composition, photoImg, logoImg, onExport]);

  const dims = ASPECT_RATIOS[composition.aspectRatio];
  const previewMaxH = composition.aspectRatio === "story" || composition.aspectRatio === "reels" ? 450 : 350;

  return (
    <div className="space-y-4">
      {/* Aspect Ratio Switcher */}
      <AspectRatioSwitcher value={composition.aspectRatio} onChange={handleAspectRatioChange} />

      {/* Template Presets */}
      <TemplatePresetPicker composition={composition} onChange={onChange} />

      {/* Canvas Preview */}
      <div className="flex justify-center">
        <div className="relative rounded-lg overflow-hidden bg-slate-950 border border-slate-800" style={{ maxHeight: previewMaxH }}>
          <canvas
            ref={canvasRef}
            style={{
              maxHeight: previewMaxH,
              width: "auto",
              display: "block",
            }}
          />
          {/* Spinner removido — render é rápido o suficiente */}
          {!photoImg && (
            <div className="flex items-center justify-center p-8 text-sm text-slate-500" style={{ aspectRatio: `${dims.width}/${dims.height}`, width: 250 }}>
              Gere uma imagem para começar
            </div>
          )}
        </div>
      </div>

      {/* Text Editor — Multi-layer */}
      <Card variant="default" className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Texto ({composition.textLayers.length})</h4>
          <button
            type="button"
            onClick={() => {
              const newLayer = {
                id: `text-${Date.now()}`,
                content: "Novo texto",
                fontFamily: brandFonts?.[0] || "Inter",
                fontSize: 0.04,
                fontWeight: 600,
                fontStyle: "normal" as const,
                color: "#FFFFFF",
                position: { x: 0.5, y: 0.5 },
                anchor: "center" as const,
                maxWidthRatio: 0.85,
                shadow: { color: "rgba(0,0,0,0.5)", blur: 4, offsetX: 0, offsetY: 1 },
              };
              onChange({ ...composition, textLayers: [...composition.textLayers, newLayer] });
            }}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            + Adicionar texto
          </button>
        </div>
        {composition.textLayers.map((layer, i) => (
          <div key={layer.id} className="relative">
            {i > 0 && <div className="mb-2 border-t border-slate-800" />}
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <TextLayerEditor
                  layer={layer}
                  brandColors={brandColors}
                  brandFonts={brandFonts}
                  onChange={(updated) => {
                    const newLayers = [...composition.textLayers];
                    newLayers[i] = updated;
                    onChange({ ...composition, textLayers: newLayers });
                  }}
                />
              </div>
              {composition.textLayers.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange({ ...composition, textLayers: composition.textLayers.filter((_, idx) => idx !== i) })}
                  className="mt-6 p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-900/20"
                  title="Remover texto"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>
                </button>
              )}
            </div>
          </div>
        ))}
        {composition.textLayers.length === 0 && (
          <p className="text-xs text-slate-500">Nenhum texto adicionado.</p>
        )}
      </Card>

      {/* Logo Positioner */}
      {composition.logoLayer && (
        <Card variant="default" className="p-3 space-y-2">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Logo</h4>
          <LogoPositioner
            layer={composition.logoLayer}
            onChange={(updated) => onChange({ ...composition, logoLayer: updated })}
          />
        </Card>
      )}

      {/* Gradient toggle */}
      <Card variant="default" className="p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Gradiente de fundo</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={composition.gradient.opacity}
              onChange={(e) => onChange({
                ...composition,
                gradient: { ...composition.gradient, opacity: parseFloat(e.target.value), enabled: parseFloat(e.target.value) > 0 },
              })}
              className="w-20 accent-cyan-500"
            />
            <span className="text-xs text-slate-500 w-8">{Math.round(composition.gradient.opacity * 100)}%</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
