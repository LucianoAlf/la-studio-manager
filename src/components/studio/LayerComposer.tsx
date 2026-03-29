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
import { ImageFilterControls } from "./criar/ImageFilterControls";
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState<string | null>("texto");
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
    setRendering(true);
    try {
      await renderComposition(canvasRef.current, composition, { photo: photoImg, logo: logoImg });
    } catch (e) { console.error("[LayerComposer] Render:", e); }
    setRendering(false);
  }, [composition, photoImg, logoImg]);

  useEffect(() => {
    if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    renderTimerRef.current = setTimeout(doRender, 150);
    return () => { if (renderTimerRef.current) clearTimeout(renderTimerRef.current); };
  }, [doRender]);

  const handleAspectRatioChange = useCallback((ar: AspectRatioKey) => {
    if (!photoImg) return;
    onChange(recomposeForAspectRatio(composition, ar, photoImg.naturalWidth, photoImg.naturalHeight));
  }, [composition, onChange, photoImg]);

  const dims = ASPECT_RATIOS[composition.aspectRatio];
  const isVertical = composition.aspectRatio === "story" || composition.aspectRatio === "reels";

  // Accordion section toggle
  const toggleSection = (section: string) => setActiveSection(activeSection === section ? null : section);

  const addTextLayer = () => {
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
  };

  return (
    <div className="flex gap-3">
      {/* LEFT: Canvas (fixo) */}
      <div className="flex-1 min-w-0">
        {/* Aspect Ratio + Templates */}
        <div className="space-y-2 mb-3">
          <AspectRatioSwitcher value={composition.aspectRatio} onChange={handleAspectRatioChange} />
          <TemplatePresetPicker composition={composition} onChange={onChange} />
        </div>

        {/* Canvas */}
        <div className="flex justify-center sticky top-0">
          <div className="relative rounded-lg overflow-hidden bg-slate-950 border border-slate-800">
            <canvas
              ref={canvasRef}
              style={{
                maxHeight: isVertical ? 500 : 380,
                width: "auto",
                display: "block",
              }}
            />
            {!photoImg && (
              <div className="flex items-center justify-center p-8 text-sm text-slate-500" style={{ aspectRatio: `${dims.width}/${dims.height}`, width: 220 }}>
                Gere uma imagem para começar
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: Sidebar (colapsável) */}
      <div className={`transition-all duration-200 ${sidebarOpen ? "w-[280px]" : "w-8"} flex-shrink-0`}>
        {/* Toggle button */}
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-900/60 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        >
          {sidebarOpen ? "Fechar painel ›" : "‹"}
        </button>

        {sidebarOpen && (
          <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
            {/* TEXTO */}
            <SidebarSection title={`Texto (${composition.textLayers.length})`} isOpen={activeSection === "texto"} onToggle={() => toggleSection("texto")} action={<button type="button" onClick={addTextLayer} className="text-[10px] text-cyan-400 hover:text-cyan-300">+ Adicionar</button>}>
              {composition.textLayers.map((layer, i) => (
                <div key={layer.id}>
                  {i > 0 && <div className="my-2 border-t border-slate-800" />}
                  <div className="flex items-start gap-1">
                    <div className="flex-1">
                      <TextLayerEditor layer={layer} brandColors={brandColors} brandFonts={brandFonts} onChange={(updated) => {
                        const newLayers = [...composition.textLayers];
                        newLayers[i] = updated;
                        onChange({ ...composition, textLayers: newLayers });
                      }} />
                    </div>
                    {composition.textLayers.length > 1 && (
                      <button type="button" onClick={() => onChange({ ...composition, textLayers: composition.textLayers.filter((_, idx) => idx !== i) })} className="mt-6 p-1 rounded text-slate-500 hover:text-red-400" title="Remover">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {composition.textLayers.length === 0 && <p className="text-xs text-slate-500">Nenhum texto.</p>}
            </SidebarSection>

            {/* LOGO */}
            {composition.logoLayer && (
              <SidebarSection title="Logo" isOpen={activeSection === "logo"} onToggle={() => toggleSection("logo")}>
                <LogoPositioner layer={composition.logoLayer} onChange={(updated) => onChange({ ...composition, logoLayer: updated })} />
              </SidebarSection>
            )}

            {/* GRADIENTE */}
            <SidebarSection title="Gradiente" isOpen={activeSection === "gradiente"} onToggle={() => toggleSection("gradiente")}>
              <div className="flex items-center gap-2">
                <input type="range" min="0" max="1" step="0.1" value={composition.gradient.opacity} onChange={(e) => onChange({ ...composition, gradient: { ...composition.gradient, opacity: parseFloat(e.target.value), enabled: parseFloat(e.target.value) > 0 } })} className="flex-1 accent-cyan-500" />
                <span className="text-xs text-slate-500 w-8">{Math.round(composition.gradient.opacity * 100)}%</span>
              </div>
            </SidebarSection>

            {/* FILTROS */}
            <SidebarSection title="Ajustes" isOpen={activeSection === "filtros"} onToggle={() => toggleSection("filtros")}>
              <ImageFilterControls
                filters={composition.filters || { brightness: 0, contrast: 0, saturation: 0, warmth: 0 }}
                onChange={(filters) => onChange({ ...composition, filters })}
              />
            </SidebarSection>
          </div>
        )}
      </div>
    </div>
  );
}

// Sidebar section accordion component
function SidebarSection({ title, isOpen, onToggle, action, children }: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden">
      <button type="button" onClick={onToggle} className="flex items-center justify-between w-full px-3 py-2 hover:bg-slate-800/50">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{title}</span>
        <div className="flex items-center gap-2">
          {action && <span onClick={(e) => e.stopPropagation()}>{action}</span>}
          <span className="text-slate-500 text-xs">{isOpen ? "▾" : "▸"}</span>
        </div>
      </button>
      {isOpen && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}
