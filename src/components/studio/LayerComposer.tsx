"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BrandIdentity } from "@/types/brand";
import {
  type LayerComposition,
  type AspectRatioKey,
  ASPECT_RATIOS,
  deserializeComposition,
} from "@/lib/types/layer-composition";
import {
  renderComposition,
  loadImage,
  recomposeForAspectRatio,
} from "@/lib/canvas/render-composition";
import { AspectRatioSwitcher } from "./AspectRatioSwitcher";
import { PresetStrip } from "./editor/PresetStrip";
import { BackgroundPanel } from "./editor/BackgroundPanel";
import { TextPanel } from "./editor/TextPanel";
import { LogoPanel } from "./editor/LogoPanel";
import { OverlayPanel } from "./editor/OverlayPanel";
import { SafeAreaOverlay } from "./editor/SafeAreaOverlay";
import { EditorPanel } from "./editor/EditorPanel";

interface Props {
  composition: LayerComposition;
  onChange: (composition: LayerComposition) => void;
  brandIdentity?: BrandIdentity | null;
}

export function LayerComposer({ composition, onChange, brandIdentity }: Props) {
  const normalizedComposition = deserializeComposition(composition, brandIdentity);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const renderTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (normalizedComposition.background.photoUrl) {
      loadImage(normalizedComposition.background.photoUrl).then(setPhotoImg).catch(() => setPhotoImg(null));
    }
  }, [normalizedComposition.background.photoUrl]);

  useEffect(() => {
    if (normalizedComposition.logoLayer?.logoUrl) {
      loadImage(normalizedComposition.logoLayer.logoUrl).then(setLogoImg).catch(() => setLogoImg(null));
    } else {
      setLogoImg(null);
    }
  }, [normalizedComposition.logoLayer?.logoUrl]);

  const doRender = useCallback(async () => {
    if (!canvasRef.current || !photoImg) return;
    try {
      await renderComposition(canvasRef.current, normalizedComposition, {
        photo: photoImg,
        logo: logoImg,
      });
    } catch (error) {
      console.error("[LayerComposer] Render error:", error);
    }
  }, [logoImg, normalizedComposition, photoImg]);

  useEffect(() => {
    if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    renderTimerRef.current = setTimeout(() => void doRender(), 150);
    return () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    };
  }, [doRender]);

  const handleAspectRatioChange = useCallback((aspectRatio: AspectRatioKey) => {
    if (!photoImg) return;
    const recomposed = recomposeForAspectRatio(
      normalizedComposition,
      aspectRatio,
      photoImg.naturalWidth,
      photoImg.naturalHeight,
    );
    onChange(recomposed);
  }, [normalizedComposition, onChange, photoImg]);

  const dims = ASPECT_RATIOS[normalizedComposition.aspectRatio];
  const previewMaxH = normalizedComposition.aspectRatio === "story" || normalizedComposition.aspectRatio === "reels" ? 460 : 360;

  return (
    <div className="space-y-4">
      <AspectRatioSwitcher value={normalizedComposition.aspectRatio} onChange={handleAspectRatioChange} />

      <PresetStrip composition={normalizedComposition} onChange={onChange} brandIdentity={brandIdentity} />

      <div className="flex justify-center">
        <div className="relative overflow-hidden rounded-[22px] border border-slate-800 bg-slate-950" style={{ maxHeight: previewMaxH }}>
          <canvas
            ref={canvasRef}
            style={{
              maxHeight: previewMaxH,
              width: "auto",
              display: "block",
            }}
          />
          {photoImg ? <SafeAreaOverlay aspectRatio={normalizedComposition.aspectRatio} /> : null}
          {!photoImg ? (
            <div
              className="flex items-center justify-center p-8 text-sm text-slate-500"
              style={{ aspectRatio: `${dims.width}/${dims.height}`, width: 250 }}
            >
              Gere uma imagem para começar
            </div>
          ) : null}
        </div>
      </div>

      <BackgroundPanel composition={normalizedComposition} onChange={onChange} />
      <TextPanel composition={normalizedComposition} onChange={onChange} brandIdentity={brandIdentity} />
      <LogoPanel composition={normalizedComposition} onChange={onChange} brandIdentity={brandIdentity} />
      <OverlayPanel composition={normalizedComposition} onChange={onChange} brandIdentity={brandIdentity} />
      <ImageAdjustments
        composition={normalizedComposition}
        onChange={onChange}
      />
    </div>
  );
}

function ImageAdjustments({
  composition,
  onChange,
}: {
  composition: LayerComposition;
  onChange: (composition: LayerComposition) => void;
}) {
  const { ImageFilterControls } = require("./criar/ImageFilterControls");

  return (
    <EditorPanel title="Ajustes de imagem">
      <ImageFilterControls
        filters={composition.filters || { brightness: 0, contrast: 0, saturation: 0, warmth: 0 }}
        onChange={(filters: import("@/lib/types/layer-composition").ImageFilters) => onChange({ ...composition, filters })}
      />
    </EditorPanel>
  );
}
