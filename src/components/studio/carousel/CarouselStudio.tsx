"use client";

import type { BrandIdentity } from "@/types/brand";
import type { PhotoAsset, StudioBrand } from "@/lib/queries/studio";
import type { CarouselKind, CarouselProject, CarouselSlide, CarouselTheme } from "@/lib/carousel/types";
import { CarouselBriefPanel } from "./CarouselBriefPanel";
import { CarouselBrandingPanel } from "./CarouselBrandingPanel";
import { CarouselDeckPanel } from "./CarouselDeckPanel";
import { CarouselSlideEditor } from "./CarouselSlideEditor";

interface Props {
  brand: StudioBrand;
  onBrandChange: (brand: StudioBrand) => void;
  brandIdentity?: BrandIdentity | null;
  brief: string;
  onBriefChange: (value: string) => void;
  caption: string;
  onCaptionChange: (value: string) => void;
  carouselKind: CarouselKind;
  onCarouselKindChange: (kind: CarouselKind) => void;
  tone: string;
  onToneChange: (value: string) => void;
  slideCount: number;
  onSlideCountChange: (value: number) => void;
  cta: string;
  onCtaChange: (value: string) => void;
  eventPhotos: PhotoAsset[];
  selectedEventPhoto: PhotoAsset | null;
  onSelectEventPhoto: (photo: PhotoAsset | null) => void;
  onSelectRandomPhoto: () => void;
  loadingEventPhotos: boolean;
  postDate: string;
  onPostDateChange: (value: string) => void;
  postTime: string;
  onPostTimeChange: (value: string) => void;
  project: CarouselProject | null;
  activeSlideIndex: number;
  onActiveSlideIndexChange: (index: number) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  generatingSlideIndex?: number | null;
  onProjectChange: (project: CarouselProject | null) => void;
  onThemeChange: (themePatch: Partial<CarouselTheme>) => void;
  onApplyBrandingToAll: () => void;
  onRegenerateDeck: () => void;
  onDuplicatePreviousStyle: () => void;
  onLayoutChange: (layoutType: string) => void;
  onAddSlide: () => void;
  onRemoveSlide: (index: number) => void;
  onDuplicateSlide: (index: number) => void;
  onMoveSlide: (index: number, direction: -1 | 1) => void;
  onSetCoverSlide: (index: number) => void;
  onRegenerateSlide: (index: number) => void;
  onExportDeck: () => void;
  onSendForApproval: () => void;
  onPublishNow: () => void;
  onSchedule: () => void;
  isPublishing: boolean;
  isScheduling: boolean;
}

