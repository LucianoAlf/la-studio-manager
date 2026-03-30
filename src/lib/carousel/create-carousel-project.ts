import type { BrandIdentity } from "@/types/brand";
import {
  createDefaultComposition,
  createOverlayPreset,
  deserializeComposition,
  getBrandFontFamily,
  getBrandGradientColor,
  getBrandLogoUrl,
  getBrandTextColor,
  hexToRgbString,
  type LayerComposition,
  type LogoLayer,
  type OverlayPresetId,
  type TextLayer,
} from "@/lib/types/layer-composition";
import type { CarouselKind, CarouselOutlineSlide, CarouselProject, CarouselSlide, CarouselSlideRole, CarouselTheme } from "./types";

interface CreateCarouselProjectOptions {
  brandId: string;
  kind: CarouselKind;
  tone: string;
  brief: string;
  caption?: string;
  cta?: string;
  brandIdentity?: BrandIdentity | null;
  photoUrls: string[];
  photoAssetIds?: Array<string | undefined>;
  slideCount?: number;
  projectId?: string;
  outlineSlides?: CarouselOutlineSlide[];
}

type SlideDraft = Pick<CarouselSlide, "role" | "layoutType" | "headline" | "body" | "cta" | "summary" | "photoUrl" | "photoAssetId">;

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampSlideCount(kind: CarouselKind, requested?: number): number {
  const fallback = kind === "educational" ? 6 : 5;
  if (typeof requested !== "number" || Number.isNaN(requested)) return fallback;
  return Math.max(4, Math.min(8, Math.round(requested)));
}

