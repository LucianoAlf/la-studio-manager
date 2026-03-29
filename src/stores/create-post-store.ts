import { create } from "zustand";
import type { LayerComposition, AspectRatioKey } from "@/lib/types/layer-composition";
import type { StudioBrand, StudioPlatform, PhotoAsset } from "@/lib/queries/studio";

// Tons para variações de legenda
export type CaptionTone = "inspirador" | "divertido" | "profissional" | "comemorativo" | "educativo";

export interface CaptionVariation {
  tone: CaptionTone;
  phrase: string;
  caption: string;
  hashtags: string[];
}

// Filtros de imagem
export interface ImageFilters {
  brightness: number; // -50 a 50
  contrast: number;
  warmth: number;
  saturation: number;
}

export const DEFAULT_FILTERS: ImageFilters = {
  brightness: 0,
  contrast: 0,
  warmth: 0,
  saturation: 0,
};

// Estado da aba Criar
interface CreatePostState {
  // Core
  brand: StudioBrand;
  platform: StudioPlatform;
  creationMode: "nina" | "manual";

  // Brief + geração
  brief: string;
  isGenerating: boolean;
  generationMethod: string | null;

  // Composição por camadas
  composition: LayerComposition | null;
  previewUrl: string | null;

  // Legenda + hashtags
  caption: string;
  hashtags: string[];
  captionVariations: CaptionVariation[];
  selectedCaptionIndex: number;
  activeTones: CaptionTone[];

  // Foto de evento
  eventPhotos: PhotoAsset[];
  selectedEventPhoto: PhotoAsset | null;
  loadingEventPhotos: boolean;

  // Agendamento
  postDate: string;
  postTime: string;

  // Publicação
  isPublishing: boolean;
  isScheduling: boolean;

  // Filtros
  filters: ImageFilters;

  // Actions
  setBrand: (brand: StudioBrand) => void;
  setPlatform: (platform: StudioPlatform) => void;
  setCreationMode: (mode: "nina" | "manual") => void;
  setBrief: (brief: string) => void;
  setIsGenerating: (v: boolean) => void;
  setGenerationMethod: (m: string | null) => void;
  setComposition: (comp: LayerComposition | null) => void;
  setPreviewUrl: (url: string | null) => void;
  setCaption: (caption: string) => void;
  setHashtags: (tags: string[]) => void;
  setCaptionVariations: (vars: CaptionVariation[]) => void;
  setSelectedCaptionIndex: (idx: number) => void;
  setActiveTones: (tones: CaptionTone[]) => void;
  setEventPhotos: (photos: PhotoAsset[]) => void;
  setSelectedEventPhoto: (photo: PhotoAsset | null) => void;
  setLoadingEventPhotos: (v: boolean) => void;
  setPostDate: (date: string) => void;
  setPostTime: (time: string) => void;
  setIsPublishing: (v: boolean) => void;
  setIsScheduling: (v: boolean) => void;
  setFilters: (filters: ImageFilters) => void;

  // Actions complexas
  updateTextLayer: (layerId: string, updates: Partial<LayerComposition["textLayers"][0]>) => void;
  addTextLayer: () => void;
  removeTextLayer: (layerId: string) => void;
  selectCaptionVariation: (index: number) => void;
  resetForm: () => void;
}

function getBrazilNow() {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    date: `${m.year}-${m.month}-${m.day}`,
    time: `${m.hour}:00`,
  };
}

const initialNow = getBrazilNow();

