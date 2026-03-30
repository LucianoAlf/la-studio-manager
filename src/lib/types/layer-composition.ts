/**
 * Layer Composition System v2
 * Foto de fundo + textos editáveis + logo posicionável + overlays de legibilidade.
 */

import type { BrandIdentity } from "@/types/brand";

// Proporções do Instagram
export type AspectRatioKey = "story" | "feed" | "reels" | "carousel";

export const ASPECT_RATIOS: Record<AspectRatioKey, { width: number; height: number; label: string; ratio: string }> = {
  story: { width: 1080, height: 1920, label: "Story", ratio: "9:16" },
  feed: { width: 1080, height: 1350, label: "Feed", ratio: "4:5" },
  reels: { width: 1080, height: 1920, label: "Reels", ratio: "9:16" },
  carousel: { width: 1080, height: 1350, label: "Carrossel", ratio: "4:5" },
};

export type LogoPresetPosition =
  | "top-left" | "top-center" | "top-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

export type LogoVariant = "primary" | "light" | "dark" | "horizontal" | "icon";
export type OverlayPresetId = "none" | "base" | "top" | "split" | "vignette";

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BackgroundLayer {
  photoUrl: string;
  cropArea: CropArea;
  focalPoint: { x: number; y: number };
}

export interface TextStroke {
  color: string;
  width: number;
  opacity: number;
}

export interface TextLayer {
  id: string;
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle?: "normal" | "italic";
  color: string;
  opacity?: number;
  position: { x: number; y: number };
  anchor: "center" | "left" | "right";
  maxWidthRatio: number;
  lineHeight?: number;
  shadow?: {
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  stroke?: TextStroke;
  letterSpacing?: number;
  textTransform?: "none" | "uppercase";
}

export interface LogoLayer {
  logoUrl: string;
  position: LogoPresetPosition | { x: number; y: number };
  scale: number;
  opacity: number;
  variant?: LogoVariant;
  offset?: { x: number; y: number };
}

export interface ShapeLayer {
  id: string;
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  fill?: string;
  opacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
}

export interface LinearGradientLayer {
  kind: "linear";
  enabled: boolean;
  direction: "bottom" | "top";
  startRatio: number;
  endRatio: number;
  opacity: number;
  color: string;
}

export interface DualGradientLayer {
  kind: "dual";
  enabled: boolean;
  color: string;
  opacity: number;
  topStartRatio: number;
  bottomStartRatio: number;
}

export interface VignetteGradientLayer {
  kind: "vignette";
  enabled: boolean;
  color: string;
  opacity: number;
  innerRadiusRatio: number;
  feather: number;
}

export type GradientLayer = LinearGradientLayer | DualGradientLayer | VignetteGradientLayer;

export interface ImageFilters {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
}

export interface LayerComposition {
  version: 2;
  aspectRatio: AspectRatioKey;
  background: BackgroundLayer;
  shapeLayers?: ShapeLayer[];
  textLayers: TextLayer[];
  logoLayer: LogoLayer | null;
  gradient: GradientLayer;
  filters?: ImageFilters;
}

export interface CarouselComposition {
  version: 2;
  slides: LayerComposition[];
  sharedBranding: {
    logoLayer: LogoLayer | null;
    gradient: GradientLayer;
    fontFamily: string;
    accentColor: string;
  };
}

interface LegacyGradientLayer {
  enabled: boolean;
  direction: "bottom" | "top";
  startRatio: number;
  opacity: number;
  color: string;
}

interface LegacyTextLayer {
  id?: string;
  content?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: "normal" | "italic";
  color?: string;
  position?: { x?: number; y?: number };
  anchor?: "center" | "left" | "right";
  maxWidthRatio?: number;
  shadow?: {
    color?: string;
    blur?: number;
    offsetX?: number;
    offsetY?: number;
  };
  letterSpacing?: number;
}

interface LegacyLogoLayer {
  logoUrl?: string;
  position?: LogoPresetPosition | { x?: number; y?: number };
  scale?: number;
  opacity?: number;
}

interface LegacyLayerComposition {
  version?: 1;
  aspectRatio?: AspectRatioKey;
  background?: {
    photoUrl?: string;
    cropArea?: Partial<CropArea>;
    focalPoint?: { x?: number; y?: number };
  };
  shapeLayers?: Array<Partial<ShapeLayer>>;
  textLayers?: LegacyTextLayer[];
  logoLayer?: LegacyLogoLayer | null;
  gradient?: LegacyGradientLayer;
  filters?: Partial<ImageFilters>;
}

export interface CreateDefaultCompositionOptions {
  photoUrl: string;
  mainText: string;
  logoUrl?: string | null;
  aspectRatio?: AspectRatioKey;
  brandIdentity?: BrandIdentity | null;
  presetId?: OverlayPresetId;
  platform?: AspectRatioKey;
}

const DEFAULT_CROP: CropArea = { x: 0, y: 0, width: 1, height: 1 };
const DEFAULT_FOCAL_POINT = { x: 0.5, y: 0.5 };
const DEFAULT_FILTERS: ImageFilters = { brightness: 0, contrast: 0, saturation: 0, warmth: 0 };
const DEFAULT_TEXT_SHADOW = { color: "rgba(0,0,0,0.7)", blur: 8, offsetX: 0, offsetY: 2 };
const DEFAULT_STROKE: TextStroke = { color: "#000000", width: 0, opacity: 0.9 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return clamp(value, 0, 1);
}

export function hexToRgbString(color?: string | null, fallback: string = "0,0,0"): string {
  if (!color) return fallback;

  if (color.includes(",")) {
    return color.split(",").slice(0, 3).map((part) => String(Number(part.trim()) || 0)).join(",");
  }

  const cleaned = color.trim();
  const rgbMatch = cleaned.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbMatch?.[1]) {
    return rgbMatch[1].split(",").slice(0, 3).map((part) => String(Number(part.trim()) || 0)).join(",");
  }

