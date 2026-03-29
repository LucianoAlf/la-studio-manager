import type { TextLayer, GradientLayer, LogoPresetPosition } from "@/lib/types/layer-composition";

export interface TemplatePreset {
  id: string;
  name: string;
  icon: string;
  textLayers: Omit<TextLayer, "id" | "content">[];
  gradient: GradientLayer;
  logoPosition: LogoPresetPosition;
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: "bottom",
    name: "Texto Embaixo",
    icon: "⬇",
    textLayers: [
      { fontFamily: "Inter", fontSize: 0.055, fontWeight: 700, color: "#FFFFFF", position: { x: 0.5, y: 0.82 }, anchor: "center", maxWidthRatio: 0.85, shadow: { color: "rgba(0,0,0,0.7)", blur: 8, offsetX: 0, offsetY: 2 } },
    ],
    gradient: { enabled: true, direction: "bottom", startRatio: 0.5, opacity: 0.6, color: "0,0,0" },
    logoPosition: "bottom-center",
  },
  {
    id: "top",
    name: "Texto no Topo",
    icon: "⬆",
    textLayers: [
      { fontFamily: "Inter", fontSize: 0.055, fontWeight: 700, color: "#FFFFFF", position: { x: 0.5, y: 0.12 }, anchor: "center", maxWidthRatio: 0.85, shadow: { color: "rgba(0,0,0,0.7)", blur: 8, offsetX: 0, offsetY: 2 } },
    ],
    gradient: { enabled: true, direction: "top", startRatio: 0.6, opacity: 0.5, color: "0,0,0" },
    logoPosition: "bottom-center",
  },
  {
    id: "center",
    name: "Centralizado",
    icon: "⏺",
    textLayers: [
      { fontFamily: "Inter", fontSize: 0.065, fontWeight: 800, color: "#FFFFFF", position: { x: 0.5, y: 0.5 }, anchor: "center", maxWidthRatio: 0.8, shadow: { color: "rgba(0,0,0,0.8)", blur: 12, offsetX: 0, offsetY: 3 } },
    ],
    gradient: { enabled: true, direction: "bottom", startRatio: 0.0, opacity: 0.4, color: "0,0,0" },
    logoPosition: "bottom-center",
  },
  {
    id: "split",
    name: "Split",
    icon: "↕",
    textLayers: [
      { fontFamily: "Inter", fontSize: 0.04, fontWeight: 500, color: "#FFFFFF", position: { x: 0.5, y: 0.1 }, anchor: "center", maxWidthRatio: 0.8, shadow: { color: "rgba(0,0,0,0.5)", blur: 4, offsetX: 0, offsetY: 1 } },
      { fontFamily: "Inter", fontSize: 0.06, fontWeight: 800, color: "#FFFFFF", position: { x: 0.5, y: 0.85 }, anchor: "center", maxWidthRatio: 0.85, shadow: { color: "rgba(0,0,0,0.7)", blur: 8, offsetX: 0, offsetY: 2 } },
    ],
    gradient: { enabled: true, direction: "bottom", startRatio: 0.5, opacity: 0.6, color: "0,0,0" },
    logoPosition: "bottom-center",
  },
  {
    id: "headline",
    name: "Manchete",
    icon: "📰",
    textLayers: [
      { fontFamily: "Oswald", fontSize: 0.08, fontWeight: 700, color: "#FFFFFF", position: { x: 0.5, y: 0.5 }, anchor: "center", maxWidthRatio: 0.9, shadow: { color: "rgba(0,0,0,0.9)", blur: 16, offsetX: 0, offsetY: 4 } },
    ],
    gradient: { enabled: true, direction: "bottom", startRatio: 0.0, opacity: 0.55, color: "0,0,0" },
    logoPosition: "bottom-right",
  },
  {
    id: "minimal",
    name: "Minimalista",
    icon: "✨",
    textLayers: [
      { fontFamily: "Inter", fontSize: 0.035, fontWeight: 500, color: "#FFFFFF", position: { x: 0.5, y: 0.92 }, anchor: "center", maxWidthRatio: 0.7, shadow: { color: "rgba(0,0,0,0.5)", blur: 4, offsetX: 0, offsetY: 1 } },
    ],
    gradient: { enabled: false, direction: "bottom", startRatio: 0.8, opacity: 0.3, color: "0,0,0" },
    logoPosition: "bottom-right",
  },
  {
    id: "editorial",
    name: "Editorial",
    icon: "📖",
    textLayers: [
      { fontFamily: "Playfair Display", fontSize: 0.05, fontWeight: 700, fontStyle: "italic", color: "#FFFFFF", position: { x: 0.5, y: 0.15 }, anchor: "center", maxWidthRatio: 0.8, shadow: { color: "rgba(0,0,0,0.6)", blur: 6, offsetX: 0, offsetY: 2 } },
      { fontFamily: "Inter", fontSize: 0.03, fontWeight: 400, color: "#FFFFFF", position: { x: 0.5, y: 0.75 }, anchor: "center", maxWidthRatio: 0.7, shadow: { color: "rgba(0,0,0,0.5)", blur: 4, offsetX: 0, offsetY: 1 } },
    ],
    gradient: { enabled: true, direction: "bottom", startRatio: 0.4, opacity: 0.5, color: "0,0,0" },
    logoPosition: "bottom-center",
  },
  {
    id: "stories",
    name: "Stories",
    icon: "📱",
    textLayers: [
      { fontFamily: "Montserrat", fontSize: 0.07, fontWeight: 800, color: "#FFFFFF", position: { x: 0.5, y: 0.45 }, anchor: "center", maxWidthRatio: 0.85, letterSpacing: 2, shadow: { color: "rgba(0,0,0,0.8)", blur: 10, offsetX: 0, offsetY: 3 } },
    ],
    gradient: { enabled: true, direction: "bottom", startRatio: 0.2, opacity: 0.45, color: "0,0,0" },
    logoPosition: "bottom-center",
  },
];

/**
 * Aplica um preset à composição, preservando o conteúdo dos textos existentes.
 */
export function applyPresetToComposition(
  preset: TemplatePreset,
  existingTextContents: string[],
): { textLayers: TextLayer[]; gradient: GradientLayer; logoPosition: LogoPresetPosition } {
  const textLayers = preset.textLayers.map((tpl, i) => ({
    ...tpl,
    id: `text-${Date.now()}-${i}`,
    content: existingTextContents[i] || (i === 0 ? "Seu texto aqui" : "Texto adicional"),
  }));

  return {
    textLayers,
    gradient: preset.gradient,
    logoPosition: preset.logoPosition,
  };
}