export const useCreatePostStore = create<CreatePostState>((set, get) => ({
  // Core
  brand: "la_music_school",
  platform: "story",
  creationMode: "nina",

  // Brief
  brief: "",
  isGenerating: false,
  generationMethod: null,

  // Composição
  composition: null,
  previewUrl: null,

  // Legenda
  caption: "",
  hashtags: [],
  captionVariations: [],
  selectedCaptionIndex: -1,
  activeTones: ["inspirador", "divertido", "profissional"],

  // Evento
  eventPhotos: [],
  selectedEventPhoto: null,
  loadingEventPhotos: false,

  // Agendamento
  postDate: initialNow.date,
  postTime: initialNow.time,

  // Publicação
  isPublishing: false,
  isScheduling: false,

  // Filtros
  filters: { ...DEFAULT_FILTERS },

  // Setters simples
  setBrand: (brand) => set({ brand }),
  setPlatform: (platform) => set({ platform }),
  setCreationMode: (creationMode) => set({ creationMode }),
  setBrief: (brief) => set({ brief }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setGenerationMethod: (generationMethod) => set({ generationMethod }),
  setComposition: (composition) => set({ composition }),
  setPreviewUrl: (previewUrl) => set({ previewUrl }),
  setCaption: (caption) => set({ caption }),
  setHashtags: (hashtags) => set({ hashtags }),
  setCaptionVariations: (captionVariations) => set({ captionVariations }),
  setSelectedCaptionIndex: (selectedCaptionIndex) => set({ selectedCaptionIndex }),
  setActiveTones: (activeTones) => set({ activeTones }),
  setEventPhotos: (eventPhotos) => set({ eventPhotos }),
  setSelectedEventPhoto: (selectedEventPhoto) => set({ selectedEventPhoto }),
  setLoadingEventPhotos: (loadingEventPhotos) => set({ loadingEventPhotos }),
  setPostDate: (postDate) => set({ postDate }),
  setPostTime: (postTime) => set({ postTime }),
  setIsPublishing: (isPublishing) => set({ isPublishing }),
  setIsScheduling: (isScheduling) => set({ isScheduling }),
  setFilters: (filters) => set({ filters }),

  // Atualizar uma camada de texto específica
  updateTextLayer: (layerId, updates) => {
    const comp = get().composition;
    if (!comp) return;
    set({
      composition: {
        ...comp,
        textLayers: comp.textLayers.map((l) =>
          l.id === layerId ? { ...l, ...updates } : l
        ),
      },
    });
  },

  // Adicionar nova camada de texto
  addTextLayer: () => {
    const comp = get().composition;
    if (!comp) return;
    const newLayer = {
      id: `text-${Date.now()}`,
      content: "Novo texto",
      fontFamily: "Inter",
      fontSize: 0.04,
      fontWeight: 600,
      fontStyle: "normal" as const,
      color: "#FFFFFF",
      position: { x: 0.5, y: 0.5 },
      anchor: "center" as const,
      maxWidthRatio: 0.85,
      shadow: { color: "rgba(0,0,0,0.5)", blur: 4, offsetX: 0, offsetY: 1 },
    };
    set({
      composition: {
        ...comp,
        textLayers: [...comp.textLayers, newLayer],
      },
    });
  },

  // Remover camada de texto
  removeTextLayer: (layerId) => {
    const comp = get().composition;
    if (!comp) return;
    set({
      composition: {
        ...comp,
        textLayers: comp.textLayers.filter((l) => l.id !== layerId),
      },
    });
  },

  // Selecionar variação de legenda e aplicar no canvas
  selectCaptionVariation: (index) => {
    const vars = get().captionVariations;
    if (index < 0 || index >= vars.length) return;
    const v = vars[index];
    const comp = get().composition;
    set({
      selectedCaptionIndex: index,
      caption: v.caption,
      hashtags: v.hashtags,
    });
    // Atualizar o texto principal na composição
    if (comp && comp.textLayers.length > 0) {
      set({
        composition: {
          ...comp,
          textLayers: comp.textLayers.map((l, i) =>
            i === 0 ? { ...l, content: v.phrase } : l
          ),
        },
      });
    }
  },

  // Reset completo
  resetForm: () => {
    const now = getBrazilNow();
    set({
      brief: "",
      composition: null,
      previewUrl: null,
      caption: "",
      hashtags: [],
      captionVariations: [],
      selectedCaptionIndex: -1,
      selectedEventPhoto: null,
      generationMethod: null,
      filters: { ...DEFAULT_FILTERS },
      postDate: now.date,
      postTime: now.time,
    });
  },
}));
