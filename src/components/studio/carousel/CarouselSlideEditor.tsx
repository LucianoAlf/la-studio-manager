"use client";

import { useState } from "react";
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
  { id: "photo-hero", label: "Hero" },
  { id: "photo-caption", label: "Legenda" },
  { id: "split-photo-copy", label: "Split" },
  { id: "photo-quote", label: "Quote" },
  { id: "cta-photo-end", label: "CTA" },
];

const FONT_OPTIONS = ["Bebas Neue", "DM Sans", "Montserrat", "Oswald", "Plus Jakarta Sans"];
const WEIGHT_OPTIONS = [
  { value: "300", label: "Light 300" },
  { value: "400", label: "Regular 400" },
  { value: "700", label: "Bold 700" },
  { value: "800", label: "ExtraBold 800" },
];
const POSITION_OPTIONS = ["Topo", "Centro", "Abaixo", "Rodape"];
const LOGO_VARIANTS = [
  { value: "icon", label: "Icone" },
  { value: "horizontal", label: "Horizontal" },
  { value: "vertical", label: "Vertical" },
] as const;
const LOGO_POSITIONS = [
  { value: "top-left", label: "Topo esq." },
  { value: "top-right", label: "Topo dir." },
  { value: "bottom-left", label: "Rodape esq." },
  { value: "bottom-right", label: "Rodape dir." },
] as const;

interface TextLayer {
  id: string;
  content: string;
  font: string;
  weight: string;
  color: string;
  position: string;
  size: number;
}

interface Props {
  project: CarouselProject;
  slide: CarouselSlide;
  brandIdentity?: BrandIdentity | null;
  onChangeComposition: (composition: CarouselSlide["composition"]) => void;
  onChangeMeta: (updates: Partial<CarouselSlide>) => void;
  onLayoutChange: (layoutType: string) => void;
  onDuplicatePreviousStyle: () => void;
  onSetCoverSlide: () => void;
  onRegenerateSlide: (extras?: { text_layers?: unknown[]; logo_config?: unknown; hint_template?: string }) => void;
  isCoverSlide: boolean;
}