  const hex = cleaned.replace("#", "");
  const normalizedHex = hex.length === 3
    ? hex.split("").map((char) => `${char}${char}`).join("")
    : hex;

  if (!/^[0-9a-fA-F]{6}$/.test(normalizedHex)) return fallback;

  return [
    parseInt(normalizedHex.slice(0, 2), 16),
    parseInt(normalizedHex.slice(2, 4), 16),
    parseInt(normalizedHex.slice(4, 6), 16),
  ].join(",");
}

export function getBrandGradientColor(brandIdentity?: BrandIdentity | null): string {
  return hexToRgbString(
    brandIdentity?.color_gradient_end || brandIdentity?.color_gradient_start || brandIdentity?.color_bg_dark,
    "0,0,0",
  );
}

export function getBrandTextColor(brandIdentity?: BrandIdentity | null): string {
  return brandIdentity?.color_text_light || "#FFFFFF";
}

export function getBrandFontFamily(brandIdentity?: BrandIdentity | null): string {
  return brandIdentity?.font_display || brandIdentity?.font_body || "Inter";
}

export function getBrandLogoUrl(
  brandIdentity?: BrandIdentity | null,
  variant: LogoVariant = "primary",
  fallbackUrl?: string | null,
): string | null {
  const orderedVariants: LogoVariant[] = [
    variant,
    "primary",
    "light",
    "dark",
    "horizontal",
    "icon",
  ];

  for (const item of orderedVariants) {
    const url =
      item === "primary" ? brandIdentity?.logo_primary_url :
      item === "light" ? brandIdentity?.logo_light_url :
      item === "dark" ? brandIdentity?.logo_dark_url :
      item === "horizontal" ? brandIdentity?.logo_horizontal_url :
      brandIdentity?.logo_icon_url;

    if (url) return url;
  }

  return fallbackUrl ?? null;
}

