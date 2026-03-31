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
  engine: "claude" | "gemini";
  onEngineChange: (engine: "claude" | "gemini") => void;
  includePhotos: boolean;
  onIncludePhotosChange: (value: boolean) => void;
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
  onRegenerateSlide: (index: number, extras?: { text_layers?: unknown[]; logo_config?: unknown; hint_template?: string }) => void;
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
  engine,
  onEngineChange,
  includePhotos,
  onIncludePhotosChange,
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
    <div
      className="grid h-full gap-4"
      style={{ gridTemplateColumns: "300px 1fr 320px" }}
    >
      {/* Col 1: Brief */}
      <div className="overflow-y-auto rounded-[22px] border border-slate-800 bg-slate-950/65 p-4">
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
          engine={engine}
          onEngineChange={onEngineChange}
          includePhotos={includePhotos}
          onIncludePhotosChange={onIncludePhotosChange}
        />
      </div>

      {/* Col 2: Deck grid */}
      <div className="overflow-y-auto rounded-[22px] border border-slate-800 bg-slate-950/65 p-4">
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
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Pronto para gerar
            </p>
            <h3 className="mt-3 text-lg font-semibold text-slate-100">
              Monte um deck inteiro, nao um slide solto
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
              Defina o briefing, escolha o tipo do carrossel e gere com a Nina. O resultado nasce com estrutura de deck, preview real e edicao por slide.
            </p>
          </div>
        )}

        {/* Publication bar at bottom of col 2 */}
        {project && (
          <div className="mt-4 rounded-[18px] border border-slate-800 bg-slate-950/55 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Publicacao</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={onSendForApproval}
                className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800"
              >
                Enviar para aprovacao
              </button>
              <button
                type="button"
                onClick={onPublishNow}
                disabled={isPublishing}
                className="rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-600 disabled:opacity-40"
              >
                {isPublishing ? "Publicando..." : "Publicar agora"}
              </button>
              <button
                type="button"
                onClick={onSchedule}
                disabled={isScheduling}
                className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-500 disabled:opacity-40"
              >
                {isScheduling ? "Agendando..." : `Agendar ${postDate} ${postTime}`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Col 3: Slide editor */}
      <div className="space-y-4 overflow-y-auto rounded-[22px] border border-slate-800 bg-slate-950/65 p-4">
        {project && activeSlide ? (
          <>
            <CarouselBrandingPanel
              project={project}
              onThemeChange={onThemeChange}
              onResetBranding={onApplyBrandingToAll}
            />
            <CarouselSlideEditor
              project={project}
              slide={activeSlide}
              brandIdentity={brandIdentity}
              eventPhotos={eventPhotos}
              onChangeMeta={(updates) => handleChangeSlideMeta(activeSlide, updates)}
              onLayoutChange={onLayoutChange}
              onSetCoverSlide={() => onSetCoverSlide(activeSlideIndex)}
              onRegenerateSlide={(extras) => onRegenerateSlide(activeSlideIndex, extras)}
              isCoverSlide={project.coverSlideIndex === activeSlideIndex}
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Editor</p>
            <p className="mt-2 text-sm text-slate-400">
              Selecione um slide para editar conteúdo, template e foto.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
