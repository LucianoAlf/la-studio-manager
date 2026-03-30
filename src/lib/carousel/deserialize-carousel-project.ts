import type { BrandIdentity } from "@/types/brand";
import { deserializeComposition, getBrandFontFamily, getBrandLogoUrl, hexToRgbString } from "@/lib/types/layer-composition";
import { applyThemeToCarouselProject } from "./create-carousel-project";
import type { CarouselKind, CarouselProject, CarouselSlide, CarouselTheme } from "./types";

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultTheme(brandIdentity?: BrandIdentity | null): CarouselTheme {
  return {
    palette: [
      brandIdentity?.color_primary,
      brandIdentity?.color_secondary,
      brandIdentity?.color_accent,
      brandIdentity?.color_gradient_start,
      brandIdentity?.color_gradient_end,
    ].filter((color, index, list): color is string => Boolean(color) && list.indexOf(color) === index),
    gradientStart: brandIdentity?.color_gradient_start || undefined,
    gradientEnd: brandIdentity?.color_gradient_end || undefined,
    fontHeading: getBrandFontFamily(brandIdentity),
    fontBody: brandIdentity?.font_body || getBrandFontFamily(brandIdentity),
    logoVariant: getBrandLogoUrl(brandIdentity, "horizontal") ? "horizontal" : "primary",
    overlayPreset: "auto",
  };
}

function inferKind(input: Record<string, unknown>): CarouselKind {
  return input.kind === "photo_story" ? "photo_story" : "educational";
}

function deserializeSlide(
  raw: Record<string, unknown>,
  index: number,
  brandIdentity?: BrandIdentity | null,
): CarouselSlide {
  const composition = deserializeComposition(raw.composition || raw, brandIdentity);
  const photoUrl = typeof raw.photoUrl === "string"
    ? raw.photoUrl
    : composition.background.photoUrl;

  return {
    id: typeof raw.id === "string" ? raw.id : createId("carousel-slide"),
    index,
    role: raw.role === "hook" || raw.role === "content" || raw.role === "proof" || raw.role === "cta" ? raw.role : "cover",
    layoutType: typeof raw.layoutType === "string" ? raw.layoutType : "cover-hero",
    headline: typeof raw.headline === "string" ? raw.headline : composition.textLayers[0]?.content,
    body: typeof raw.body === "string" ? raw.body : composition.textLayers[1]?.content,
    cta: typeof raw.cta === "string" ? raw.cta : undefined,
    summary: typeof raw.summary === "string" ? raw.summary : undefined,
    photoUrl,
    photoAssetId: typeof raw.photoAssetId === "string" ? raw.photoAssetId : undefined,
    composition,
    renderUrl: typeof raw.renderUrl === "string" ? raw.renderUrl : undefined,
  };
}

export function deserializeCarouselProject(input: unknown, brandIdentity?: BrandIdentity | null): CarouselProject | null {
  if (!input || typeof input !== "object") return null;

  const raw = input as Record<string, unknown>;
  const slidesSource = Array.isArray(raw.slides) ? raw.slides : [];
  if (slidesSource.length === 0) return null;

  const theme = raw.theme && typeof raw.theme === "object"
    ? {
        ...defaultTheme(brandIdentity),
        ...(raw.theme as CarouselTheme),
      }
    : defaultTheme(brandIdentity);

  const project: CarouselProject = {
    id: typeof raw.id === "string" ? raw.id : createId("carousel-project"),
    brandId: typeof raw.brandId === "string" ? raw.brandId : "la_music_school",
    kind: inferKind(raw),
    tone: typeof raw.tone === "string" ? raw.tone : "profissional",
    aspectRatio: "4:5",
    slideCount: slidesSource.length,
    slides: slidesSource.map((slide, index) => deserializeSlide((slide || {}) as Record<string, unknown>, index, brandIdentity)),
    theme,
    status: raw.status === "approved" || raw.status === "scheduled" || raw.status === "published" || raw.status === "generated"
      ? raw.status
      : "draft",
    coverSlideIndex: typeof raw.coverSlideIndex === "number" ? raw.coverSlideIndex : 0,
    title: typeof raw.title === "string" ? raw.title : undefined,
    brief: typeof raw.brief === "string" ? raw.brief : undefined,
    caption: typeof raw.caption === "string" ? raw.caption : undefined,
    cta: typeof raw.cta === "string" ? raw.cta : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };

  return applyThemeToCarouselProject(project, theme, brandIdentity);
}

export function carouselProjectToMetadata(project: CarouselProject): Record<string, unknown> {
  return {
    ...project,
    theme: {
      ...project.theme,
      gradientStart: project.theme.gradientStart ? hexToRgbString(project.theme.gradientStart, project.theme.gradientStart) : undefined,
      gradientEnd: project.theme.gradientEnd ? hexToRgbString(project.theme.gradientEnd, project.theme.gradientEnd) : undefined,
    },
  };
}
