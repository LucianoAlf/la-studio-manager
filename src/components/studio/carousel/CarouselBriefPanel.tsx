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
}: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-[22px] border border-slate-800 bg-slate-950/65 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Brief</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-100">Geração do deck</h3>
          </div>
          <button
            type="button"
            onClick={onSelectRandomPhoto}
            disabled={eventPhotos.length === 0}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-40"
          >
            Foto aleatória
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <Field label="Marca">
            <Select value={brand} onValueChange={(value) => onBrandChange(value as StudioBrand)}>
              <SelectTrigger className="h-10 border-slate-700 bg-slate-900/70 text-slate-200">
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

          <div className="grid grid-cols-2 gap-2">
            <Field label="Formato">
              <div className="flex h-10 items-center rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-300">
                Carrossel 4:5
              </div>
            </Field>
            <Field label="Tipo">
              <Select value={carouselKind} onValueChange={(value) => onCarouselKindChange(value as CarouselKind)}>
                <SelectTrigger className="h-10 border-slate-700 bg-slate-900/70 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="educational">Educacional</SelectItem>
                  <SelectItem value="photo_story">Foto-driven</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Tom">
              <Select value={tone} onValueChange={onToneChange}>
                <SelectTrigger className="h-10 border-slate-700 bg-slate-900/70 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profissional">Profissional</SelectItem>
                  <SelectItem value="inspirador">Inspirador</SelectItem>
                  <SelectItem value="divertido">Divertido</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Slides">
              <Select value={String(slideCount)} onValueChange={(value) => onSlideCountChange(Number(value))}>
                <SelectTrigger className="h-10 border-slate-700 bg-slate-900/70 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[4, 5, 6, 7, 8].map((count) => (
                    <SelectItem key={count} value={String(count)}>
                      {count} páginas
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Objetivo / briefing">
            <textarea
              value={brief}
              onChange={(event) => onBriefChange(event.target.value)}
              className="min-h-[140px] w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
              placeholder="Descreva o carrossel que a Nina deve montar..."
            />
          </Field>

          <Field label="CTA final">
            <input
              value={cta}
              onChange={(event) => onCtaChange(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
              placeholder="Ex: Agende uma aula experimental"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Data">
              <DatePicker value={postDate} onChange={onPostDateChange} placeholder="Data" className="h-10 border-slate-700 bg-slate-900/70" />
            </Field>
            <Field label="Horário">
              <TimePicker value={postTime} onChange={onPostTimeChange} minuteStep={1} className="h-10" />
            </Field>
          </div>

          <Field label="Legenda base">
            <textarea
              value={caption}
              onChange={(event) => onCaptionChange(event.target.value)}
              className="min-h-[96px] w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
              placeholder="A Nina pode preencher isso ao gerar. Aqui você ajusta a narrativa do deck."
            />
          </Field>

          <Field label="Fotos do evento">
            {loadingEventPhotos ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500">
                Carregando fotos...
              </div>
            ) : eventPhotos.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-500">
                Nenhuma foto disponível. A Nina ainda pode gerar o deck a partir do briefing.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
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
          </Field>
        </div>

        <Button
          variant="primary"
          size="md"
          className="mt-4 w-full"
          disabled={isGenerating || !brief.trim()}
          onClick={onGenerate}
        >
          {isGenerating ? "Gerando deck..." : "Gerar com Nina"}
        </Button>
      </div>
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