export function createOverlayPreset(
  presetId: OverlayPresetId,
  color: string = "0,0,0",
): GradientLayer {
  switch (presetId) {
    case "none":
      return {
        kind: "linear",
        enabled: false,
        direction: "bottom",
        startRatio: 0.72,
        endRatio: 1,
        opacity: 0,
        color,
      };
    case "top":
      return {
        kind: "linear",
        enabled: true,
        direction: "top",
        startRatio: 0.42,
        endRatio: 1,
        opacity: 0.62,
        color,
      };
    case "split":
      return {
        kind: "dual",
        enabled: true,
        color,
        opacity: 0.58,
        topStartRatio: 0.26,
        bottomStartRatio: 0.48,
      };
    case "vignette":
      return {
        kind: "vignette",
        enabled: true,
        color,
        opacity: 0.65,
        innerRadiusRatio: 0.48,
        feather: 0.38,
      };
    case "base":
    default:
      return {
        kind: "linear",
        enabled: true,
        direction: "bottom",
        startRatio: 0.48,
        endRatio: 1,
        opacity: 0.72,
        color,
      };
  }
}

function normalizeTextLayer(layer: LegacyTextLayer | TextLayer | undefined, index: number, brandIdentity?: BrandIdentity | null): TextLayer {
  const positionX = clamp01(layer?.position?.x, 0.5);
  const positionY = clamp01(layer?.position?.y, index === 0 ? 0.78 : 0.5);
  const maxWidthRatio = typeof layer?.maxWidthRatio === "number" ? clamp(layer.maxWidthRatio, 0.2, 1) : 0.85;

  return {
    id: layer?.id || `text-${Date.now()}-${index}`,
    content: layer?.content || (index === 0 ? "Seu texto aqui" : "Texto adicional"),
    fontFamily: layer?.fontFamily || getBrandFontFamily(brandIdentity),
    fontSize: typeof layer?.fontSize === "number" ? clamp(layer.fontSize, 0.02, 0.18) : (index === 0 ? 0.055 : 0.04),
    fontWeight: typeof layer?.fontWeight === "number" ? layer.fontWeight : 700,
    fontStyle: layer?.fontStyle || "normal",
    color: layer?.color || getBrandTextColor(brandIdentity),
    opacity: typeof (layer as TextLayer | undefined)?.opacity === "number" ? clamp((layer as TextLayer).opacity || 1, 0, 1) : 1,
    position: { x: positionX, y: positionY },
    anchor: layer?.anchor || "center",
    maxWidthRatio,
    lineHeight: typeof (layer as TextLayer | undefined)?.lineHeight === "number" ? clamp((layer as TextLayer).lineHeight || 1.2, 0.8, 2.2) : 1.15,
    shadow: layer && "shadow" in layer
      ? layer.shadow
        ? {
            color: layer.shadow.color || DEFAULT_TEXT_SHADOW.color,
            blur: typeof layer.shadow.blur === "number" ? layer.shadow.blur : DEFAULT_TEXT_SHADOW.blur,
            offsetX: typeof layer.shadow.offsetX === "number" ? layer.shadow.offsetX : DEFAULT_TEXT_SHADOW.offsetX,
            offsetY: typeof layer.shadow.offsetY === "number" ? layer.shadow.offsetY : DEFAULT_TEXT_SHADOW.offsetY,
          }
        : undefined
      : DEFAULT_TEXT_SHADOW,
    stroke: (layer as TextLayer | undefined)?.stroke ? {
      color: (layer as TextLayer).stroke?.color || DEFAULT_STROKE.color,
      width: typeof (layer as TextLayer).stroke?.width === "number" ? (layer as TextLayer).stroke!.width : DEFAULT_STROKE.width,
      opacity: typeof (layer as TextLayer).stroke?.opacity === "number" ? clamp((layer as TextLayer).stroke!.opacity, 0, 1) : DEFAULT_STROKE.opacity,
    } : undefined,
    letterSpacing: typeof layer?.letterSpacing === "number" ? layer.letterSpacing : 0,
    textTransform: (layer as TextLayer | undefined)?.textTransform || "none",
  };
}