export function CarouselStudio({
  brand,
  onBrandChange,
  brandIdentity,
  brief,
  onBriefChange,
  caption,
  onCaptionChange,
  carouselKind,
  onCarouselKindChange,
  tone,
  onToneChange,
  slideCount,
  onSlideCountChange,
  cta,
  onCtaChange,
  eventPhotos,
  selectedEventPhoto,
  onSelectEventPhoto,
  onSelectRandomPhoto,
  loadingEventPhotos,
  postDate,
  onPostDateChange,
  postTime,
  onPostTimeChange,
  project,
  activeSlideIndex,
  onActiveSlideIndexChange,
  onGenerate,
  isGenerating,
  generatingSlideIndex,
  onProjectChange,
  onThemeChange,
  onApplyBrandingToAll,
  onRegenerateDeck,
  onDuplicatePreviousStyle,
  onLayoutChange,
  onAddSlide,
  onRemoveSlide,
  onDuplicateSlide,
  onMoveSlide,
  onSetCoverSlide,
  onRegenerateSlide,
  onExportDeck,
  onSendForApproval,
  onPublishNow,
  onSchedule,
  isPublishing,
  isScheduling,
}: Props) {
  const activeSlide = project?.slides[activeSlideIndex] || null;

  const handleChangeSlideMeta = (slide: CarouselSlide, updates: Partial<CarouselSlide>) => {
    if (!project) return;
    onProjectChange({
      ...project,
      updatedAt: new Date().toISOString(),
      slides: project.slides.map((item) => (item.id === slide.id ? { ...item, ...updates } : item)),
    });
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-4">
        <CarouselBriefPanel
          brand={brand}
          onBrandChange={onBrandChange}
          brief={brief}
          onBriefChange={onBriefChange}
          caption={caption}
          onCaptionChange={onCaptionChange}
          carouselKind={carouselKind}
          onCarouselKindChange={onCarouselKindChange}
          tone={tone}
          onToneChange={onToneChange}
          slideCount={slideCount}
          onSlideCountChange={onSlideCountChange}
          cta={cta}
          onCtaChange={onCtaChange}
          eventPhotos={eventPhotos}
          selectedEventPhoto={selectedEventPhoto}
          onSelectEventPhoto={onSelectEventPhoto}
          onSelectRandomPhoto={onSelectRandomPhoto}
          loadingEventPhotos={loadingEventPhotos}
          postDate={postDate}
          onPostDateChange={onPostDateChange}
          postTime={postTime}
          onPostTimeChange={onPostTimeChange}
          isGenerating={isGenerating}
          onGenerate={onGenerate}
        />

        {project ? (
          <CarouselBrandingPanel
            project={project}
            onThemeChange={onThemeChange}
            onResetBranding={onApplyBrandingToAll}
          />
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="overflow-hidden rounded-[26px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-300/80">Studio Carousel</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {project?.title || "Deck com narrativa, branding e edição por slide"}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-300">
                {project
                  ? `${project.slides.length} páginas em ${project.kind === "educational" ? "modo educacional" : "modo foto-driven"} com preview real, capa definida e identidade aplicada ao deck inteiro.`
                  : "Gere um carrossel inteiro com a Nina e refine o resultado no mesmo fluxo, sem cair no editor de post único."}
              </p>
            </div>
            {project ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Estrutura ativa</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">
                  Slide {activeSlideIndex + 1} de {project.slideCount}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Capa no slide {project.coverSlideIndex + 1}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {project ? (
          <CarouselDeckPanel
            project={project}
            activeSlideIndex={activeSlideIndex}
            generatingSlideIndex={generatingSlideIndex}
            onSelectSlide={onActiveSlideIndexChange}
            onAddSlide={onAddSlide}
            onRemoveSlide={onRemoveSlide}
            onDuplicateSlide={onDuplicateSlide}
            onMoveSlide={onMoveSlide}
            onApplyBrandingToAll={onApplyBrandingToAll}
            onRegenerateDeck={onRegenerateDeck}
            onSetCoverSlide={onSetCoverSlide}
            onRegenerateSlide={onRegenerateSlide}
            onExportDeck={onExportDeck}
          />
        ) : (
          <div className="rounded-[22px] border border-slate-800 bg-slate-950/55 p-4 text-sm text-slate-400">
            O outline e as miniaturas reais aparecem aqui depois da geração.
          </div>
        )}

        {!project || !activeSlide ? (
          <div className="rounded-[26px] border border-dashed border-slate-700 bg-slate-950/40 p-10 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Pronto para gerar</p>
            <h3 className="mt-3 text-lg font-semibold text-slate-100">Monte um deck inteiro, não um slide solto</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
              Defina o briefing, escolha o tipo do carrossel e gere com a Nina. O resultado nasce com estrutura de deck, preview real e edição por slide.
            </p>
          </div>
        ) : (
          <CarouselSlideEditor
            project={project}
            slide={activeSlide}
            brandIdentity={brandIdentity}
            onChangeComposition={(composition) => {
              onProjectChange({
                ...project,
                updatedAt: new Date().toISOString(),
                slides: project.slides.map((item) => (
                  item.id === activeSlide.id
                    ? {
                        ...item,
                        composition,
                        headline: composition.textLayers[0]?.content || item.headline,
                        body: composition.textLayers[1]?.content || item.body,
                        cta: composition.textLayers[2]?.content || item.cta,
                      }
                    : item
                )),
              });
            }}
            onChangeMeta={(updates) => handleChangeSlideMeta(activeSlide, updates)}
            onLayoutChange={onLayoutChange}
            onDuplicatePreviousStyle={onDuplicatePreviousStyle}
            onSetCoverSlide={() => onSetCoverSlide(activeSlideIndex)}
            onRegenerateSlide={() => onRegenerateSlide(activeSlideIndex)}
            isCoverSlide={project.coverSlideIndex === activeSlideIndex}
          />
        )}

        <div className="rounded-[22px] border border-slate-800 bg-slate-950/65 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Publicação</p>
          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <button
              type="button"
              onClick={onSendForApproval}
              disabled={!project}
              className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Enviar para aprovação
            </button>
            <button
              type="button"
              onClick={onPublishNow}
              disabled={!project || isPublishing}
              className="rounded-xl bg-amber-700 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPublishing ? "Publicando..." : "Publicar agora"}
            </button>
            <button
              type="button"
              onClick={onSchedule}
              disabled={!project || isScheduling}
              className="rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isScheduling ? "Agendando..." : `Agendar ${postDate} ${postTime}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
