import type { LayerComposition, LogoVariant, OverlayPresetId } from "@/lib/types/layer-composition";

export type CarouselKind = "educational" | "photo_story";
export type CarouselProjectStatus = "draft" | "generated" | "approved" | "scheduled" | "published";
export type CarouselSlideRole = "cover" | "hook" | "content" | "proof" | "cta";
export type CarouselPhotoMode = "none" | "asset" | "generated";

export interface CarouselOutlineSlide {
  role: CarouselSlideRole;
  layoutType: string;
  templateId?: string;
  templateName?: string;
  headline?: string;
  body?: string;
  cta?: string;
  summary?: string;
  photoMode?: CarouselPhotoMode;
  photoPrompt?: string;
}

export interface CarouselTheme {
  palette: string[];
  gradientStart?: string;
  gradientEnd?: string;
  fontHeading: string;
  fontBody: string;
  logoVariant: LogoVariant;
  overlayPreset?: OverlayPresetId | "auto";
}

export interface CarouselSlide {
  id: string;
  index: number;
  role: CarouselSlideRole;
  layoutType: string;
  templateId?: string;
  templateName?: string;
  templatePreviewUrl?: string;
  headline?: string;
  body?: string;
  cta?: string;
  summary?: string;
  photoMode: CarouselPhotoMode;
  photoUrl?: string | null;
  photoAssetId?: string | null;
  photoPrompt?: string | null;
  composition?: LayerComposition | null;
  renderUrl?: string | null;
  previewUrl?: string | null;
  html?: string | null;
  placeholderValues?: Record<string, string> | null;
}

export interface CarouselProject {
  id: string;
  brandId: string;
  kind: CarouselKind;
  tone: string;
  aspectRatio: "4:5";
  slideCount: number;
  slides: CarouselSlide[];
  theme: CarouselTheme;
  status: CarouselProjectStatus;
  coverSlideIndex: number;
  slideUrls?: string[];
  coverUrl?: string | null;
  renderedAt?: string;
  references?: Array<{ id: string; url: string; label?: string }>;
  title?: string;
  brief?: string;
  caption?: string;
  cta?: string;
  updatedAt?: string;
}
