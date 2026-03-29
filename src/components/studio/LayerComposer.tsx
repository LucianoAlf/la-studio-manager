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

      {/* TEXTO — Accordion */}
      <Accordion title={`Texto (${composition.textLayers.length})`} defaultOpen action={
        <button type="button" onClick={(e) => { e.stopPropagation(); const nl = { id: `text-${Date.now()}`, content: "Novo texto", fontFamily: brandFonts?.[0] || "Inter", fontSize: 0.04, fontWeight: 600, fontStyle: "normal" as const, color: "#FFFFFF", position: { x: 0.5, y: 0.5 }, anchor: "center" as const, maxWidthRatio: 0.85, shadow: { color: "rgba(0,0,0,0.5)", blur: 4, offsetX: 0, offsetY: 1 } }; onChange({ ...composition, textLayers: [...composition.textLayers, nl] }); }} className="text-[10px] text-cyan-400 hover:text-cyan-300">+ Adicionar</button>
      }>
        {composition.textLayers.map((layer, i) => (
          <div key={layer.id}>
            {i > 0 && <div className="my-2 border-t border-slate-800" />}
            <div className="flex items-start gap-1">
              <div className="flex-1">
                <TextLayerEditor layer={layer} brandColors={brandColors} brandFonts={brandFonts} onChange={(updated) => { const nl = [...composition.textLayers]; nl[i] = updated; onChange({ ...composition, textLayers: nl }); }} />
              </div>
              {composition.textLayers.length > 1 && (
                <button type="button" onClick={() => onChange({ ...composition, textLayers: composition.textLayers.filter((_, idx) => idx !== i) })} className="mt-6 p-1 rounded text-slate-500 hover:text-red-400" title="Remover">✕</button>
              )}
            </div>
          </div>
        ))}
        {composition.textLayers.length === 0 && <p className="text-xs text-slate-500">Nenhum texto.</p>}
      </Accordion>

      {/* LOGO — Accordion */}
      {composition.logoLayer && (
        <Accordion title="Logo">
          <LogoPositioner layer={composition.logoLayer} onChange={(updated) => onChange({ ...composition, logoLayer: updated })} />
        </Accordion>
      )}

      {/* GRADIENTE — Accordion */}
      <Accordion title="Gradiente">
        <div className="flex items-center gap-2">
          <input type="range" min="0" max="1" step="0.1" value={composition.gradient.opacity} onChange={(e) => onChange({ ...composition, gradient: { ...composition.gradient, opacity: parseFloat(e.target.value), enabled: parseFloat(e.target.value) > 0 } })} className="flex-1 accent-cyan-500" />
          <span className="text-xs text-slate-500 w-8">{Math.round(composition.gradient.opacity * 100)}%</span>
        </div>
      </Accordion>

      {/* AJUSTES — Accordion */}
      <Accordion title="Ajustes de imagem">
        {(() => { const { ImageFilterControls } = require("./criar/ImageFilterControls"); return <ImageFilterControls filters={composition.filters || { brightness: 0, contrast: 0, saturation: 0, warmth: 0 }} onChange={(filters: import("@/lib/types/layer-composition").ImageFilters) => onChange({ ...composition, filters })} />; })()}
      </Accordion>
    </div>
  );
}

// Accordion component
function Accordion({ title, defaultOpen, action, children }: { title: string; defaultOpen?: boolean; action?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-slate-800/50 transition-colors">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">{title}</span>
        <div className="flex items-center gap-2">
          {action}
          <span className={`text-slate-500 text-xs transition-transform ${open ? "rotate-0" : "-rotate-90"}`}>▾</span>
        </div>
      </button>
      {open && <div className="px-3 pb-3 pt-1 border-t border-slate-800/50">{children}</div>}
    </div>
  );
}
