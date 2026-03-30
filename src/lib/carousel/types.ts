import type { LayerComposition, LogoVariant, OverlayPresetId } from "@/lib/types/layer-composition";

export type CarouselKind = "educational" | "photo_story";
export type CarouselProjectStatus = "draft" | "generated" | "approved" | "scheduled" | "published";
export type CarouselSlideRole = "cover" | "hook" | "content" | "proof" | "cta";

export interface CarouselOutlineSlide {
  role: CarouselSlideRole;
  layoutType: string;
  headline?: string;
  body?: string;
  cta?: string;
  summary?: string;
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
  headline?: string;
  body?: string;
  cta?: string;
  summary?: string;
  photoUrl?: string;
  photoAssetId?: string;
  composition: LayerComposition;
  renderUrl?: string;
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
  title?: string;
  brief?: string;
  caption?: string;
  cta?: string;
  updatedAt?: string;
}