export function CarouselSlideEditor({
  project,
  slide,
  brandIdentity,
  onChangeMeta,
  onLayoutChange,
  onSetCoverSlide,
  onRegenerateSlide,
  isCoverSlide,
}: Props) {
  const layouts = project.kind === "educational" ? EDUCATIONAL_LAYOUTS : PHOTO_LAYOUTS;
  const needsPhoto = ["photo-hero", "split-photo-copy", "photo-caption", "photo-quote", "cta-photo-end"].includes(
    slide.layoutType
  );

  const { templates } = useCarouselTemplates(brandIdentity?.brand_key || project.brandId || "la_music_school");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Filter templates by slide role
  const filteredTemplates = templates.filter((t) => {
    if (slide.role === "cover") return t.type === "typographic" || t.type === "photo";
    if (slide.role === "cta") return t.type === "cta";
    return t.type !== "cta";
  });

  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [includeLogo, setIncludeLogo] = useState(true);
  const [logoVariant, setLogoVariant] = useState<string>("icon");
  const [logoPosition, setLogoPosition] = useState("bottom-left");
  const [logoSize, setLogoSize] = useState(80);

  const addTextLayer = () => {
    setTextLayers((prev) => [
      ...prev,
      {
        id: `tl-${Date.now()}`,
        content: "",
        font: "DM Sans",
        weight: "400",
        color: "#FFFFFF",
        position: "Centro",
        size: 32,
      },
    ]);
  };

  const updateTextLayer = (id: string, updates: Partial<TextLayer>) => {
    setTextLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  };

  const removeTextLayer = (id: string) => {
    setTextLayers((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <div className="space-y-3 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Slide {slide.index + 1} &mdash; {slide.role.toUpperCase()}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">{slide.layoutType}</p>
        </div>
        {!isCoverSlide && (
          <button
            type="button"
            onClick={onSetCoverSlide}
            className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800"
          >
            Definir como capa
          </button>
        )}
      </div>

      {/* Preview */}
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
          <div
            className="flex flex-col items-center justify-center bg-slate-950 text-slate-500"
            style={{ aspectRatio: "4/5" }}
          >
            <span className="text-3xl font-bold text-slate-600">{slide.index + 1}</span>
            <span className="mt-1 text-xs">Aguardando render</span>
          </div>
        )}
      </div>

      {/* Editable fields */}
      <div className="space-y-2">
        <Field label="Headline">
          <input
            value={slide.headline || ""}
            onChange={(e) => onChangeMeta({ headline: e.target.value })}
            className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
            placeholder="Titulo do slide"
          />
        </Field>

        <Field label="Body">
          <textarea
            value={slide.body || ""}
            onChange={(e) => onChangeMeta({ body: e.target.value })}
            className="min-h-[60px] w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
            placeholder="Texto do corpo"
          />
        </Field>

        {slide.role === "cta" && (
          <Field label="CTA">
            <input
              value={slide.cta || ""}
              onChange={(e) => onChangeMeta({ cta: e.target.value })}
              className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
              placeholder="Texto do CTA"
            />
          </Field>
        )}
      </div>

      {/* Layout selector */}
      <Field label="Layout">
        <div className="grid grid-cols-3 gap-1">
          {layouts.map((layout) => (
            <button
              key={layout.id}
              type="button"
              onClick={() => onLayoutChange(layout.id)}
              className={`rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
                slide.layoutType === layout.id
                  ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                  : "border-slate-700 text-slate-400 hover:bg-slate-800"
              }`}
            >
              {layout.label}
            </button>
          ))}
        </div>
      </Field>

      {/* Templates salvos */}
      {filteredTemplates.length > 0 && (
        <Field label="Templates salvos">
          <div className="flex flex-wrap gap-1.5">
            {filteredTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSelectedTemplate(t.id);
                  onChangeMeta({ layoutType: t.name } as Partial<CarouselSlide>);
                }}
                className={`rounded-full border px-3 py-1 text-[10px] font-medium transition-colors ${
                  selectedTemplate === t.id
                    ? "border-amber-500 bg-amber-500/15 text-amber-300"
                    : "border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </Field>
      )}

      {/* Photo subject */}
      {needsPhoto && (
        <Field label="Foto (Gemini)">
          <input
            value={slide.photoUrl || ""}
            onChange={(e) => onChangeMeta({ photoUrl: e.target.value })}
            className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
            placeholder="Ex: guitarrista tocando no palco, close nas maos"
          />
        </Field>
      )}

      {/* Text layers */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Camadas de texto</span>
          <button
            type="button"
            onClick={addTextLayer}
            className="rounded-md border border-teal-600/30 bg-teal-500/10 px-2.5 py-1 text-[10px] font-semibold text-teal-400 hover:bg-teal-500/20"
          >
            + Adicionar
          </button>
        </div>

        {textLayers.map((layer, idx) => (
          <div key={layer.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400">
                Texto {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeTextLayer(layer.id)}
                className="text-[11px] text-slate-500 hover:text-red-400"
              >
                Remover
              </button>
            </div>

            <textarea
              value={layer.content}
              onChange={(e) => updateTextLayer(layer.id, { content: e.target.value })}
              className="min-h-[48px] w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
            />

            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={layer.font}
                onChange={(e) => updateTextLayer(layer.id, { font: e.target.value })}
                className="h-8 rounded-lg border border-slate-700 bg-slate-900/70 px-2 text-xs text-slate-200"
              >
                {FONT_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <select
                value={layer.weight}
                onChange={(e) => updateTextLayer(layer.id, { weight: e.target.value })}
                className="h-8 rounded-lg border border-slate-700 bg-slate-900/70 px-2 text-xs text-slate-200"
              >
                {WEIGHT_OPTIONS.map((w) => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-[36px_1fr_1fr] items-center gap-1.5">
              <div className="relative">
                <input
                  type="color"
                  value={layer.color}
                  onChange={(e) => updateTextLayer(layer.id, { color: e.target.value })}
                  className="h-9 w-9 cursor-pointer rounded-lg border border-slate-700 bg-transparent p-0.5"
                />
              </div>
              <select
                value={layer.position}
                onChange={(e) => updateTextLayer(layer.id, { position: e.target.value })}
                className="h-8 rounded-lg border border-slate-700 bg-slate-900/70 px-2 text-xs text-slate-200"
              >
                {POSITION_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <input
                type="number"
                value={layer.size}
                onChange={(e) => updateTextLayer(layer.id, { size: Number(e.target.value) })}
                className="h-8 rounded-lg border border-slate-700 bg-slate-900/70 px-2 text-xs text-slate-200"
                placeholder="px"
                min={8}
                max={200}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Logo section */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-200">Incluir logo no slide</p>
            <p className="text-[10px] text-slate-500">LA Music School</p>
          </div>
          <button
            type="button"
            onClick={() => setIncludeLogo(!includeLogo)}
            className={`h-5 w-9 rounded-full transition-colors ${
              includeLogo ? "bg-teal-500" : "bg-slate-700"
            }`}
          >
            <div
              className={`h-4 w-4 rounded-full bg-white transition-transform ${
                includeLogo ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {includeLogo && (
          <>
            {/* Variant */}
            <div className="grid grid-cols-3 gap-1.5">
              {LOGO_VARIANTS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setLogoVariant(v.value)}
                  className={`rounded-lg border px-2 py-2 text-center text-[10px] font-semibold transition-colors ${
                    logoVariant === v.value
                      ? "border-teal-500 text-teal-400"
                      : "border-slate-700 text-slate-500 hover:bg-slate-800"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {/* Position */}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Posicao</p>
              <div className="grid grid-cols-2 gap-1.5">
                {LOGO_POSITIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setLogoPosition(p.value)}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
                      logoPosition === p.value
                        ? "border-teal-500 font-semibold text-teal-400"
                        : "border-slate-700 text-slate-500 hover:bg-slate-800"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Size */}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Tamanho</p>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={40}
                  max={200}
                  value={logoSize}
                  onChange={(e) => setLogoSize(Number(e.target.value))}
                  className="flex-1 accent-teal-500"
                />
                <span className="text-xs text-slate-400">{logoSize}px</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Regenerate */}
      <button
        type="button"
        onClick={() => {
          const extras: { text_layers?: unknown[]; logo_config?: unknown; hint_template?: string } = {};
          if (textLayers.length > 0) {
            extras.text_layers = textLayers.map((l) => ({
              text: l.content, font: l.font, weight: l.weight,
              color: l.color, position: l.position, size: l.size,
            }));
          }
          if (includeLogo) {
            extras.logo_config = { include: true, variant: logoVariant, position: logoPosition, size: logoSize };
          }
          if (selectedTemplate) {
            const tmpl = filteredTemplates.find((t) => t.id === selectedTemplate);
            if (tmpl) extras.hint_template = tmpl.name;
          }
          onRegenerateSlide(Object.keys(extras).length > 0 ? extras : undefined);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-600"
      >
        <svg className="h-4 w-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M13 2v4H9M1 12v-4h4M13 6A6 6 0 0 0 2.3 4.3M1 8a6 6 0 0 0 10.7 1.7" />
        </svg>
        Regenerar este slide
      </button>

      {/* Export bar */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-200 transition-colors hover:bg-slate-800"
        >
          Baixar PNG
        </button>
        <button
          type="button"
          className="rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-600"
        >
          Publicar
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-400">{label}</label>
      {children}
    </div>
  );
}
