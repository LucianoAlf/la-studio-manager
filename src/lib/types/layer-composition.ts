/**
 * Layer Composition System
 * Define a estrutura de camadas para composição de posts no Canvas API.
 * Cada post é composto por: foto de fundo + textos editáveis + logo posicionável + gradiente.
 */

// Proporções do Instagram
export type AspectRatioKey = "story" | "feed" | "reels" | "carousel";

export const ASPECT_RATIOS: Record<AspectRatioKey, { width: number; height: number; label: string; ratio: string }> = {
  story:    { width: 1080, height: 1920, label: "Story",     ratio: "9:16" },
  feed:     { width: 1080, height: 1350, label: "Feed",      ratio: "4:5" },
  reels:    { width: 1080, height: 1920, label: "Reels",     ratio: "9:16" },
  carousel: { width: 1080, height: 1350, label: "Carrossel", ratio: "4:5" },
};

// Posições predefinidas para logo
export type LogoPresetPosition =
  | "top-left" | "top-center" | "top-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

// Área de crop normalizada (0-1)
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Camada de fundo (foto)
export interface BackgroundLayer {
  photoUrl: string;
  cropArea: CropArea;
  focalPoint: { x: number; y: number }; // 0-1, centro de interesse
}

// Camada de texto
export interface TextLayer {
  id: string;
  content: string;
  fontFamily: string;
  fontSize: number;       // relativo à largura do canvas (ex: 0.06 = 6% da largura)
  fontWeight: number;     // 400, 500, 600, 700, 800, 900
  color: string;          // hex
  position: { x: number; y: number }; // normalizado 0-1
  anchor: "center" | "left" | "right";
  maxWidthRatio: number;  // largura máxima como fração do canvas (ex: 0.9)
  shadow?: {
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  letterSpacing?: number; // em pixels
}

// Camada de logo
export interface LogoLayer {
  logoUrl: string;
  position: LogoPresetPosition | { x: number; y: number };
  scale: number;   // 0.05 a 0.3 relativo à largura do canvas
  opacity: number; // 0-1
}

// Camada de gradiente (para legibilidade do texto)
export interface GradientLayer {
  enabled: boolean;
  direction: "bottom" | "top";
  startRatio: number; // onde começa (0-1 a partir da direção)
  opacity: number;    // 0-1
  color: string;      // rgb sem alpha, ex: "0,0,0"
}

// Composição completa
export interface LayerComposition {
  version: 1;
  aspectRatio: AspectRatioKey;
  background: BackgroundLayer;
  textLayers: TextLayer[];
  logoLayer: LogoLayer | null;
  gradient: GradientLayer;
}

// Defaults para criar uma composição inicial
export function createDefaultComposition(
  photoUrl: string,
  mainText: string,
  logoUrl: string | null,
  aspectRatio: AspectRatioKey = "story",
  brandColors?: { accent: string; accent2: string },
): LayerComposition {
  return {
    version: 1,
    aspectRatio,
    background: {
      photoUrl,
      cropArea: { x: 0, y: 0, width: 1, height: 1 },
      focalPoint: { x: 0.5, y: 0.5 },
    },
    textLayers: [
      {
        id: "main",
        content: mainText,
        fontFamily: "Inter",
        fontSize: 0.055,
        fontWeight: 700,
        color: "#FFFFFF",
        position: { x: 0.5, y: 0.78 },
        anchor: "center",
        maxWidthRatio: 0.85,
        shadow: { color: "rgba(0,0,0,0.7)", blur: 8, offsetX: 0, offsetY: 2 },
      },
    ],
    logoLayer: logoUrl ? {
      logoUrl,
      position: "bottom-center",
      scale: 0.12,
      opacity: 1,
    } : null,
    gradient: {
      enabled: true,
      direction: "bottom",
      startRatio: 0.5,
      opacity: 0.6,
      color: "0,0,0",
    },
  };
}
