"use client";

import type { PhotoAsset } from "@/lib/queries/studio";
import type { BrandIdentity } from "@/types/brand";
import type { CarouselProject, CarouselSlide } from "@/lib/carousel/types";
import { useCarouselTemplates } from "@/hooks/useCarouselTemplates";

const EDUCATIONAL_LAYOUTS = [
  { id: "cover-hero", label: "Capa" },
  { id: "headline-body", label: "Headline" },
  { id: "stat-highlight", label: "Destaque" },
  { id: "checklist", label: "Checklist" },
  { id: "quote-proof", label: "Prova" },
  { id: "cta-end", label: "CTA" },
];

const PHOTO_LAYOUTS = [
  { id: "cover-split", label: "Capa split" },
  { id: "photo-hero", label: "Hero" },
  { id: "photo-caption", label: "Legenda" },
  { id: "split-photo-copy", label: "Split" },
  { id: "photo-quote", label: "Quote" },
  { id: "cta-photo-end", label: "CTA foto" },
];

interface Props {
  project: CarouselProject;
  slide: CarouselSlide;
  brandIdentity?: BrandIdentity | null;
  eventPhotos: PhotoAsset[];
  onChangeMeta: (updates: Partial<CarouselSlide>) => void;
  onLayoutChange: (layoutType: string) => void;
  onSetCoverSlide: () => void;
  onRegenerateSlide: (extras?: { hint_template?: string }) => void;
  isCoverSlide: boolean;
}

