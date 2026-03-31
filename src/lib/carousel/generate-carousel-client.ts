import type { CarouselKind, CarouselProject, CarouselSlide, CarouselSlideRole } from "./types";

export interface CarouselReferenceInput {
  id: string;
  url: string;
  label?: string;
}

export interface GenerateCarouselOutlinePayload {
  action: "outline";
  brand: string;
  brief: string;
  kind: CarouselKind;
  tone: string;
  slide_count: number;
  cta: string;
  reference_template_ids?: string[];
  selected_photo_assets?: Array<{ id: string; url: string; label?: string }>;
}

export interface GenerateCarouselRenderDeckPayload {
  action: "render_deck";
  brand: string;
  project: CarouselProject;
  engine: "claude" | "gemini";
}

export interface GenerateCarouselRenderSlidePayload {
  action: "render_slide";
  brand: string;
  projectId: string;
  slide: CarouselSlide;
  engine: "claude" | "gemini";
}

export interface GenerateCarouselOutlineResponse {
  success: boolean;
  caption?: string;
  hashtags?: string[];
  slides?: Array<{
    role: CarouselSlideRole;
    layout_type: string;
    template_id?: string;
    template_name?: string;
    headline?: string;
    body?: string;
    cta?: string;
    summary?: string;
    photo_mode?: CarouselSlide["photoMode"];
    photo_prompt?: string;
    placeholder_values?: Record<string, string>;
  }>;
  error?: string;
}

export interface GenerateCarouselRenderResponse {
  success: boolean;
  project?: CarouselProject;
  slide?: CarouselSlide;
  slides?: Array<{
    id: string;
    index: number;
    role: string;
    templateId?: string;
    renderUrl: string | null;
    previewUrl?: string | null;
    html?: string | null;
    errors?: string[];
  }>;
  error?: string;
}

type InvokeBody =
  | GenerateCarouselOutlinePayload
  | GenerateCarouselRenderDeckPayload
  | GenerateCarouselRenderSlidePayload;

export async function invokeGenerateCarousel<T>(
  supabase: { functions: { invoke: <R>(name: string, args: { body: InvokeBody }) => Promise<{ data: R | null; error: Error | null }> } },
  body: InvokeBody,
): Promise<{ data: T | null; error: Error | null }> {
  return supabase.functions.invoke<T>("generate-carousel", { body });
}