function normalizeLogoLayer(
  layer: LegacyLogoLayer | LogoLayer | null | undefined,
  brandIdentity?: BrandIdentity | null,
): LogoLayer | null {
  const fallbackLogo = getBrandLogoUrl(brandIdentity, "primary");
  const position = layer?.position
    ? typeof layer.position === "string"
      ? layer.position
      : {
          x: clamp01(layer.position.x, 0.5),
          y: clamp01(layer.position.y, 0.92),
        }
    : "bottom-center";
  const variant = (layer as LogoLayer | undefined)?.variant || "primary";
  const resolvedLogo = layer?.logoUrl || getBrandLogoUrl(brandIdentity, variant, fallbackLogo || null);

  if (!resolvedLogo) return null;

  return {
    logoUrl: resolvedLogo,
    position,
    scale: typeof layer?.scale === "number" ? clamp(layer.scale, 0.04, 0.35) : 0.12,
    opacity: typeof layer?.opacity === "number" ? clamp(layer.opacity, 0, 1) : 1,
    variant,
    offset: {
      x: typeof (layer as LogoLayer | undefined)?.offset?.x === "number" ? clamp((layer as LogoLayer).offset!.x, -0.2, 0.2) : 0,
      y: typeof (layer as LogoLayer | undefined)?.offset?.y === "number" ? clamp((layer as LogoLayer).offset!.y, -0.2, 0.2) : 0,
    },
  };
}

function normalizeGradientLayer(
  gradient: GradientLayer | LegacyGradientLayer | undefined,
  brandIdentity?: BrandIdentity | null,
): GradientLayer {
  const brandColor = getBrandGradientColor(brandIdentity);
  if (!gradient) return createOverlayPreset("base", brandColor);

  if ("kind" in gradient) {
    if (gradient.kind === "linear") {
      return {
        kind: "linear",
        enabled: gradient.enabled,
        direction: gradient.direction,
        startRatio: clamp01(gradient.startRatio, 0.48),
        endRatio: clamp01(gradient.endRatio, 1),
        opacity: clamp01(gradient.opacity, 0.72),
        color: hexToRgbString(gradient.color, brandColor),
      };
    }

    if (gradient.kind === "dual") {
      return {
        kind: "dual",
        enabled: gradient.enabled,
        color: hexToRgbString(gradient.color, brandColor),
        opacity: clamp01(gradient.opacity, 0.58),
        topStartRatio: clamp01(gradient.topStartRatio, 0.26),
        bottomStartRatio: clamp01(gradient.bottomStartRatio, 0.48),
      };
    }

    return {
      kind: "vignette",
      enabled: gradient.enabled,
      color: hexToRgbString(gradient.color, brandColor),
      opacity: clamp01(gradient.opacity, 0.65),
      innerRadiusRatio: clamp01(gradient.innerRadiusRatio, 0.48),
      feather: clamp01(gradient.feather, 0.38),
    };
  }

  return {
    kind: "linear",
    enabled: gradient.enabled,
    direction: gradient.direction,
    startRatio: clamp01(gradient.startRatio, 0.48),
    endRatio: 1,
    opacity: clamp01(gradient.opacity, 0.72),
    color: hexToRgbString(gradient.color, brandColor),
  };
}