function normalizeLines(input: string): string[] {
  return input
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeSentences(input: string): string[] {
  return input
    .split(/[.!?]+/)
    .map((chunk) => chunk.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function trimCopy(input: string | undefined, fallback: string, limit: number): string {
  const source = (input || fallback).trim();
  if (source.length <= limit) return source;
  return `${source.slice(0, Math.max(0, limit - 1)).trim()}...`;
}

function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function cleanupCarouselCopy(input: string | undefined, fallback: string): string {
  const raw = (input || fallback).replace(/\s+/g, " ").trim();
  if (!raw) return fallback;

  const extracted = raw.match(/(?:sobre|tema:?|assunto:?|foco em|para falar de)\s+(.+)/i)?.[1] || raw;
  const withoutPromptShell = extracted
    .replace(/\b(crie|gere|fa[çc]a|monte|preciso de|quero|desenvolva|escreva)\b/gi, " ")
    .replace(/\b(carrossel|carousel|slide|slides|lamina|laminas|lâmina|lâminas)\b/gi, " ")
    .replace(/\b(propor[cç][aã]o|4:5|instagram|feed|story|stories|reels?)\b/gi, " ")
    .replace(/[|:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!withoutPromptShell) return fallback;

  const cleaned = withoutPromptShell
    .replace(/^(de|do|da|para|com|sobre)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || fallback;
}

function shortCarouselHeadline(input: string | undefined, fallback: string): string {
  const cleaned = cleanupCarouselCopy(input, fallback);
  if (cleaned.length <= 30) return cleaned;
  return cleaned.split(/\s+/).filter(Boolean).slice(0, 5).join(" ").slice(0, 30).trim() || fallback;
}

function firstMeaningfulLine(brief: string): string {
  const line = normalizeLines(brief)[0] || "Musica em movimento";
  return trimCopy(shortCarouselHeadline(line, "Musica em movimento"), "Musica em movimento", 30);
}

function buildTheme(brandIdentity?: BrandIdentity | null): CarouselTheme {
  const palette = [
    brandIdentity?.color_primary,
    brandIdentity?.color_secondary,
    brandIdentity?.color_accent,
    brandIdentity?.color_gradient_start,
    brandIdentity?.color_gradient_end,
    brandIdentity?.color_text_light,
  ].filter((color, index, list): color is string => Boolean(color) && list.indexOf(color) === index);

  return {
    palette,
    gradientStart: brandIdentity?.color_gradient_start || undefined,
    gradientEnd: brandIdentity?.color_gradient_end || undefined,
    fontHeading: brandIdentity?.font_display || brandIdentity?.font_body || "Inter",
    fontBody: brandIdentity?.font_body || brandIdentity?.font_display || "Inter",
    logoVariant: getBrandLogoUrl(brandIdentity, "horizontal")
      ? "horizontal"
      : getBrandLogoUrl(brandIdentity, "primary")
        ? "primary"
        : "icon",
    overlayPreset: "auto",
  };
}

function resolveOverlayPreset(theme: CarouselTheme, fallback: OverlayPresetId): OverlayPresetId {
  if (!theme.overlayPreset || theme.overlayPreset === "auto") return fallback;
  return theme.overlayPreset;
}

function buildOutlineSlides(
  outlineSlides: CarouselOutlineSlide[],
  photoUrls: string[],
  photoAssetIds: Array<string | undefined>,
  cta: string,
  slideCount: number,
): SlideDraft[] {
  return outlineSlides.slice(0, slideCount).map((slide, index) => ({
    role: slide.role,
    layoutType: slide.layoutType,
    headline: trimCopy(shortCarouselHeadline(slide.headline, `Slide ${index + 1}`), `Slide ${index + 1}`, 30),
    body: trimCopy(cleanupCarouselCopy(slide.body, ""), "", 92),
    cta: trimCopy(cleanupCarouselCopy(slide.cta, cta), cta, 44),
    summary: trimCopy(cleanupCarouselCopy(slide.summary, slide.headline || `Slide ${index + 1}`), slide.headline || `Slide ${index + 1}`, 40),
    photoUrl: photoUrls[index % Math.max(1, photoUrls.length)],
    photoAssetId: photoAssetIds[index % Math.max(1, photoAssetIds.length)] || undefined,
  }));
}

function createShapeLayer(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options?: {
    radius?: number;
    fill?: string;
    opacity?: number;
    strokeColor?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
  },
) {
  return {
    id,
    kind: "rect" as const,
    x,
    y,
    width,
    height,
    radius: options?.radius ?? 0,
    fill: options?.fill ?? "#FFFFFF",
    opacity: options?.opacity ?? 1,
    strokeColor: options?.strokeColor,
    strokeWidth: options?.strokeWidth,
    strokeOpacity: options?.strokeOpacity,
  };
}

function createTextLayer(
  id: string,
  content: string,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  x: number,
  y: number,
  anchor: TextLayer["anchor"],
  maxWidthRatio: number,
  color: string,
  overrides?: Partial<TextLayer>,
): TextLayer {
  return {
    id,
    content,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle: "normal",
    color,
    opacity: 1,
    position: { x, y },
    anchor,
    maxWidthRatio,
    lineHeight: 1.08,
    shadow: { color: "rgba(0,0,0,0.64)", blur: 10, offsetX: 0, offsetY: 3 },
    stroke: undefined,
    letterSpacing: 0,
    textTransform: "none",
    ...overrides,
  };
}

function createLogoLayer(brandIdentity?: BrandIdentity | null, variant: CarouselTheme["logoVariant"] = "horizontal"): LogoLayer | null {
  const logoUrl = getBrandLogoUrl(brandIdentity, variant) || getBrandLogoUrl(brandIdentity, "primary");
  if (!logoUrl) return null;

  return {
    logoUrl,
    position: "bottom-center",
    scale: variant === "icon" ? 0.08 : 0.16,
    opacity: 1,
    variant,
    offset: { x: 0, y: 0 },
  };
}

function buildEducationalSlides(
  photoUrls: string[],
  photoAssetIds: Array<string | undefined>,
  brief: string,
  caption: string,
  cta: string,
  slideCount: number,
): SlideDraft[] {
  const title = firstMeaningfulLine(brief);
  const sentences = [...normalizeSentences(brief), ...normalizeSentences(caption)];
  const bullets = normalizeLines(caption)
    .flatMap((line) => line.split(/[;•-]+/))
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 8);

  const intro = trimCopy(sentences[0], title, 72);
  const detailOne = trimCopy(sentences[1], bullets[0] || "Cada aula vira repertorio, presenca e memoria.", 88);
  const detailTwo = trimCopy(sentences[2], bullets[1] || "Quando o aluno vive o palco cedo, a confianca cresce junto.", 88);
  const proof = trimCopy(sentences[3], bullets[2] || "A escola vira historia para a familia e conteudo forte para a marca.", 82);

  const roles: CarouselSlideRole[] = ["cover", "hook", "content", "content", "proof", "cta"];
  const layoutTypes = ["cover-hero", "headline-body", "checklist", "stat-highlight", "quote-proof", "cta-end"];

  const drafts: SlideDraft[] = roles.slice(0, slideCount).map((role, index) => {
    const photoUrl = photoUrls[index % Math.max(1, photoUrls.length)];
    const photoAssetId = photoAssetIds[index % Math.max(1, photoAssetIds.length)] || undefined;

    if (index === 0) {
      return {
        role,
        layoutType: layoutTypes[index],
        headline: title,
        body: trimCopy(intro, intro, 74),
        summary: "Capa com gancho principal",
        cta,
        photoUrl,
        photoAssetId,
      };
    }

    if (index === 1) {
      return {
        role,
        layoutType: layoutTypes[index],
        headline: "Por que esse momento importa?",
        body: trimCopy(detailOne, detailOne, 92),
        summary: "Gancho e contexto",
        cta,
        photoUrl,
        photoAssetId,
      };
    }

    if (index === 2) {
      return {
        role,
        layoutType: layoutTypes[index],
        headline: "O que a gente ve no palco",
        body: trimCopy(detailOne, detailOne, 96),
        summary: "Primeiro desenvolvimento",
        cta,
        photoUrl,
        photoAssetId,
      };
    }

    if (index === 3) {
      return {
        role,
        layoutType: layoutTypes[index],
        headline: "O que isso constrói no aluno",
        body: trimCopy(detailTwo, detailTwo, 92),
        summary: "Segundo desenvolvimento",
        cta,
        photoUrl,
        photoAssetId,
      };
    }

    if (index === slideCount - 2) {
      return {
        role: "proof",
        layoutType: "quote-proof",
        headline: "Nao e so fofura. E formacao.",
        body: trimCopy(proof, proof, 92),
        summary: "Prova, beneficio ou bastidor",
        cta,
        photoUrl,
        photoAssetId,
      };
    }

    return {
      role: "cta",
      layoutType: "cta-end",
      headline: "Quer viver isso de perto?",
      body: trimCopy(cta, cta || "Agende uma aula experimental e veja a musica ganhar forma.", 84),
      summary: "Fechamento com CTA",
      cta,
      photoUrl,
      photoAssetId,
    };
  });

  return drafts;
}

function buildPhotoStorySlides(
  photoUrls: string[],
  photoAssetIds: Array<string | undefined>,
  brief: string,
  caption: string,
  cta: string,
  slideCount: number,
): SlideDraft[] {
  const title = firstMeaningfulLine(brief);
  const sentences = [...normalizeSentences(brief), ...normalizeSentences(caption)];
  const emotionalLine = trimCopy(sentences[0], title, 72);
  const sceneOne = trimCopy(sentences[1], "Um segundo desses ja conta a historia inteira.", 84);
  const sceneTwo = trimCopy(sentences[2], "Tem concentracao, descoberta e aquela alegria que nao precisa explicar.", 88);
  const sceneThree = trimCopy(sentences[3], "Quando a musica encaixa, todo mundo percebe.", 80);

  const roles: CarouselSlideRole[] = ["cover", "content", "content", "proof", "cta"];
  const layoutTypes = ["photo-hero", "photo-caption", "split-photo-copy", "photo-quote", "cta-photo-end"];

  return roles.slice(0, slideCount).map((role, index) => {
    const photoUrl = photoUrls[index % Math.max(1, photoUrls.length)];
    const photoAssetId = photoAssetIds[index % Math.max(1, photoAssetIds.length)] || undefined;

    if (index === 0) {
      return {
        role,
        layoutType: layoutTypes[index],
        headline: title,
        body: emotionalLine,
        summary: "Capa emocional",
        cta,
        photoUrl,
        photoAssetId,
      };
    }

    if (index === 1) {
      return {
        role,
        layoutType: layoutTypes[index],
        headline: "Cena 1",
        body: sceneOne,
        summary: "Primeira cena",
        cta,
        photoUrl,
        photoAssetId,
      };
    }

    if (index === 2) {
      return {
        role,
        layoutType: layoutTypes[index],
        headline: "Cena 2",
        body: sceneTwo,
        summary: "Segunda cena",
        cta,
        photoUrl,
        photoAssetId,
      };
    }

    if (index === slideCount - 2) {
      return {
        role: "proof",
        layoutType: "photo-quote",
        headline: "A vibe fala sozinha",
        body: sceneThree,
        summary: "Prova social ou bastidor",
        cta,
        photoUrl,
        photoAssetId,
      };
    }

    return {
      role: "cta",
      layoutType: "cta-photo-end",
      headline: "Seu proximo slide pode ser aqui",
      body: trimCopy(cta, cta || "Agende uma aula experimental.", 72),
      summary: "CTA final",
      cta,
      photoUrl,
      photoAssetId,
    };
  });
}

export function applyCarouselLayoutToComposition(
  composition: LayerComposition,
  slide: Pick<CarouselSlide, "layoutType" | "headline" | "body" | "cta" | "role">,
  theme: CarouselTheme,
  brandIdentity?: BrandIdentity | null,
): LayerComposition {
  const textColor = getBrandTextColor(brandIdentity);
  const headingFont = theme.fontHeading;
  const bodyFont = theme.fontBody;
  const gradientColor = hexToRgbString(theme.gradientEnd || theme.gradientStart || getBrandGradientColor(brandIdentity));
  const logoLayer = createLogoLayer(brandIdentity, theme.logoVariant);
  const logoScale = theme.logoVariant === "horizontal" ? 0.17 : 0.12;
  const creamPanel = brandIdentity?.color_bg_light || "#F5EFE4";
  const inkText = brandIdentity?.color_text_primary || "#1F2937";
  const mutedText = brandIdentity?.color_text_secondary || "#475569";
  const accentColor = brandIdentity?.color_accent || brandIdentity?.color_primary || "#C79A2B";

  const base = deserializeComposition({
    ...composition,
    gradient: createOverlayPreset("base", gradientColor),
    logoLayer: logoLayer ? { ...logoLayer, scale: logoScale } : null,
  }, brandIdentity);

  const headline = trimCopy(slide.headline, "Slide", 64);
  const body = trimCopy(slide.body, "", 160);
  const cta = trimCopy(slide.cta, "", 72);

  let textLayers: TextLayer[] = [];
  let gradient = createOverlayPreset("base", gradientColor);
  let updatedLogo = base.logoLayer ? { ...base.logoLayer } : null;
  let shapeLayers = base.shapeLayers || [];
  let background = { ...base.background };

  switch (slide.layoutType) {
    case "cover-hero":
      gradient = createOverlayPreset("none", gradientColor);
      background = {
        ...background,
        cropArea: { x: 0.18, y: 0, width: 0.82, height: 1 },
        focalPoint: { x: 0.78, y: 0.46 },
      };
      shapeLayers = [
        createShapeLayer("cover-panel", 0, 0, 0.58, 1, { fill: creamPanel }),
        createShapeLayer("cover-tag", 0.065, 0.08, 0.25, 0.062, {
          fill: creamPanel,
          strokeColor: accentColor,
          strokeWidth: 4,
          strokeOpacity: 1,
          radius: 0.03,
        }),
      ];
      textLayers = [
        createTextLayer("cover-kicker", "CARROSSEL", bodyFont, 0.024, 500, 0.105, 0.113, "left", 0.2, inkText, {
          textTransform: "uppercase",
          letterSpacing: 6,
          shadow: undefined,
        }),
        createTextLayer("cover-headline", headline, headingFont, 0.084, 700, 0.07, 0.3, "left", 0.38, inkText, {
          lineHeight: 0.9,
          shadow: undefined,
        }),
        createTextLayer("cover-body", body || "Para o guitarrista ganhar segurança, velocidade e clareza no toque.", bodyFont, 0.035, 500, 0.07, 0.52, "left", 0.37, mutedText, {
          lineHeight: 1.22,
          shadow: undefined,
        }),
        createTextLayer("cover-cta", "Deslize para o lado", bodyFont, 0.03, 600, 0.07, 0.82, "left", 0.28, inkText, {
          shadow: undefined,
        }),
      ];
      updatedLogo = updatedLogo ? { ...updatedLogo, position: "bottom-left", scale: 0.13, offset: { x: 0.07, y: -0.02 } } : null;
      break;
    case "headline-body":
      gradient = createOverlayPreset("none", gradientColor);
      background = {
        ...background,
        cropArea: { x: 0.14, y: 0, width: 0.86, height: 1 },
        focalPoint: { x: 0.78, y: 0.42 },
      };
      shapeLayers = [
        createShapeLayer("headline-panel", 0, 0, 0.54, 1, { fill: creamPanel }),
        createShapeLayer("headline-line", 0.07, 0.18, 0.14, 0.004, { fill: accentColor }),
      ];
      textLayers = [
        createTextLayer("headline", headline, headingFont, 0.07, 700, 0.07, 0.3, "left", 0.34, inkText, {
          lineHeight: 0.96,
          shadow: undefined,
        }),
        createTextLayer("body", body, bodyFont, 0.034, 500, 0.07, 0.56, "left", 0.34, mutedText, {
          lineHeight: 1.24,
          shadow: undefined,
        }),
      ];
      updatedLogo = updatedLogo ? { ...updatedLogo, position: "bottom-left", offset: { x: 0.06, y: -0.01 } } : null;
      break;
    case "stat-highlight":
      gradient = createOverlayPreset("none", gradientColor);
      background = {
        ...background,
        cropArea: { x: 0, y: 0, width: 1, height: 0.86 },
        focalPoint: { x: 0.56, y: 0.34 },
      };
      shapeLayers = [
        createShapeLayer("stat-panel", 0.04, 0.56, 0.92, 0.34, { fill: creamPanel, radius: 0.03 }),
      ];
      textLayers = [
        createTextLayer("stat", headline, headingFont, 0.068, 700, 0.08, 0.67, "left", 0.42, inkText, {
          lineHeight: 0.96,
          shadow: undefined,
        }),
        createTextLayer("detail", body, bodyFont, 0.034, 500, 0.08, 0.8, "left", 0.42, mutedText, {
          lineHeight: 1.22,
          shadow: undefined,
        }),
      ];
      updatedLogo = updatedLogo ? { ...updatedLogo, position: "bottom-right", scale: 0.12, offset: { x: -0.03, y: -0.03 } } : null;
      break;
    case "checklist":
      gradient = createOverlayPreset("none", gradientColor);
      background = {
        ...background,
        cropArea: { x: 0.2, y: 0, width: 0.8, height: 1 },
        focalPoint: { x: 0.82, y: 0.48 },
      };
      shapeLayers = [
        createShapeLayer("checklist-panel", 0, 0, 0.58, 1, { fill: creamPanel }),
        createShapeLayer("checklist-card", 0.07, 0.62, 0.14, 0.082, { fill: "#EEE8DE", radius: 0.02 }),
      ];
      textLayers = [
        createTextLayer("title", headline, headingFont, 0.064, 700, 0.07, 0.24, "left", 0.37, inkText, {
          lineHeight: 0.96,
          shadow: undefined,
        }),
        createTextLayer("list", body, bodyFont, 0.034, 500, 0.07, 0.5, "left", 0.37, mutedText, {
          lineHeight: 1.28,
          shadow: undefined,
        }),
        createTextLayer("tip-label", "Dica", bodyFont, 0.028, 700, 0.24, 0.655, "left", 0.16, accentColor, {
          shadow: undefined,
        }),
        createTextLayer("tip-body", "Leve isso para a proxima pratica.", bodyFont, 0.028, 600, 0.24, 0.705, "left", 0.22, inkText, {
          lineHeight: 1.16,
          shadow: undefined,
        }),
      ];
      updatedLogo = updatedLogo ? { ...updatedLogo, position: "bottom-left", scale: 0.12, offset: { x: 0.07, y: -0.02 } } : null;
      break;
    case "quote-proof":
      gradient = createOverlayPreset("none", gradientColor);
      background = {
        ...background,
        cropArea: { x: 0.08, y: 0, width: 0.92, height: 1 },
        focalPoint: { x: 0.62, y: 0.44 },
      };
      shapeLayers = [
        createShapeLayer("quote-card", 0.07, 0.5, 0.48, 0.27, { fill: creamPanel, radius: 0.03 }),
      ];
      textLayers = [
        createTextLayer("quote", headline, bodyFont, 0.024, 700, 0.11, 0.57, "left", 0.38, accentColor, {
          textTransform: "uppercase",
          letterSpacing: 2,
          shadow: undefined,
        }),
        createTextLayer("proof", body, headingFont, 0.052, 700, 0.11, 0.67, "left", 0.38, inkText, {
          fontStyle: "italic",
          lineHeight: 1.12,
          shadow: undefined,
        }),
      ];
      updatedLogo = updatedLogo ? { ...updatedLogo, position: "bottom-left", scale: 0.12, offset: { x: 0.07, y: -0.02 } } : null;
      break;
    case "cta-end":
      gradient = createOverlayPreset("none", gradientColor);
      background = {
        ...background,
        cropArea: { x: 0.18, y: 0, width: 0.82, height: 1 },
        focalPoint: { x: 0.78, y: 0.48 },
      };
      shapeLayers = [
        createShapeLayer("cta-panel", 0, 0, 0.56, 1, { fill: inkText }),
        createShapeLayer("cta-button", 0.07, 0.76, 0.26, 0.07, { fill: accentColor, radius: 0.035 }),
      ];
      textLayers = [
        createTextLayer("cta-title", headline, headingFont, 0.072, 700, 0.07, 0.3, "left", 0.36, "#FFFFFF", {
          lineHeight: 0.96,
          shadow: undefined,
        }),
        createTextLayer("cta-body", body || cta, bodyFont, 0.034, 500, 0.07, 0.56, "left", 0.34, "rgba(255,255,255,0.82)", {
          lineHeight: 1.16,
          shadow: undefined,
        }),
        createTextLayer("cta-button-text", "Fale com a escola", bodyFont, 0.028, 700, 0.1, 0.795, "left", 0.22, inkText, {
          shadow: undefined,
        }),
      ];
      updatedLogo = updatedLogo ? { ...updatedLogo, position: "bottom-left", scale: 0.12, offset: { x: 0.07, y: -0.03 } } : null;
      break;
    case "photo-hero":
      gradient = createOverlayPreset(resolveOverlayPreset(theme, "split"), gradientColor);
      background = {
        ...background,
        cropArea: { x: 0.08, y: 0, width: 0.92, height: 1 },
        focalPoint: { x: 0.62, y: 0.42 },
      };
      textLayers = [
        createTextLayer("photo-hero-headline", headline, headingFont, 0.07, 800, 0.5, 0.78, "center", 0.84, textColor, {
          lineHeight: 0.98,
          textTransform: "uppercase",
        }),
      ];
      break;
    case "photo-caption":
      gradient = createOverlayPreset("none", gradientColor);
      background = {
        ...background,
        cropArea: { x: 0, y: 0, width: 1, height: 0.92 },
        focalPoint: { x: 0.56, y: 0.32 },
      };
      shapeLayers = [
        createShapeLayer("photo-caption-card", 0.06, 0.62, 0.88, 0.24, { fill: creamPanel, radius: 0.03 }),
      ];
      textLayers = [
        createTextLayer("photo-caption-title", headline, bodyFont, 0.026, 600, 0.09, 0.69, "left", 0.74, accentColor, {
          textTransform: "uppercase",
          letterSpacing: 1.5,
          shadow: undefined,
        }),
        createTextLayer("photo-caption-body", body, headingFont, 0.046, 700, 0.09, 0.77, "left", 0.74, inkText, {
          lineHeight: 1.08,
          shadow: undefined,
        }),
      ];
      updatedLogo = updatedLogo ? { ...updatedLogo, position: "bottom-left", scale: 0.11, offset: { x: 0.08, y: -0.03 } } : null;
      break;
    case "split-photo-copy":
      gradient = createOverlayPreset("none", gradientColor);
      background = {
        ...background,
        cropArea: { x: 0.18, y: 0, width: 0.82, height: 1 },
        focalPoint: { x: 0.8, y: 0.46 },
      };
      shapeLayers = [
        createShapeLayer("split-panel", 0, 0, 0.52, 1, { fill: inkText }),
      ];
      textLayers = [
        createTextLayer("split-title", headline, headingFont, 0.064, 700, 0.07, 0.28, "left", 0.32, "#FFFFFF", {
          textTransform: "uppercase",
          lineHeight: 0.96,
          shadow: undefined,
        }),
        createTextLayer("split-body", body, bodyFont, 0.034, 500, 0.07, 0.6, "left", 0.32, "rgba(255,255,255,0.82)", {
          lineHeight: 1.24,
          shadow: undefined,
        }),
      ];
      updatedLogo = updatedLogo ? { ...updatedLogo, position: "bottom-left", scale: 0.11, offset: { x: 0.07, y: -0.03 } } : null;
      break;
    case "photo-quote":
      gradient = createOverlayPreset("none", gradientColor);
      background = {
        ...background,
        cropArea: { x: 0.08, y: 0, width: 0.92, height: 1 },
        focalPoint: { x: 0.62, y: 0.42 },
      };
      shapeLayers = [
        createShapeLayer("photo-quote-card", 0.08, 0.58, 0.84, 0.2, { fill: "rgba(15,23,42,0.78)", radius: 0.03 }),
      ];
      textLayers = [
        createTextLayer("photo-quote-body", body, headingFont, 0.048, 700, 0.5, 0.68, "center", 0.72, "#FFFFFF", {
          fontStyle: "italic",
          lineHeight: 1.12,
        }),
      ];
      break;
    case "cta-photo-end":
      gradient = createOverlayPreset("none", gradientColor);
      background = {
        ...background,
        cropArea: { x: 0.18, y: 0, width: 0.82, height: 1 },
        focalPoint: { x: 0.8, y: 0.46 },
      };
      shapeLayers = [
        createShapeLayer("cta-photo-end-panel", 0, 0, 0.5, 1, { fill: creamPanel }),
        createShapeLayer("cta-photo-end-button", 0.07, 0.77, 0.26, 0.07, { fill: accentColor, radius: 0.035 }),
      ];
      textLayers = [
        createTextLayer("cta-photo-end-headline", headline, headingFont, 0.062, 700, 0.07, 0.3, "left", 0.3, inkText, {
          lineHeight: 0.96,
          shadow: undefined,
        }),
        createTextLayer("cta-photo-end-body", body || cta, bodyFont, 0.034, 500, 0.07, 0.56, "left", 0.3, mutedText, {
          lineHeight: 1.18,
          shadow: undefined,
        }),
        createTextLayer("cta-photo-end-button-text", "Agendar aula", bodyFont, 0.028, 700, 0.11, 0.805, "left", 0.18, inkText, {
          shadow: undefined,
        }),
      ];
      updatedLogo = updatedLogo ? { ...updatedLogo, position: "bottom-left", scale: 0.11, offset: { x: 0.07, y: -0.03 } } : null;
      break;
    default:
      textLayers = [
        createTextLayer("default-headline", headline, headingFont, 0.056, 800, 0.5, 0.74, "center", 0.82, textColor),
      ];
      break;
  }

  return deserializeComposition({
    ...base,
    background,
    shapeLayers,
    textLayers,
    gradient,
    logoLayer: updatedLogo,
  }, brandIdentity);
}

function buildSlideDrafts(
  kind: CarouselKind,
  photoUrls: string[],
  photoAssetIds: Array<string | undefined>,
  brief: string,
  caption: string,
  cta: string,
  slideCount: number,
  outlineSlides?: CarouselOutlineSlide[],
): SlideDraft[] {
  if (outlineSlides && outlineSlides.length > 0) {
    return buildOutlineSlides(outlineSlides, photoUrls, photoAssetIds, cta, slideCount);
  }

  if (kind === "photo_story") {
    return buildPhotoStorySlides(photoUrls, photoAssetIds, brief, caption, cta, slideCount);
  }

  return buildEducationalSlides(photoUrls, photoAssetIds, brief, caption, cta, slideCount);
}

export function createCarouselProject(options: CreateCarouselProjectOptions): CarouselProject {
  const {
    brandId,
    kind,
    tone,
    brief,
    caption = "",
    cta = "Agende uma aula experimental",
    brandIdentity,
    photoUrls,
    photoAssetIds = [],
    slideCount: requestedSlideCount,
    projectId,
    outlineSlides,
  } = options;

  const safePhotoUrls = photoUrls.filter(Boolean);
  const slideCount = clampSlideCount(kind, requestedSlideCount);
  const theme = buildTheme(brandIdentity);
  const drafts = buildSlideDrafts(kind, safePhotoUrls, photoAssetIds, brief, caption, cta, slideCount, outlineSlides);
  const fallbackPhoto = safePhotoUrls[0] || "";

  const slides = drafts.map((draft, index) => {
    const baseComposition = createDefaultComposition({
      photoUrl: draft.photoUrl || fallbackPhoto,
      mainText: draft.headline || draft.summary || `Slide ${index + 1}`,
      logoUrl: getBrandLogoUrl(brandIdentity, theme.logoVariant) || undefined,
      aspectRatio: "carousel",
      brandIdentity,
      presetId: draft.layoutType.includes("cta") ? "split" : "base",
      platform: "carousel",
    });

    const composition = applyCarouselLayoutToComposition(baseComposition, {
      layoutType: draft.layoutType,
      headline: draft.headline,
      body: draft.body,
      cta: draft.cta,
      role: draft.role,
    }, theme, brandIdentity);

    return {
      id: createId("carousel-slide"),
      index,
      role: draft.role,
      layoutType: draft.layoutType,
      headline: draft.headline,
      body: draft.body,
      cta: draft.cta,
      summary: draft.summary,
      photoUrl: draft.photoUrl || fallbackPhoto,
      photoAssetId: draft.photoAssetId,
      composition,
    };
  });

  return {
    id: projectId || createId("carousel-project"),
    brandId,
    kind,
    tone,
    aspectRatio: "4:5",
    slideCount: slides.length,
    slides,
    theme,
    status: "generated",
    coverSlideIndex: 0,
    title: toTitleCase(firstMeaningfulLine(brief)),
    brief,
    caption,
    cta,
    updatedAt: new Date().toISOString(),
  };
}

export function applyBrandingToCarouselProject(
  project: CarouselProject,
  brandIdentity?: BrandIdentity | null,
): CarouselProject {
  return applyThemeToCarouselProject(project, buildTheme(brandIdentity), brandIdentity);
}

export function applyThemeToCarouselProject(
  project: CarouselProject,
  themePatch: Partial<CarouselTheme>,
  brandIdentity?: BrandIdentity | null,
): CarouselProject {
  const baseTheme = buildTheme(brandIdentity);
  const theme: CarouselTheme = {
    ...baseTheme,
    ...project.theme,
    ...themePatch,
    palette: themePatch.palette || project.theme.palette || baseTheme.palette,
  };

  return {
    ...project,
    theme,
    updatedAt: new Date().toISOString(),
    slides: project.slides.map((slide, index) => ({
      ...slide,
      index,
      composition: applyCarouselLayoutToComposition(
        {
          ...slide.composition,
          background: {
            ...slide.composition.background,
            photoUrl: slide.photoUrl || slide.composition.background.photoUrl,
          },
        },
        slide,
        theme,
        brandIdentity,
      ),
    })),
  };
}

export function syncCarouselSlideFromComposition(slide: CarouselSlide, composition: LayerComposition): CarouselSlide {
  return {
    ...slide,
    composition,
    headline: composition.textLayers[0]?.content || slide.headline,
    body: composition.textLayers[1]?.content || slide.body,
    cta: composition.textLayers[2]?.content || slide.cta,
  };
}