export function CarouselSlideEditor({
  project,
  slide,
  brandIdentity,
  eventPhotos,
  onChangeMeta,
  onLayoutChange,
  onSetCoverSlide,
  onRegenerateSlide,
  isCoverSlide,
}: Props) {
  const layouts = project.kind === "educational" ? EDUCATIONAL_LAYOUTS : PHOTO_LAYOUTS;
  const normalizeTemplateType = (value: string) => {
    const lower = value.toLowerCase();
    if (lower.includes("cta")) return "cta";
    if (lower.includes("photo")) return "photo";
    return "typographic";
  };
  const { templates } = useCarouselTemplates(brandIdentity?.brand_key || project.brandId || "la_music_school");
  const filteredTemplates = templates.filter((template) => {
    const templateType = normalizeTemplateType(template.type);
    if (slide.role === "cta") return templateType === "cta";
    if (slide.photoMode !== "none") return templateType !== "cta";
    return templateType !== "cta";
  });

  const selectedTemplate = filteredTemplates.find((item) => item.id === slide.templateId)
    || filteredTemplates.find((item) => item.name === slide.templateName)
    || null;

  return (
    <div className="space-y-4 overflow-y-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Slide {slide.index + 1} - {slide.role.toUpperCase()}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Edite conteúdo, template e foto. O render final sempre segue estes campos.
          </p>
        </div>
        {!isCoverSlide && (
          <button
            type="button"
            onClick={onSetCoverSlide}
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-[10px] text-slate-300 transition-colors hover:bg-slate-800"
          >
            Definir capa
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
        {slide.renderUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.renderUrl}
            alt={`Slide ${slide.index + 1}`}
            className="block w-full"
            style={{ aspectRatio: "4/5" }}
          />
        ) : (
          <div className="flex items-center justify-center bg-slate-950 text-slate-500" style={{ aspectRatio: "4/5" }}>
            <span className="text-xs">Aguardando render</span>
          </div>
        )}
      </div>

      <Section title="Conteúdo">
        <Field label="Headline">
          <input
            value={slide.headline || ""}
            onChange={(event) => onChangeMeta({ headline: event.target.value, renderUrl: null, html: null })}
            className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
            placeholder="Título principal"
          />
        </Field>

        <Field label="Body">
          <textarea
            value={slide.body || ""}
            onChange={(event) => onChangeMeta({ body: event.target.value, renderUrl: null, html: null })}
            className="min-h-[88px] w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
            placeholder="Texto de apoio"
          />
        </Field>

        {slide.role === "cta" && (
          <Field label="CTA">
            <input
              value={slide.cta || ""}
              onChange={(event) => onChangeMeta({ cta: event.target.value, renderUrl: null, html: null })}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
              placeholder="Ex: Agende uma aula experimental"
            />
          </Field>
        )}
      </Section>

      <Section title="Layout">
        <div className="grid grid-cols-3 gap-2">
          {layouts.map((layout) => (
            <button
              key={layout.id}
              type="button"
              onClick={() => onLayoutChange(layout.id)}
              className={`rounded-lg border px-2 py-2 text-[11px] transition-colors ${
                slide.layoutType === layout.id
                  ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                  : "border-slate-700 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {layout.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Template visual">
        <div className="grid gap-2">
          {filteredTemplates.length > 0 ? filteredTemplates.map((template) => {
            const active = selectedTemplate?.id === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => onChangeMeta({
                  templateId: template.id,
                  templateName: template.name,
                  templatePreviewUrl: template.preview_url || undefined,
                  renderUrl: null,
                  html: null,
                })}
                className={`overflow-hidden rounded-xl border text-left transition-colors ${
                  active
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-slate-700 bg-slate-900/40 hover:bg-slate-900/70"
                }`}
              >
                <div className="flex gap-3 p-3">
                  {template.preview_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={template.preview_url}
                      alt={template.name}
                      className="h-20 w-16 rounded-md object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-16 items-center justify-center rounded-md bg-slate-800 text-[10px] text-slate-500">
                      Sem thumb
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-100">{template.name}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">{normalizeTemplateType(template.type)}</p>
                    {template.description ? (
                      <p className="mt-1 line-clamp-3 text-xs text-slate-400">{template.description}</p>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          }) : (
            <p className="text-xs text-slate-500">Nenhum template salvo encontrado para esta marca.</p>
          )}
        </div>
      </Section>

      <Section title="Foto">
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: "none", label: "Sem foto" },
            { value: "asset", label: "Foto do banco" },
            { value: "generated", label: "Gerar com Gemini" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChangeMeta({
                photoMode: option.value as CarouselSlide["photoMode"],
                photoPrompt: option.value === "generated" ? (slide.photoPrompt || slide.summary || slide.headline || "") : null,
                renderUrl: null,
                html: null,
              })}
              className={`rounded-lg border px-2 py-2 text-[11px] transition-colors ${
                slide.photoMode === option.value
                  ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                  : "border-slate-700 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {slide.photoMode === "asset" ? (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Escolha do banco</p>
            <div className="grid grid-cols-4 gap-2">
              {eventPhotos.slice(0, 8).map((photo) => {
                const active = slide.photoAssetId === photo.id || slide.photoUrl === photo.file_url;
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => onChangeMeta({
                      photoMode: "asset",
                      photoAssetId: photo.id,
                      photoUrl: photo.file_url,
                      renderUrl: null,
                      html: null,
                    })}
                    className={`overflow-hidden rounded-lg border transition-colors ${
                      active ? "border-cyan-500" : "border-slate-700 hover:border-slate-500"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.file_url} alt={photo.person_name || "Asset"} className="h-20 w-full object-cover" />
                  </button>
                );
              })}
            </div>
            {eventPhotos.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhuma foto carregada no banco para usar neste slide.</p>
            ) : null}
          </div>
        ) : null}

        {slide.photoMode === "generated" ? (
          <Field label="Prompt da foto">
            <textarea
              value={slide.photoPrompt || ""}
              onChange={(event) => onChangeMeta({
                photoMode: "generated",
                photoPrompt: event.target.value,
                photoAssetId: null,
                photoUrl: null,
                renderUrl: null,
                html: null,
              })}
              className="min-h-[88px] w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
              placeholder="Ex: close nas mãos do guitarrista, luz quente de estúdio, fundo limpo"
            />
          </Field>
        ) : null}
      </Section>

      {selectedTemplate?.preview_url ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Baseado em</p>
          <div className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedTemplate.preview_url} alt={selectedTemplate.name} className="h-16 w-12 rounded-md object-cover" />
            <div>
              <p className="text-sm font-semibold text-slate-100">{selectedTemplate.name}</p>
              <p className="text-xs text-slate-400">{selectedTemplate.description || "Template visual selecionado para este slide."}</p>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => onRegenerateSlide(selectedTemplate?.name ? { hint_template: selectedTemplate.name } : undefined)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-600"
      >
        Regenerar este slide
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-slate-400">{label}</label>
      {children}
    </div>
  );
}
