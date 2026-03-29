import type { BrandIdentity } from "@/types/brand";
import {
  type LayerComposition,
  type TextLayer,
  type LogoPresetPosition,
  type OverlayPresetId,
  createOverlayPreset,
  getBrandFontFamily,
  getBrandGradientColor,
  getBrandTextColor,
} from "@/lib/types/layer-composition";

export interface TemplatePreset {
  id: string;
  name: string;
  icon: string;
  overlayPreset: OverlayPresetId;
  logoPosition: LogoPresetPosition;
  textLayers: Array<Partial<Omit<TextLayer, "id" | "content">>>;
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: "bottom",
    name: "Texto Embaixo",
    icon: "⬇",
    overlayPreset: "base",
    logoPosition: "bottom-center",
    textLayers: [
      { fontSize: 0.055, fontWeight: 700, position: { x: 0.5, y: 0.82 }, anchor: "center", maxWidthRatio: 0.85, lineHeight: 1.1 },
    ],
  },
  {
    id: "top",
    name: "Texto no Topo",
    icon: "⬆",
    overlayPreset: "top",
    logoPosition: "bottom-center",
    textLayers: [
      { fontSize: 0.055, fontWeight: 700, position: { x: 0.5, y: 0.13 }, anchor: "center", maxWidthRatio: 0.85, lineHeight: 1.1 },
    ],
  },
  {
    id: "center",
    name: "Centralizado",
    icon: "⏺",
    overlayPreset: "vignette",
    logoPosition: "bottom-center",
    textLayers: [
      { fontSize: 0.065, fontWeight: 800, position: { x: 0.5, y: 0.5 }, anchor: "center", maxWidthRatio: 0.8, lineHeight: 1.05, textTransform: "uppercase", letterSpacing: 0.5 },
    ],
  },
  {
    id: "split",
    name: "Split",
    icon: "↕",
    overlayPreset: "split",
    logoPosition: "bottom-center",
    textLayers: [
      { fontSize: 0.038, fontWeight: 500, position: { x: 0.5, y: 0.11 }, anchor: "center", maxWidthRatio: 0.78, lineHeight: 1.2 },
      { fontSize: 0.06, fontWeight: 800, position: { x: 0.5, y: 0.84 }, anchor: "center", maxWidthRatio: 0.84, lineHeight: 1.08 },
    ],
  },
  {
    id: "headline",
    name: "Manchete",
    icon: "📰",
    overlayPreset: "vignette",
    logoPosition: "bottom-right",
    textLayers: [
      { fontFamily: "Oswald", fontSize: 0.08, fontWeight: 700, position: { x: 0.5, y: 0.52 }, anchor: "center", maxWidthRatio: 0.9, lineHeight: 0.98, textTransform: "uppercase", letterSpacing: 1.5 },
    ],
  },
  {
    id: "minimal",
    name: "Minimalista",
    icon: "✨",
    overlayPreset: "none",
    logoPosition: "bottom-right",
    textLayers: [
      { fontSize: 0.035, fontWeight: 500, position: { x: 0.5, y: 0.92 }, anchor: "center", maxWidthRatio: 0.7, lineHeight: 1.15 },
    ],
  },
  {
    id: "editorial",
    name: "Editorial",
    icon: "📖",
    overlayPreset: "top",
    logoPosition: "bottom-center",
    textLayers: [
      { fontFamily: "Playfair Display", fontSize: 0.05, fontWeight: 700, fontStyle: "italic", position: { x: 0.5, y: 0.15 }, anchor: "center", maxWidthRatio: 0.8, lineHeight: 1.2 },
      { fontSize: 0.03, fontWeight: 400, position: { x: 0.5, y: 0.76 }, anchor: "center", maxWidthRatio: 0.7, lineHeight: 1.3 },
    ],
  },
  {
    id: "stories",
    name: "Stories",
    icon: "📱",
    overlayPreset: "split",
    logoPosition: "bottom-center",
    textLayers: [
      { fontFamily: "Montserrat", fontSize: 0.07, fontWeight: 800, position: { x: 0.5, y: 0.45 }, anchor: "center", maxWidthRatio: 0.85, lineHeight: 1.02, letterSpacing: 2, textTransform: "uppercase" },
    ],
  },
];

function getPresetById(id?: string): TemplatePreset {
  return TEMPLATE_PRESETS.find((preset) => preset.id === id) || TEMPLATE_PRESETS[0];
}

export function selectDefaultPresetId(
  brandKey: BrandIdentity["brand_key"] | undefined,
  platform: LayerComposition["aspectRatio"],
  tones?: string[] | string,
): string {
  const toneList = Array.isArray(tones) ? tones : tones ? [tones] : [];
  const hasFunTone = toneList.some((tone) => ["divertido", "comemorativo"].includes(tone));
  const hasProfessionalTone = toneList.some((tone) => ["profissional", "educativo"].includes(tone));

  if (brandKey === "la_music_kids") {
    if (platform === "story" || platform === "reels") return "stories";
    return hasFunTone ? "center" : "split";
  }

  if (platform === "carousel") return hasProfessionalTone ? "editorial" : "split";
  if (platform === "story" || platform === "reels") return hasProfessionalTone ? "bottom" : "stories";
  return hasProfessionalTone ? "headline" : "bottom";
}

export function applyPresetToComposition(
  presetId: string,
  composition: LayerComposition,
  brandIdentity?: BrandIdentity | null,
): LayerComposition {
  const preset = getPresetById(presetId);
  const existingTexts = composition.textLayers.map((layer) => layer.content);
  const fontFamily = getBrandFontFamily(brandIdentity);
  const textColor = getBrandTextColor(brandIdentity);
  const gradientColor = getBrandGradientColor(brandIdentity);

  return {
    ...composition,
    textLayers: preset.textLayers.map((template, index) => ({
      id: `text-${Date.now()}-${index}`,
      content: existingTexts[index] || (index === 0 ? "Seu texto aqui" : "Texto adicional"),
      fontFamily: template.fontFamily || fontFamily,
      fontSize: template.fontSize ?? (index === 0 ? 0.055 : 0.04),
      fontWeight: template.fontWeight ?? 700,
      fontStyle: template.fontStyle || "normal",
      color: template.color || textColor,
      opacity: template.opacity ?? 1,
      position: template.position || { x: 0.5, y: index === 0 ? 0.78 : 0.5 },
      anchor: template.anchor || "center",
      maxWidthRatio: template.maxWidthRatio ?? 0.85,
      lineHeight: template.lineHeight ?? 1.12,
      shadow: template.shadow || { color: "rgba(0,0,0,0.7)", blur: 8, offsetX: 0, offsetY: 2 },
      stroke: template.stroke || undefined,
      letterSpacing: template.letterSpacing ?? 0,
      textTransform: template.textTransform || "none",
    })),
    gradient: createOverlayPreset(preset.overlayPreset, gradientColor),
    logoLayer: composition.logoLayer
      ? { ...composition.logoLayer, position: preset.logoPosition }
      : null,
  };
}
