"use client";

import type { PhotoAsset, StudioBrand } from "@/lib/queries/studio";
import type { CarouselKind } from "@/lib/carousel/types";
import { Button } from "@/components/ui";
import { DatePicker, TimePicker } from "@/components/ui/date-time-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/shadcn/select";
import { cn } from "@/lib/utils";

const BRAND_OPTIONS: Array<{ value: StudioBrand; label: string }> = [
  { value: "la_music_school", label: "LA Music School" },
  { value: "la_music_kids", label: "LA Music Kids" },
];

const SLIDE_COUNT_OPTIONS = [4, 6, 8, 10, 12];

interface Props {
  brand: StudioBrand;
  onBrandChange: (brand: StudioBrand) => void;
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
  isGenerating: boolean;
  onGenerate: () => void;
  engine: "claude" | "gemini";
  onEngineChange: (engine: "claude" | "gemini") => void;
  includePhotos: boolean;
  onIncludePhotosChange: (value: boolean) => void;
}

export function CarouselBriefPanel({
  brand,
  onBrandChange,
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
  isGenerating,
  onGenerate,
  engine,
  onEngineChange,
  includePhotos,
  onIncludePhotosChange,
}: Props) {

  return (
    <div className="space-y-3 overflow-y-auto">
      {/* Briefing section */}
      <div className="rounded-[18px] border border-slate-800 bg-slate-950/65 p-4">
        <div className="flex items-center gap-2 text-slate-500">
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 3h10M1 6h7M1 9h5" />
          </svg>
          <span className="text-[11px] font-semibold uppercase tracking-[0.24em]">Briefing</span>
        </div>

        <div className="mt-3 space-y-3">
          <Field label="Marca">
            <Select value={brand} onValueChange={(value) => onBrandChange(value as StudioBrand)}>
              <SelectTrigger className="h-9 border-slate-700 bg-slate-900/70 text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAND_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Tema / assunto">
            <textarea
              value={brief}
              onChange={(event) => onBriefChange(event.target.value)}
              className="min-h-[100px] w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
              placeholder="Descreva o carrossel que a Nina deve montar..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Tipo">
              <Select value={carouselKind} onValueChange={(value) => onCarouselKindChange(value as CarouselKind)}>
                <SelectTrigger className="h-9 border-slate-700 bg-slate-900/70 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="educational">Educacional</SelectItem>
                  <SelectItem value="photo_story">Foto-driven</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tom">
              <Select value={tone} onValueChange={onToneChange}>
                <SelectTrigger className="h-9 border-slate-700 bg-slate-900/70 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profissional">Profissional</SelectItem>
                  <SelectItem value="inspirador">Inspirador</SelectItem>
                  <SelectItem value="divertido">Divertido</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="CTA final">
            <input
              value={cta}
              onChange={(event) => onCtaChange(event.target.value)}
              className="h-9 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
              placeholder="Ex: Agende uma aula experimental"
            />
          </Field>
        </div>
      </div>

      {/* Slide count pills */}
      <div className="rounded-[18px] border border-slate-800 bg-slate-950/65 p-4">
        <div className="flex items-center gap-2 text-slate-500">
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="4" height="4" rx="0.5" />
            <rect x="7" y="1" width="4" height="4" rx="0.5" />
            <rect x="1" y="7" width="4" height="4" rx="0.5" />
            <rect x="7" y="7" width="4" height="4" rx="0.5" />
          </svg>
          <span className="text-[11px] font-semibold uppercase tracking-[0.24em]">Slides</span>
        </div>

        <div className="mt-3">
          <Field label="Quantidade">
            <div className="flex gap-1.5">
              {SLIDE_COUNT_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => onSlideCountChange(count)}
                  className={cn(
                    "flex-1 rounded-lg border py-1.5 text-sm font-semibold transition-colors",
                    slideCount === count
                      ? "border-cyan-500 bg-cyan-500/15 text-cyan-300"
                      : "border-slate-700 text-slate-400 hover:bg-slate-800"
                  )}
                >
                  {count}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>

      {/* Engine selector */}
      <div className="rounded-[18px] border border-slate-800 bg-slate-950/65 p-4">
        <div className="flex items-center gap-2 text-slate-500">
          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="6" cy="6" r="4" />
            <path d="M6 4v2l1.5 1.5" />
          </svg>
          <span className="text-[11px] font-semibold uppercase tracking-[0.24em]">Motor de geracao</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onEngineChange("claude")}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left transition-colors",
              engine === "claude"
                ? "border-cyan-500 bg-cyan-500/10"
                : "border-slate-700 hover:bg-slate-800"
            )}
          >
            <p className={cn("text-sm font-semibold", engine === "claude" ? "text-cyan-300" : "text-slate-300")}>
              Claude
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">Templates editoriais e hierarquia tipográfica</p>
          </button>
          <button
            type="button"
            onClick={() => onEngineChange("gemini")}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left transition-colors",
              engine === "gemini"
                ? "border-cyan-500 bg-cyan-500/10"
                : "border-slate-700 hover:bg-slate-800"
            )}
          >
            <p className={cn("text-sm font-semibold", engine === "gemini" ? "text-cyan-300" : "text-slate-300")}>
              Gemini
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">Geração de foto de apoio por slide</p>
          </button>
        </div>

        {/* Photo toggle */}
        <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/40 px-3 py-2.5">
          <div>
            <p className="text-xs font-medium text-slate-200">Incluir fotos (Gemini)</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Usa assets do banco ou prompts de foto nos slides compatíveis</p>
          </div>
          <button
            type="button"
            onClick={() => onIncludePhotosChange(!includePhotos)}
            className={cn(
              "h-5 w-9 rounded-full transition-colors",
              includePhotos ? "bg-teal-500" : "bg-slate-700"
            )}
          >
            <div
              className={cn(
                "h-4 w-4 rounded-full bg-white transition-transform",
                includePhotos ? "translate-x-4" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </div>

      {/* Date/time + caption */}
      <div className="rounded-[18px] border border-slate-800 bg-slate-950/65 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Data">
            <DatePicker value={postDate} onChange={onPostDateChange} placeholder="Data" className="h-9 border-slate-700 bg-slate-900/70" />
          </Field>
          <Field label="Horario">
            <TimePicker value={postTime} onChange={onPostTimeChange} minuteStep={1} className="h-9" />
          </Field>
        </div>

        <Field label="Legenda base">
          <textarea
            value={caption}
            onChange={(event) => onCaptionChange(event.target.value)}
            className="min-h-[72px] w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
            placeholder="A Nina pode preencher isso ao gerar."
          />
        </Field>
      </div>

      {/* Event photos */}
      {(loadingEventPhotos || eventPhotos.length > 0) && (
        <div className="rounded-[18px] border border-slate-800 bg-slate-950/65 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Fotos do evento</span>
            <button
              type="button"
              onClick={onSelectRandomPhoto}
              disabled={eventPhotos.length === 0}
              className="rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              Foto aleatoria
            </button>
          </div>
          {loadingEventPhotos ? (
            <div className="mt-2 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500">
              Carregando fotos...
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {eventPhotos.slice(0, 9).map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onSelectEventPhoto(photo)}
                  className={cn(
                    "relative aspect-[4/5] overflow-hidden rounded-xl border transition-all",
                    selectedEventPhoto?.id === photo.id
                      ? "border-cyan-500 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                      : "border-slate-800 hover:border-slate-600"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.file_url} alt={photo.event_name || ""} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Generate button */}
      <Button
        variant="primary"
        size="md"
        className="w-full"
        disabled={isGenerating || !brief.trim()}
        onClick={onGenerate}
      >
        {isGenerating ? "Gerando deck..." : "Gerar com Nina"}
      </Button>
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