export function deserializeComposition(input: unknown, brandIdentity?: BrandIdentity | null): LayerComposition {
  const source = (input || {}) as LayerComposition | LegacyLayerComposition;
  const aspectRatio = source.aspectRatio || "story";
  const background = source.background || {};
  const cropArea = background.cropArea || {};
  const focalPoint = background.focalPoint || {};

  return {
    version: 2,
    aspectRatio,
    background: {
      photoUrl: background.photoUrl || "",
      cropArea: {
        x: clamp01(cropArea.x, DEFAULT_CROP.x),
        y: clamp01(cropArea.y, DEFAULT_CROP.y),
        width: clamp01(cropArea.width, DEFAULT_CROP.width),
        height: clamp01(cropArea.height, DEFAULT_CROP.height),
      },
      focalPoint: {
        x: clamp01(focalPoint.x, DEFAULT_FOCAL_POINT.x),
        y: clamp01(focalPoint.y, DEFAULT_FOCAL_POINT.y),
      },
    },
    shapeLayers: (source.shapeLayers || []).map((layer, index) => ({
      id: layer.id || `shape-${index + 1}`,
      kind: "rect",
      x: clamp01(layer.x, 0),
      y: clamp01(layer.y, 0),
      width: clamp01(layer.width, 1),
      height: clamp01(layer.height, 1),
      radius: clamp01(layer.radius, 0),
      fill: typeof layer.fill === "string" ? layer.fill : "#FFFFFF",
      opacity: clamp01(layer.opacity, 1),
      strokeColor: typeof layer.strokeColor === "string" ? layer.strokeColor : undefined,
      strokeWidth: typeof layer.strokeWidth === "number" ? clamp(layer.strokeWidth, 0, 24) : undefined,
      strokeOpacity: typeof layer.strokeOpacity === "number" ? clamp01(layer.strokeOpacity, 1) : undefined,
    })),
    textLayers: (source.textLayers || []).map((layer, index) => normalizeTextLayer(layer, index, brandIdentity)),
    logoLayer: normalizeLogoLayer(source.logoLayer, brandIdentity),
    gradient: normalizeGradientLayer(source.gradient, brandIdentity),
    filters: {
      brightness: typeof source.filters?.brightness === "number" ? clamp(source.filters.brightness, -50, 50) : DEFAULT_FILTERS.brightness,
      contrast: typeof source.filters?.contrast === "number" ? clamp(source.filters.contrast, -50, 50) : DEFAULT_FILTERS.contrast,
      saturation: typeof source.filters?.saturation === "number" ? clamp(source.filters.saturation, -50, 50) : DEFAULT_FILTERS.saturation,
      warmth: typeof source.filters?.warmth === "number" ? clamp(source.filters.warmth, -30, 30) : DEFAULT_FILTERS.warmth,
    },
  };
}

export function createDefaultComposition(
  ...args:
    | [CreateDefaultCompositionOptions]
    | [string, string, (string | null | undefined)?, AspectRatioKey?]
): LayerComposition {
  const options: CreateDefaultCompositionOptions = typeof args[0] === "string"
    ? {
        photoUrl: args[0],
        mainText: args[1] || "Seu texto aqui",
        logoUrl: args[2],
        aspectRatio: args[3] || "story",
      }
    : args[0];

  const {
    photoUrl,
    mainText,
    logoUrl,
    aspectRatio = "story",
    brandIdentity,
    presetId = "base",
  } = options;

  const brandLogoUrl = getBrandLogoUrl(brandIdentity, "primary", logoUrl);

  return deserializeComposition({
    version: 2,
    aspectRatio,
    background: {
      photoUrl,
      cropArea: DEFAULT_CROP,
      focalPoint: DEFAULT_FOCAL_POINT,
    },
    shapeLayers: [],
    textLayers: [
      {
        id: "main",
        content: mainText,
        fontFamily: getBrandFontFamily(brandIdentity),
        fontSize: aspectRatio === "story" || aspectRatio === "reels" ? 0.058 : 0.053,
        fontWeight: 700,
        color: getBrandTextColor(brandIdentity),
        position: { x: 0.5, y: aspectRatio === "story" || aspectRatio === "reels" ? 0.78 : 0.8 },
        anchor: "center",
        maxWidthRatio: aspectRatio === "story" || aspectRatio === "reels" ? 0.84 : 0.82,
        lineHeight: 1.1,
        opacity: 1,
        textTransform: "none",
        shadow: DEFAULT_TEXT_SHADOW,
        stroke: { ...DEFAULT_STROKE, width: 0 },
        letterSpacing: 0,
      },
    ],
    logoLayer: brandLogoUrl ? {
      logoUrl: brandLogoUrl,
      position: "bottom-center",
      scale: 0.12,
      opacity: 1,
      variant: "primary",
      offset: { x: 0, y: 0 },
    } : null,
    gradient: createOverlayPreset(presetId, getBrandGradientColor(brandIdentity)),
    filters: DEFAULT_FILTERS,
  }, brandIdentity);
}
