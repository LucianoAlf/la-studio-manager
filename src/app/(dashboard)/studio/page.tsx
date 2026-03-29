"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/layout/header";
import { Badge, Button, Card } from "@/components/ui";
import {
  CalendarDots,
  Sparkle,
  Images,
  VideoCamera,
  Lightning,
  ChartBar,
  Link,
  Bell,
  CaretLeft,
  CaretRight,
  CaretDown,
  Clock,
  Upload,
  Warning,
  CheckCircle,
  X,
  Plus,
  SpinnerGap,
  Folder,
  Trash,
  Camera,
  MusicNote,
  Confetti,
  Baby,
  Robot,
  User,
  Pencil,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import {
  getBirthdaysOverview,
  getCommemorativeDates,
  getIntegrations,
  getNinaConfig,
  getPendingApprovalsCount,
  getPerformanceSummaryByBrand,
  getPhotoAssets,
  getGroupedEvents,
  getEventPhotos,
  deleteEvent,
  getStudioVideosByBrand,
  getStudioVideoPollingById,
  getStudioClipPollingById,
  getStudioClipsByVideoId,
  getStudioPostsByBrand,
  generateBirthdayPost,
  publishBirthdayStory,
  addCommemorativeDate,
  updateCommemorativeDate,
  deleteCommemorativeDate,
  type AssetFilterType,
  type CommemorativeDateItem,
  type GroupedEvent,
  type IntegrationCredentialItem,
  type StudioClipItem,
  type StudioClipStatus,
  type NinaConfig,
  type PhotoAsset,
  type StudioBrand,
  type StudioPlatform,
  type StudioPost,
  type StudioVideoItem,
  type StudioVideoPollingItem,
  type StudioVideoStatus,
} from "@/lib/queries/studio";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";
import { createClient } from "@/lib/supabase/client";
import * as tus from "tus-js-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DatePicker, TimePicker } from "@/components/ui/date-time-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/shadcn/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";
import { Switch } from "@/components/ui/switch";

type StudioTab = "calendario" | "criar" | "banco" | "video" | "automacoes" | "performance" | "conexoes";
type AutomationTab = "aniversarios" | "datas";

type PostStatus = StudioPost["status"];
type VideoUploadStage = "idle" | "validating" | "uploading" | "processing";
type NinaGenerationResponse = {
  image_url?: string | null;
  caption?: string | null;
  hashtags?: string[] | string | null;
  generation_method?: string | null;
  main_phrase?: string | null;
  needs_text_overlay?: boolean;
  text_config?: {
    phrase: string;
    brand_name: string;
    is_kids: boolean;
    accent_color: string;
  };
};

// Submagic templates disponíveis para Magic Clips
const SUBMAGIC_TEMPLATES = [
  'Sara', 'Matt', 'Jess', 'Jack', 'Nick', 'Laura', 'Kelly 2', 'Caleb', 'Kendrick',
  'Lewis', 'Doug', 'Carlos', 'Luke', 'Leila', 'Mark', 'Daniel', 'Dan 2', 'Hormozi 4',
  'Dan', 'Devin', 'Tayo', 'Ella', 'Tracy', 'Hormozi 1', 'Hormozi 2', 'Hormozi 3',
  'Hormozi 5', 'Jason', 'William', 'Leon', 'Ali', 'Beast', 'Maya', 'Karl', 'Iman',
  'Umi', 'David', 'Noah', 'Gstaad', 'Malta', 'Nema', 'seth'
] as const;

const CONTENT_PRESETS = {
  workshop: {
    label: '🎓 Workshop',
    templateName: 'Hormozi 2',
    minClipLength: 30,
    maxClipLength: 90,
    faceTracking: true,
    disableCaptions: false,
    maxClips: 8,
  },
  aula: {
    label: '👨‍🏫 Aula',
    templateName: 'Karl',
    minClipLength: 20,
    maxClipLength: 60,
    faceTracking: true,
    disableCaptions: false,
    maxClips: 6,
  },
  entrevista: {
    label: '🎙️ Entrevista',
    templateName: 'Sara',
    minClipLength: 25,
    maxClipLength: 75,
    faceTracking: true,
    disableCaptions: false,
    maxClips: 8,
  },
  show: {
    label: '🎵 Show',
    templateName: 'Beast',
    minClipLength: 15,
    maxClipLength: 45,
    faceTracking: true,  // Sempre true para enquadrar 9:16 corretamente
    disableCaptions: true,
    maxClips: 5,
  },
  custom: {
    label: '⚙️ Custom',
    templateName: 'Hormozi 2',
    minClipLength: 15,
    maxClipLength: 60,
    faceTracking: true,
    disableCaptions: false,
    maxClips: 10,
  },
} as const;

type ContentPresetKey = keyof typeof CONTENT_PRESETS;

type SubmagicConfig = {
  // Fase 1: Magic Clips
  templateName: string;
  minClipLength: number;
  maxClipLength: number;
  faceTracking: boolean;
  disableCaptions: boolean;
  maxClips: number;
  // Fase 2: Pós-processamento
  cleanAudio: boolean;
  removeSilencePace: 'natural' | 'fast' | 'extra-fast' | null;
  removeBadTakes: boolean;
  magicZooms: boolean;
  magicBrolls: boolean;
  magicBrollsPercentage: number;
};

type PublishScheduledPostsResponse = {
  success?: boolean;
  published?: number;
  failed?: number;
  message?: string;
  error?: string;
  results?: Array<{
    error?: unknown;
  }>;
};

function tryParseJson(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function extractNestedErrorMessage(value: unknown, depth = 0): string | null {
  if (value == null || depth > 4) return null;

  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const parsed = tryParseJson(trimmed);
    if (parsed !== null) {
      const nestedMessage = extractNestedErrorMessage(parsed, depth + 1);
      if (nestedMessage) return nestedMessage;
    }

    return trimmed;
  }

  if (typeof value !== "object") {
    return String(value);
  }

  const record = value as Record<string, unknown>;
  const nestedError = extractNestedErrorMessage(record.error, depth + 1);
  const directMessage = extractNestedErrorMessage(record.message, depth + 1);
  const detailMessage = extractNestedErrorMessage(record.details, depth + 1);
  const errorDescription = extractNestedErrorMessage(record.error_description, depth + 1);
  const type =
    typeof record.type === "string"
      ? record.type
      : typeof record.error === "object" && record.error && typeof (record.error as Record<string, unknown>).type === "string"
        ? String((record.error as Record<string, unknown>).type)
        : null;

  const message = nestedError ?? directMessage ?? detailMessage ?? errorDescription;
  if (message && type && !message.includes(type)) {
    return `${type}: ${message}`;
  }

  return message;
}

function isExpiredMetaSessionMessage(message: string) {
  return /OAuthException/i.test(message) && /Session has expired/i.test(message);
}

function formatMetaSessionExpiredMessage(message: string) {
  const expiresAt = message.match(/Session has expired on ([^.]+)\./i)?.[1];
  if (expiresAt) {
    return `Sessao da Meta expirada em ${expiresAt}. Reconecte o Instagram da marca antes de publicar.`;
  }

  return "Sessao da Meta expirada. Reconecte o Instagram da marca antes de publicar.";
}

function getPublishErrorMessage(
  fnError: unknown,
  data?: PublishScheduledPostsResponse,
) {
  const rawError = data?.results?.[0]?.error ?? data?.error ?? data?.message ?? fnError;
  const message = extractNestedErrorMessage(rawError);
  if (!message) return null;

  if (isExpiredMetaSessionMessage(message)) {
    return formatMetaSessionExpiredMessage(message);
  }

  return message;
}

function getIntegrationExpiryDate(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;

  const candidates = [
    metadata.expires_at,
    metadata.token_expires_at,
    metadata.tokenExpiresAt,
    metadata.expiresAt,
    metadata.expiration_date,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function getIntegrationErrorMessage(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;

  const candidates = [
    metadata.error,
    metadata.error_message,
    metadata.last_error,
    metadata.validation_error,
  ];

  for (const candidate of candidates) {
    const message = extractNestedErrorMessage(candidate);
    if (message) return message;
  }

  return null;
}

function getIntegrationStatus(item: IntegrationCredentialItem) {
  if (!item.is_active) {
    return {
      color: "#F97316",
      label: "Inativo",
      detail: "Integracao desativada.",
    };
  }

  const metadata = item.metadata ?? null;
  const expiresAt = getIntegrationExpiryDate(metadata);
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return {
      color: "#EF4444",
      label: "Expirado",
      detail: `Token expirado em ${expiresAt.toLocaleDateString("pt-BR")}.`,
    };
  }

  const integrationError = getIntegrationErrorMessage(metadata);
  if (integrationError && isExpiredMetaSessionMessage(integrationError)) {
    return {
      color: "#EF4444",
      label: "Expirado",
      detail: formatMetaSessionExpiredMessage(integrationError),
    };
  }

  if (!item.last_validated_at) {
    return {
      color: "#EF4444",
      label: "Sem validacao",
      detail: "Sem validacao recente.",
    };
  }

  const days = (Date.now() - new Date(item.last_validated_at).getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 30) {
    return {
      color: "#22C55E",
      label: "Ativo",
      detail: `Validado em ${new Date(item.last_validated_at).toLocaleDateString("pt-BR")}.`,
    };
  }

  if (days <= 60) {
    return {
      color: "#F97316",
      label: "Atencao",
      detail: `Validado em ${new Date(item.last_validated_at).toLocaleDateString("pt-BR")}.`,
    };
  }

  return {
    color: "#EF4444",
    label: "Validacao antiga",
    detail: `Ultima validacao em ${new Date(item.last_validated_at).toLocaleDateString("pt-BR")}.`,
  };
}

// Função para criar arte completa usando Canvas API (foto + gradiente + texto)
// Instagram safe zones: Feed 1080x1080, Stories 1080x1920 (com 250px top/bottom safe)
async function createArtWithCanvas(
  imageUrl: string,
  phrase: string,
  brandName: string,
  isKids: boolean,
  format: "feed" | "story" = "feed"
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      // Dimensões por formato
      const W = 1080;
      const H = format === "story" ? 1920 : 1080;
      canvas.width = W;
      canvas.height = H;

      // Margens seguras (Instagram safe zone)
      const MARGIN_X = 80; // 80px de cada lado
      const SAFE_BOTTOM = format === "story" ? 280 : 100; // Stories precisam de mais espaço embaixo

      // Desenha a imagem base (cover)
      const imgRatio = img.width / img.height;
      const canvasRatio = W / H;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;

      if (imgRatio > canvasRatio) {
        sw = img.height * canvasRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / canvasRatio;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);

      // Gradiente escuro na base
      const gradientStart = format === "story" ? H * 0.5 : H * 0.55;
      const gradient = ctx.createLinearGradient(0, gradientStart, 0, H);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      gradient.addColorStop(0.25, "rgba(0, 0, 0, 0.45)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.88)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Quebrar frase em linhas respeitando margens
      const maxTextWidth = W - (MARGIN_X * 2) - 40; // 40px extra de segurança
      const fontSize = Math.round(W * 0.055); // Reduzido de 0.065 para 0.055
      ctx.font = `bold ${fontSize}px Arial, sans-serif`;

      const words = phrase.split(" ");
      const lines: string[] = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxTextWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      // Configuração do texto principal
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Calcular posição Y para texto ficar na safe zone
      const lineHeight = fontSize * 1.35;
      const totalTextHeight = lines.length * lineHeight;
      const barHeight = 60;
      const textAreaBottom = H - SAFE_BOTTOM - barHeight - 20;
      const textStartY = textAreaBottom - totalTextHeight + lineHeight / 2;

      // Renderiza cada linha com sombra e stroke
      lines.forEach((line, index) => {
        const y = textStartY + index * lineHeight;
        const x = W / 2;

        // Sombra
        ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
        ctx.shadowBlur = 25;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        // Stroke preto (contorno)
        ctx.strokeStyle = "black";
        ctx.lineWidth = 10;
        ctx.lineJoin = "round";
        ctx.strokeText(line, x, y);

        // Fill branco
        ctx.fillStyle = "white";
        ctx.fillText(line, x, y);
      });

      // Reseta sombra
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Barra da marca no fundo (dentro da safe zone)
      const barY = H - SAFE_BOTTOM - barHeight;
      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.fillRect(MARGIN_X, barY, W - MARGIN_X * 2, barHeight);

      // Texto da marca
      const brandFontSize = Math.round(W * 0.028);
      ctx.font = `bold ${brandFontSize}px Arial, sans-serif`;
      ctx.fillStyle = "white";
      ctx.fillText(brandName.toUpperCase(), W / 2, barY + barHeight / 2);

      // SEM linha de acento - removida completamente

      // Converte para blob
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create blob"));
        },
        "image/jpeg",
        0.92
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = imageUrl;
  });
}

const TABS: { id: StudioTab; label: string; icon: Icon }[] = [
  { id: "calendario", label: "Calendário", icon: CalendarDots },
  { id: "criar", label: "Criar", icon: Sparkle },
  { id: "banco", label: "Banco de Fotos", icon: Images },
  { id: "video", label: "Vídeo", icon: VideoCamera },
  { id: "automacoes", label: "Automações", icon: Lightning },
  { id: "performance", label: "Performance", icon: ChartBar },
  { id: "conexoes", label: "Conexões", icon: Link },
];

const STATUS_COLORS: Record<PostStatus, string> = {
  draft: "#94A3B8",
  awaiting_approval: "#F97316",
  approved: "#38BDF8",
  scheduled: "#0EA5E9",
  published: "#22C55E",
  failed: "#EF4444",
  rejected: "#EF4444",
};

const STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Rascunho",
  awaiting_approval: "Aguardando",
  approved: "Aprovado",
  scheduled: "Agendado",
  published: "Publicado",
  failed: "Falhou",
  rejected: "Rejeitado",
};

const VIDEO_STATUS_COLORS: Record<StudioVideoStatus, string> = {
  uploaded: "#94A3B8",
  transcribing: "#F59E0B",
  transcribed: "#38BDF8",
  analyzing: "#F59E0B",
  ready: "#22C55E",
  failed: "#EF4444",
};

const VIDEO_STATUS_LABELS: Record<StudioVideoStatus, string> = {
  uploaded: "Uploaded",
  transcribing: "Transcribing",
  transcribed: "Transcribed",
  analyzing: "Analyzing",
  ready: "Ready",
  failed: "Failed",
};

const CLIP_STATUS_COLORS: Record<StudioClipStatus, string> = {
  pending: "#94A3B8",
  rendering: "#F59E0B",
  ready: "#38BDF8",
  approved: "#22C55E",
  published: "#14B8A6",
  failed: "#EF4444",
};

const CLIP_STATUS_LABELS: Record<StudioClipStatus, string> = {
  pending: "Pending",
  rendering: "Rendering",
  ready: "Ready",
  approved: "Approved",
  published: "Published",
  failed: "Failed",
};

const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/mov"];
const MAX_VIDEO_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const POLL_INTERVALS = [3000, 3000, 3000, 5000, 5000, 8000, 8000] as const;
const TRANSITIONAL_STATUSES: StudioVideoStatus[] = ["transcribing", "transcribed", "analyzing"];
const TRANSITIONAL_CLIP_STATUSES: StudioClipStatus[] = ["rendering"];
const MAX_PROCESS_VIDEO_BYTES = 500 * 1024 * 1024;

const BRAND_OPTIONS: { value: StudioBrand; label: string }[] = [
  { value: "la_music_school", label: "LA Music School" },
  { value: "la_music_kids", label: "LA Music Kids" },
];

const PLATFORM_OPTIONS: { value: StudioPlatform; label: string }[] = [
  { value: "story", label: "Story" },
  { value: "feed", label: "Feed" },
  { value: "reels", label: "Reels" },
  { value: "carousel", label: "Carrossel" },
];

function toIsoDate(input: Date) {
  return `${input.getFullYear()}-${String(input.getMonth() + 1).padStart(2, "0")}-${String(input.getDate()).padStart(2, "0")}`;
}

function getBrazilNowDateAndHour() {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = map.year ?? "2000";
  const month = map.month ?? "01";
  const day = map.day ?? "01";
  const hour = map.hour ?? "00";

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:00`,
  };
}

export default function StudioPage() {
  const brazilNow = useMemo(() => getBrazilNowDateAndHour(), []);

  const [activeTab, setActiveTab] = useState<StudioTab>("calendario");
  const [automationTab, setAutomationTab] = useState<AutomationTab>("aniversarios");
  const [brand, setBrand] = useState<StudioBrand>("la_music_school");
  const [calendarDate, setCalendarDate] = useState(() => new Date());

  const [ninaConfig, setNinaConfig] = useState<NinaConfig | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [posts, setPosts] = useState<StudioPost[]>([]);
  const [videos, setVideos] = useState<StudioVideoItem[]>([]);
  const [clipsByVideo, setClipsByVideo] = useState<Record<string, StudioClipItem[]>>({});
  const [expandedVideoIds, setExpandedVideoIds] = useState<Record<string, boolean>>({});
  const [loadingClipsByVideo, setLoadingClipsByVideo] = useState<Record<string, boolean>>({});
  const [videoUploadTitle, setVideoUploadTitle] = useState("");
  const [videoUploadBrand, setVideoUploadBrand] = useState<StudioBrand>("la_music_school");
  const [videoUploadEventName, setVideoUploadEventName] = useState("");
  const [videoUploadFile, setVideoUploadFile] = useState<File | null>(null);
  const [videoUploadYouTubeUrl, setVideoUploadYouTubeUrl] = useState("");
  const [videoUploadDragOver, setVideoUploadDragOver] = useState(false);
  const [videoUploadStage, setVideoUploadStage] = useState<VideoUploadStage>("idle");
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoPollingMessages, setVideoPollingMessages] = useState<Record<string, string>>({});
  const [videoPollingBusyIds, setVideoPollingBusyIds] = useState<Record<string, boolean>>({});
  const [clipPollingBusyIds, setClipPollingBusyIds] = useState<Record<string, boolean>>({});
  const [clipRenderInvokingIds, setClipRenderInvokingIds] = useState<Record<string, boolean>>({});
  const [clipModeratingIds, setClipModeratingIds] = useState<Record<string, boolean>>({});
  const [clipPublishingIds, setClipPublishingIds] = useState<Record<string, boolean>>({});

  // Submagic config (Fase 1 + 2)
  const [selectedPreset, setSelectedPreset] = useState<ContentPresetKey>('workshop');
  const [submagicConfig, setSubmagicConfig] = useState<SubmagicConfig>({
    // Fase 1: Magic Clips
    templateName: 'Hormozi 2',
    minClipLength: 30,
    maxClipLength: 90,
    faceTracking: true,
    disableCaptions: false,
    maxClips: 8,
    // Fase 2: Pós-processamento
    cleanAudio: false,
    removeSilencePace: null,
    removeBadTakes: false,
    magicZooms: false,
    magicBrolls: false,
    magicBrollsPercentage: 50,
  });
  const [showSubmagicConfig, setShowSubmagicConfig] = useState(false);

  // Modal "Publicar vídeo direto"
  const [showPublishVideoModal, setShowPublishVideoModal] = useState(false);
  const [selectedVideoForPublish, setSelectedVideoForPublish] = useState<StudioVideoItem | null>(null);
  const [publishVideoCaption, setPublishVideoCaption] = useState("");
  const [publishVideoBrand, setPublishVideoBrand] = useState<StudioBrand>("la_music_school");
  const [publishVideoFormat, setPublishVideoFormat] = useState<"reels" | "story">("reels");
  const [isPublishingVideo, setIsPublishingVideo] = useState(false);

  // Modal de preview de clipe
  const [previewClip, setPreviewClip] = useState<{ url: string; title: string } | null>(null);

  // Modal de publicação de clipe (Reels / Stories)
  const [clipPublishModal, setClipPublishModal] = useState<{
    open: boolean;
    clip: StudioClipItem | null;
    format: 'REELS' | 'STORIES';
    isPublishing: boolean;
    error: string | null;
  }>({ open: false, clip: null, format: 'REELS', isPublishing: false, error: null });

  const [birthdays, setBirthdays] = useState<PhotoAsset[]>([]);
  const [birthdayHistory, setBirthdayHistory] = useState<Array<{ id: string; student_name: string; brand: string; approval_status: string; created_at: string }>>([]);
  const [birthdayGenerating, setBirthdayGenerating] = useState<Record<string, boolean>>({});
  const [birthdayPreview, setBirthdayPreview] = useState<{ assetId: string; imageUrl: string; studentName: string } | null>(null);
  const [birthdayPublishing, setBirthdayPublishing] = useState(false);
  const [birthdayUploadingPhoto, setBirthdayUploadingPhoto] = useState(false);
  const birthdayPhotoInputRef = useRef<HTMLInputElement>(null);
  const [commemorativeDates, setCommemorativeDates] = useState<CommemorativeDateItem[]>([]);
  const [commDateEditing, setCommDateEditing] = useState<CommemorativeDateItem | null>(null);
  const [commDateModalOpen, setCommDateModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<StudioPost | null>(null);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [postUpdating, setPostUpdating] = useState(false);
  const [postDeleteConfirmOpen, setPostDeleteConfirmOpen] = useState(false);
  const [commDateFilter, setCommDateFilter] = useState({ category: "all", assigned: "all", status: "all" });
  const [commDateExpandedMonths, setCommDateExpandedMonths] = useState<Set<number>>(new Set());
  const [commDateSaving, setCommDateSaving] = useState(false);
  // Controlled form state for commemorative date modal
  const [commForm, setCommForm] = useState({
    name: "", date_day: 1, date_month: 1, category: "music", brand: "both",
    post_type: "story", assigned_to: "nina", auto_generate: false, days_advance: 7,
    caption_hint: "", post_idea: "", hashtags: "",
  });
  const [integrations, setIntegrations] = useState<IntegrationCredentialItem[]>([]);
  const [metrics, setMetrics] = useState({ alcance: 0, engajamento: 0, taxaEngajamento: 0, publicados: 0 });

  const [assets, setAssets] = useState<PhotoAsset[]>([]);
  const [assetsTotal, setAssetsTotal] = useState(0);
  const [assetsPage, setAssetsPage] = useState(1);
  const [assetsSearch, setAssetsSearch] = useState("");
  const [assetsOnlyWithPhoto, setAssetsOnlyWithPhoto] = useState<"todos" | "com" | "sem">("todos");
  const [assetsFilterType, setAssetsFilterType] = useState<AssetFilterType>("alunos");

  // Modal de upload em lote (alunos)
  const [showBatchUploadModal, setShowBatchUploadModal] = useState(false);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchMatches, setBatchMatches] = useState<Array<{ file: File; asset: PhotoAsset | null; confirmed: boolean }>>([]);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  // Modal de upload de evento
  const [showEventUploadModal, setShowEventUploadModal] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState(() => brazilNow.date);
  const [eventBrand, setEventBrand] = useState<StudioBrand>("la_music_school");
  const [eventFiles, setEventFiles] = useState<File[]>([]);
  const [isEventUploading, setIsEventUploading] = useState(false);
  const [eventUploadProgress, setEventUploadProgress] = useState(0);
  const [eventUploadedCount, setEventUploadedCount] = useState(0);
  const [eventFailedCount, setEventFailedCount] = useState(0);
  const [eventDragOver, setEventDragOver] = useState(false);

  // Grouped events for "Eventos" tab
  const [groupedEvents, setGroupedEvents] = useState<GroupedEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);

  // Event detail modal
  const [selectedEvent, setSelectedEvent] = useState<GroupedEvent | null>(null);
  const [showEventDetailModal, setShowEventDetailModal] = useState(false);
  const [eventDetailPhotos, setEventDetailPhotos] = useState<PhotoAsset[]>([]);
  const [loadingEventPhotos, setLoadingEventPhotos] = useState(false);

  // Delete confirmation
  const [eventToDelete, setEventToDelete] = useState<GroupedEvent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Add photos to existing event
  const [showAddPhotosModal, setShowAddPhotosModal] = useState(false);
  const [targetEventForPhotos, setTargetEventForPhotos] = useState<GroupedEvent | null>(null);
  const [additionalPhotos, setAdditionalPhotos] = useState<File[]>([]);
  const [isAddingPhotos, setIsAddingPhotos] = useState(false);
  const [addPhotosProgress, setAddPhotosProgress] = useState(0);

  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [postPlatform, setPostPlatform] = useState<StudioPlatform>("story");
  const [postCaption, setPostCaption] = useState("");
  const [postBrief, setPostBrief] = useState("");
  const [postDate, setPostDate] = useState(() => brazilNow.date);
  const [postTime, setPostTime] = useState(() => brazilNow.time);
  const [creationMode, setCreationMode] = useState<"nina" | "manual">("nina");
  const [ninaPreviewUrl, setNinaPreviewUrl] = useState<string | null>(null);
  const [ninaHashtags, setNinaHashtags] = useState<string[]>([]);
  const [ninaGenerationMethod, setNinaGenerationMethod] = useState<string | null>(null);
  const [isGeneratingWithNina, setIsGeneratingWithNina] = useState(false);
  const [isPublishingNow, setIsPublishingNow] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  // Event photos for Nina (aba Criar)
  const [eventPhotosForNina, setEventPhotosForNina] = useState<PhotoAsset[]>([]);
  const [selectedEventPhotoForNina, setSelectedEventPhotoForNina] = useState<PhotoAsset | null>(null);
  const [loadingEventPhotosForNina, setLoadingEventPhotosForNina] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingAssetId, setUploadingAssetId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAssetForUpload, setSelectedAssetForUpload] = useState<PhotoAsset | null>(null);
  const videoPollingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const clipPollingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  const supabase = useMemo(() => createClient(), []);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (statusFilter !== "all" && post.status !== statusFilter) return false;
      if (typeFilter !== "all" && post.post_type !== typeFilter) return false;
      if (platformFilter !== "all") {
        const ids = (post.platform_ids as unknown as Record<string, unknown>) || {};
        if (!Object.prototype.hasOwnProperty.call(ids, platformFilter)) return false;
      }
      return true;
    });
  }, [posts, statusFilter, typeFilter, platformFilter]);

  const publishTargetPost = useMemo(() => {
    return posts.find((post) => post.status !== "published") ?? null;
  }, [posts]);

  const monthLabel = useMemo(
    () => calendarDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    [calendarDate]
  );

  const renderVideoTab = () => (
    <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
      <Card variant="default" className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-100">Upload de vídeo</h3>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setVideoUploadDragOver(true);
          }}
          onDragLeave={() => setVideoUploadDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setVideoUploadDragOver(false);
            const file = event.dataTransfer.files?.[0] ?? null;
            handleVideoFileSelected(file);
          }}
          className={cn(
            "rounded-xl border-2 border-dashed p-4 text-center transition-colors",
            videoUploadDragOver ? "border-cyan-400 bg-cyan-500/10" : "border-slate-700 bg-slate-900/40"
          )}
        >
          <Upload size={24} className="mx-auto mb-2 text-slate-400" />
          <p className="text-sm text-slate-300">Arraste um MP4/MOV ou clique para selecionar</p>
          <p className="text-xs text-slate-500">Tamanho máximo: 2GB</p>
          <label className="mt-3 inline-flex cursor-pointer rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
            Selecionar vídeo
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/mov,.mp4,.mov"
              className="hidden"
              onChange={(event) => handleVideoFileSelected(event.target.files?.[0] ?? null)}
            />
          </label>
          {videoUploadFile ? (
            <p className="mt-3 text-xs text-cyan-400">
              {videoUploadFile.name} • {(videoUploadFile.size / (1024 * 1024)).toFixed(1)}MB
            </p>
          ) : null}
        </div>

        {/* Divider "ou" */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-xs text-slate-500">ou</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        {/* YouTube URL */}
        <div className="space-y-2">
          <label className="text-xs text-slate-400">URL do YouTube</label>
          <input
            value={videoUploadYouTubeUrl}
            onChange={(event) => {
              setVideoUploadYouTubeUrl(event.target.value);
              if (event.target.value.trim()) setVideoUploadFile(null);
            }}
            className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
            placeholder="https://www.youtube.com/watch?v=..."
          />
          {videoUploadYouTubeUrl && /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/.test(videoUploadYouTubeUrl) && (
            <p className="text-xs text-cyan-400">URL válida do YouTube detectada</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs text-slate-400">Título</label>
          <input
            value={videoUploadTitle}
            onChange={(event) => setVideoUploadTitle(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
            placeholder="Ex: Aula de guitarra - highlights"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <label className="text-xs text-slate-400">Marca</label>
            <Select value={videoUploadBrand} onValueChange={(value) => setVideoUploadBrand(value as StudioBrand)}>
              <SelectTrigger className="h-10 border-slate-700 bg-slate-900/70 text-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="la_music_school">LA Music School</SelectItem>
                <SelectItem value="la_music_kids">LA Music Kids</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400">Evento (opcional)</label>
            <input
              value={videoUploadEventName}
              onChange={(event) => setVideoUploadEventName(event.target.value)}
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
              placeholder="Nome do evento"
            />
          </div>
        </div>

        {videoUploadStage !== "idle" ? (
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-cyan-300">
              <SpinnerGap size={14} className="animate-spin" />
              <span className="text-sm font-medium">
                {videoUploadStage === "validating" && "Validando arquivo..."}
                {videoUploadStage === "uploading" && `Enviando vídeo... ${videoUploadProgress}%`}
                {videoUploadStage === "processing" && "Registrando vídeo no Studio..."}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-cyan-500 transition-all duration-300"
                style={{ width: videoUploadStage === "uploading" ? `${videoUploadProgress}%` : "33%" }}
              />
            </div>
          </div>
        ) : null}

        <Button
          className="w-full"
          variant="primary"
          disabled={videoUploadStage !== "idle"}
          onClick={() => void handleVideoUpload()}
        >
          <Upload size={14} /> {/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/.test(videoUploadYouTubeUrl.trim()) ? "Adicionar YouTube" : "Enviar vídeo"}
        </Button>

        {/* Preset Selector */}
        <div className="border-t border-slate-800 pt-4">
          <p className="text-xs text-slate-400 mb-2">Tipo de conteúdo</p>
          <div className="grid grid-cols-5 gap-2">
            {(Object.entries(CONTENT_PRESETS) as [ContentPresetKey, typeof CONTENT_PRESETS[ContentPresetKey]][]).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedPreset(key);
                  setSubmagicConfig(prev => ({
                    ...prev,
                    templateName: preset.templateName,
                    minClipLength: preset.minClipLength,
                    maxClipLength: preset.maxClipLength,
                    faceTracking: preset.faceTracking,
                    disableCaptions: preset.disableCaptions,
                    maxClips: preset.maxClips,
                  }));
                }}
                className={cn(
                  "flex flex-col items-center p-2 rounded-lg border text-xs transition-all",
                  selectedPreset === key
                    ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                    : "border-slate-700 text-slate-400 hover:border-slate-500"
                )}
              >
                <span className="text-base">{preset.label.split(' ')[0]}</span>
                <span className="mt-0.5 text-center leading-tight text-[10px]">{preset.label.split(' ').slice(1).join(' ')}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Painel de Configuração Submagic */}
        <div className="border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => setShowSubmagicConfig(!showSubmagicConfig)}
            className="flex w-full items-center justify-between"
          >
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Sparkle size={16} className="text-cyan-400" />
              Ajustes Avançados
            </h3>
            <CaretRight size={14} className={cn("text-slate-400 transition-transform", showSubmagicConfig && "rotate-90")} />
          </button>

          {showSubmagicConfig && (
            <div className="space-y-4 pt-4">
              {/* Max Clips Slider */}
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Máximo de clips: {submagicConfig.maxClips}</label>
                <input
                  type="range"
                  min={3}
                  max={20}
                  step={1}
                  value={submagicConfig.maxClips}
                  onChange={(e) => setSubmagicConfig(prev => ({ ...prev, maxClips: Number(e.target.value) }))}
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>3 melhores</span>
                  <span>20 clips</span>
                </div>
              </div>

              {/* Toggle Legendas */}
              <Switch
                checked={!submagicConfig.disableCaptions}
                onCheckedChange={(checked) => setSubmagicConfig((prev) => ({ ...prev, disableCaptions: !checked }))}
                label="Legendas"
                description="Desativar para vídeos sem legenda"
              />

              {/* Template de Legenda - só mostrar se legendas ativas */}
              {!submagicConfig.disableCaptions && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-400">Template de Legenda</label>
                    <a
                      href="https://www.submagic.co/templates"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      Ver previews reais →
                    </a>
                  </div>
                  <Select
                    value={submagicConfig.templateName}
                    onValueChange={(v) => setSubmagicConfig(prev => ({ ...prev, templateName: v }))}
                  >
                    <SelectTrigger className="h-10 border-slate-700 bg-slate-900/70">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBMAGIC_TEMPLATES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Duração dos Clips */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Duração Mínima (s)</label>
                  <input
                    type="number"
                    min={15}
                    max={300}
                    value={submagicConfig.minClipLength}
                    onChange={(e) => setSubmagicConfig(prev => ({ ...prev, minClipLength: Number(e.target.value) }))}
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-slate-400">Duração Máxima (s)</label>
                  <input
                    type="number"
                    min={15}
                    max={300}
                    value={submagicConfig.maxClipLength}
                    onChange={(e) => setSubmagicConfig(prev => ({ ...prev, maxClipLength: Number(e.target.value) }))}
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
                  />
                </div>
              </div>

              {/* Face Tracking */}
              <Switch
                checked={submagicConfig.faceTracking}
                onCheckedChange={(checked) => setSubmagicConfig((prev) => ({ ...prev, faceTracking: checked }))}
                label="Face Tracking"
                description="Mantém o rosto centralizado no formato 9:16"
              />

              {/* Seção: Pós-processamento (Em breve) */}
              <div className="space-y-3 pt-3 border-t border-slate-800 opacity-50">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-slate-400">Pós-processamento</p>
                  <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">Em breve</span>
                </div>

                <Switch
                  checked={false}
                  disabled
                  onCheckedChange={() => {}}
                  label="Limpar Áudio"
                  description="Remove ruído de fundo via IA"
                />

                <Switch
                  checked={false}
                  disabled
                  onCheckedChange={() => {}}
                  label="Remover Bad Takes"
                  description="IA detecta e remove tomadas ruins"
                />

                <Switch
                  checked={false}
                  disabled
                  onCheckedChange={() => {}}
                  label="Magic Zooms"
                  description="Zoom automático para engajamento"
                />

                <Switch
                  checked={false}
                  disabled
                  onCheckedChange={() => {}}
                  label="B-Roll Automático"
                  description="IA insere imagens de contexto"
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card variant="default" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">Vídeos</h3>
          <Button variant="outline" size="sm" onClick={() => void loadVideos()}>
            Atualizar
          </Button>
        </div>

        {videos.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum vídeo encontrado para esta marca.</p>
        ) : (
          <div className="space-y-2">
            {videos.map((video) => {
              const isExpanded = Boolean(expandedVideoIds[video.id]);
              const isLoadingClips = Boolean(loadingClipsByVideo[video.id]);
              const clips = clipsByVideo[video.id] ?? [];
              const isVideoBusy = video.status === "transcribing" || video.status === "analyzing";

              return (
                <div key={video.id} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                  <button
                    type="button"
                    onClick={() => void toggleVideoExpansion(video.id)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-100">{video.title || "Vídeo sem título"}</p>
                      <p className="text-xs text-slate-500">
                        {video.event_name ? `${video.event_name} • ` : ""}
                        {video.duration_seconds ? `${video.duration_seconds}s • ` : ""}
                        {new Date(video.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="status"
                        color={VIDEO_STATUS_COLORS[video.status]}
                        className={isVideoBusy ? "animate-pulse" : undefined}
                      >
                        {VIDEO_STATUS_LABELS[video.status]}
                      </Badge>
                      <CaretRight size={14} className={cn("text-slate-400 transition-transform", isExpanded ? "rotate-90" : "")}/>
                    </div>
                  </button>

                  {(video.status === "uploaded" || video.status === "ready") ? (
                    <div className="mt-2 flex items-center justify-end gap-2">
                      {video.status === "uploaded" && (
                        <Button
                          size="sm"
                          variant="accent"
                          disabled={Boolean(videoPollingBusyIds[video.id])}
                          onClick={() => void handleProcessVideo(video)}
                        >
                          <Sparkle size={14} /> Processar com Nina ✨
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedVideoForPublish(video);
                          setPublishVideoBrand(video.brand ?? "la_music_school");
                          setPublishVideoCaption("");
                          setShowPublishVideoModal(true);
                        }}
                      >
                        Publicar direto →
                      </Button>
                    </div>
                  ) : null}

                  {videoPollingMessages[video.id] ? (
                    <p className="mt-2 text-xs text-cyan-300">{videoPollingMessages[video.id]}</p>
                  ) : null}

                  {isExpanded ? (
                    <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                      {isLoadingClips ? (
                        <p className="text-xs text-slate-500">Carregando clipes...</p>
                      ) : clips.length === 0 ? (
                        <p className="text-xs text-slate-500">Nenhum clipe encontrado para este vídeo.</p>
                      ) : (
                        clips.map((clip) => {
                          const isClipBusy = clip.status === "rendering";
                          const isRenderingInvoke = Boolean(clipRenderInvokingIds[clip.id]);
                          const isModerating = Boolean(clipModeratingIds[clip.id]);
                          const isPollingClip = Boolean(clipPollingBusyIds[clip.id]);
                          const isPublishing = Boolean(clipPublishingIds[clip.id]);
                          return (
                            <div key={clip.id} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/60 p-2">
                              <div>
                                <p className="text-xs text-slate-200">{clip.title || "Sem frase"}</p>
                                <p className="text-[11px] text-slate-500">{clip.duration_seconds ? `${clip.duration_seconds}s` : "Duração não informada"}</p>
                                {clip.status === "published" && clip.published_at ? (
                                  <p className="text-[11px] text-teal-300">Publicado em {new Date(clip.published_at).toLocaleString("pt-BR")}</p>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="status"
                                  color={CLIP_STATUS_COLORS[clip.status]}
                                  className={isClipBusy ? "animate-pulse" : undefined}
                                >
                                  {CLIP_STATUS_LABELS[clip.status]}
                                </Badge>

                                {clip.status === "pending" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isRenderingInvoke || isPollingClip}
                                    onClick={() => void handleRenderClip(clip)}
                                  >
                                    {isRenderingInvoke ? <SpinnerGap size={12} className="animate-spin" /> : null}
                                    Renderizar
                                  </Button>
                                ) : null}

                                {clip.status === "rendering" ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-amber-300">
                                    <SpinnerGap size={12} className="animate-spin" /> Renderizando...
                                  </span>
                                ) : null}

                                {clip.status === "ready" ? (
                                  <>
                                    {clip.file_url ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          console.log("[DEBUG] Ver clicked:", clip.file_url);
                                          setPreviewClip({ url: clip.file_url as string, title: clip.title || "Clipe" });
                                        }}
                                      >
                                        ▶ Ver
                                      </Button>
                                    ) : null}
                                    <Button
                                      size="sm"
                                      variant="accent"
                                      disabled={isModerating}
                                      onClick={() => void handleClipModeration(clip.id, "approved")}
                                    >
                                      ✓ Aprovar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={isModerating}
                                      onClick={() => void handleClipModeration(clip.id, "failed")}
                                    >
                                      ✗ Recusar
                                    </Button>
                                  </>
                                ) : null}

                                {clip.status === "approved" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isPublishing}
                                    onClick={() => setClipPublishModal({ open: true, clip, format: 'REELS', isPublishing: false, error: null })}
                                  >
                                    {isPublishing ? <SpinnerGap size={12} className="animate-spin" /> : null}
                                    Publicar →
                                  </Button>
                                ) : null}

                                {clip.status === "failed" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isRenderingInvoke || isPollingClip}
                                    onClick={() => void handleRenderClip(clip)}
                                  >
                                    {isRenderingInvoke ? <SpinnerGap size={12} className="animate-spin" /> : null}
                                    Tentar novamente
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );

  const monthDays = useMemo(() => {
    const start = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    const end = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
    const days: Date[] = [];

    const firstWeekday = start.getDay();
    for (let i = 0; i < firstWeekday; i += 1) {
      days.push(new Date(start.getFullYear(), start.getMonth(), i - firstWeekday + 1));
    }

    for (let day = 1; day <= end.getDate(); day += 1) {
      days.push(new Date(start.getFullYear(), start.getMonth(), day));
    }

    while (days.length % 7 !== 0) {
      const last = days[days.length - 1];
      days.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
    }

    return days;
  }, [calendarDate]);

  const postsByDate = useMemo(() => {
    const map = new Map<string, StudioPost[]>();
    for (const post of filteredPosts) {
      const raw = post.scheduled_for || post.published_at || post.created_at;
      if (!raw) continue;
      const key = new Date(raw).toISOString().slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(post);
      map.set(key, list);
    }
    return map;
  }, [filteredPosts]);

  const assetsPages = Math.max(1, Math.ceil(assetsTotal / 48));
  const eventsPages = Math.max(1, Math.ceil(eventsTotal / 24));

  const loadBaseData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [ninaRes, approvalsRes, postsRes, birthdaysRes, commemorativeRes, integrationsRes, metricsRes] = await Promise.allSettled([
      getNinaConfig(),
      getPendingApprovalsCount(),
      getStudioPostsByBrand(brand),
      getBirthdaysOverview(brand),
      getCommemorativeDates(brand),
      getIntegrations(),
      getPerformanceSummaryByBrand(brand),
    ]);

    if (ninaRes.status === "fulfilled") setNinaConfig(ninaRes.value);
    if (approvalsRes.status === "fulfilled") setPendingApprovals(approvalsRes.value);
    if (postsRes.status === "fulfilled") setPosts(postsRes.value);
    if (birthdaysRes.status === "fulfilled") {
      setBirthdays(birthdaysRes.value.upcoming);
      setBirthdayHistory(birthdaysRes.value.history);
    }
    if (commemorativeRes.status === "fulfilled") setCommemorativeDates(commemorativeRes.value);
    if (integrationsRes.status === "fulfilled") setIntegrations(integrationsRes.value);
    if (metricsRes.status === "fulfilled") setMetrics(metricsRes.value);

    const fatalErrors = [postsRes, birthdaysRes, commemorativeRes].filter((r) => r.status === "rejected");
    if (fatalErrors.length > 0) {
      setError("Não foi possível carregar todos os dados do Studio.");
    }

    if (integrationsRes.status === "rejected") {
      toast.warning("Conexões: sem permissão para ler credenciais neste usuário.");
      setIntegrations([]);
    }

    setLoading(false);
  }, [brand]);

  const loadAssets = useCallback(async () => {
    const onlyWithPhoto = assetsOnlyWithPhoto === "todos" ? null : assetsOnlyWithPhoto === "com";
    try {
      const response = await getPhotoAssets(brand, assetsPage, 48, onlyWithPhoto, assetsSearch, assetsFilterType);
      setAssets(response.rows);
      setAssetsTotal(response.total);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar banco de fotos.");
    }
  }, [assetsOnlyWithPhoto, assetsPage, assetsSearch, brand, assetsFilterType]);

  const loadGroupedEvents = useCallback(async () => {
    try {
      const response = await getGroupedEvents(brand, assetsPage, 24, assetsSearch);
      setGroupedEvents(response.events);
      setEventsTotal(response.total);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar eventos.");
    }
  }, [brand, assetsPage, assetsSearch]);

  const loadVideos = useCallback(async () => {
    try {
      const rows = await getStudioVideosByBrand(brand);
      setVideos(rows);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar vídeos.");
    }
  }, [brand]);

  // Carrega fotos de eventos para seleção na aba Criar
  const loadEventPhotosForNina = useCallback(async () => {
    setLoadingEventPhotosForNina(true);
    try {
      // Busca fotos de eventos (source != emusys, event_name IS NOT NULL)
      const { rows } = await getPhotoAssets(brand, 1, 18, true, "", "eventos");
      setEventPhotosForNina(rows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEventPhotosForNina(false);
    }
  }, [brand]);

  const loadVideoClips = useCallback(async (videoId: string) => {
    setLoadingClipsByVideo((prev) => ({ ...prev, [videoId]: true }));
    try {
      const clips = await getStudioClipsByVideoId(videoId);
      setClipsByVideo((prev) => ({ ...prev, [videoId]: clips }));
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar clipes do vídeo.");
    } finally {
      setLoadingClipsByVideo((prev) => ({ ...prev, [videoId]: false }));
    }
  }, []);

  const updateClipInState = useCallback((clipId: string, patch: Partial<StudioClipItem>) => {
    setClipsByVideo((prev) => {
      const next: Record<string, StudioClipItem[]> = {};
      for (const [videoId, clips] of Object.entries(prev)) {
        next[videoId] = clips.map((clip) => (clip.id === clipId ? { ...clip, ...patch } : clip));
      }
      return next;
    });
  }, []);

  const toggleVideoExpansion = useCallback(async (videoId: string) => {
    setExpandedVideoIds((prev) => ({ ...prev, [videoId]: !prev[videoId] }));

    if (clipsByVideo[videoId]) {
      return;
    }

    await loadVideoClips(videoId);
  }, [clipsByVideo, loadVideoClips]);

  const clearVideoPolling = useCallback((videoId: string) => {
    const timer = videoPollingTimersRef.current[videoId];
    if (timer) {
      clearTimeout(timer);
    }
    videoPollingTimersRef.current[videoId] = null;
    setVideoPollingBusyIds((prev) => ({ ...prev, [videoId]: false }));
  }, []);

  const clearClipPolling = useCallback((clipId: string) => {
    const timer = clipPollingTimersRef.current[clipId];
    if (timer) {
      clearTimeout(timer);
    }
    clipPollingTimersRef.current[clipId] = null;
    setClipPollingBusyIds((prev) => ({ ...prev, [clipId]: false }));
  }, []);

  const countKeyMoments = useCallback((keyMoments: StudioVideoPollingItem["key_moments"]): number => {
    if (Array.isArray(keyMoments)) return keyMoments.length;
    if (keyMoments && typeof keyMoments === "object") {
      const maybeRecord = keyMoments as Record<string, unknown>;
      if (Array.isArray(maybeRecord.moments)) return maybeRecord.moments.length;
      return Object.keys(maybeRecord).length;
    }
    return 0;
  }, []);

  const pollVideoStatus = useCallback(async (
    videoId: string,
    noChangeAttempts = 0,
    lastStatus?: StudioVideoStatus,
  ) => {
    try {
      const row = await getStudioVideoPollingById(videoId);
      if (!row) {
        clearVideoPolling(videoId);
        return;
      }

      const currentStatus = row.status;

      setVideos((prev) => prev.map((video) => (
        video.id === videoId
          ? { ...video, status: currentStatus }
          : video
      )));

      if (currentStatus === "transcribing") {
        setVideoPollingMessages((prev) => ({ ...prev, [videoId]: "Transcrevendo áudio em PT-BR..." }));
      }

      if (currentStatus === "transcribed") {
        setVideoPollingMessages((prev) => ({ ...prev, [videoId]: "Transcrição concluída. Analisando momentos..." }));
      }

      if (currentStatus === "analyzing") {
        setVideoPollingMessages((prev) => ({ ...prev, [videoId]: "Identificando os melhores momentos..." }));
      }

      if (currentStatus === "ready") {
        const totalMoments = countKeyMoments(row.key_moments);
        const message = `✅ ${totalMoments} clipes identificados`;
        setVideoPollingMessages((prev) => ({ ...prev, [videoId]: message }));
        toast.success(message);
        setExpandedVideoIds((prev) => ({ ...prev, [videoId]: true }));
        await loadVideoClips(videoId);
        clearVideoPolling(videoId);
        return;
      }

      if (currentStatus === "failed") {
        setVideoPollingMessages((prev) => ({ ...prev, [videoId]: "❌ Erro no processamento" }));
        toast.error("❌ Erro no processamento");
        clearVideoPolling(videoId);
        return;
      }

      if (!TRANSITIONAL_STATUSES.includes(currentStatus)) {
        clearVideoPolling(videoId);
        return;
      }

      const nextNoChangeAttempts = currentStatus === lastStatus ? noChangeAttempts + 1 : 0;
      if (nextNoChangeAttempts >= POLL_INTERVALS.length) {
        clearVideoPolling(videoId);
        return;
      }

      const delay = POLL_INTERVALS[nextNoChangeAttempts];
      const timer = setTimeout(() => {
        void pollVideoStatus(videoId, nextNoChangeAttempts, currentStatus);
      }, delay);
      videoPollingTimersRef.current[videoId] = timer;
    } catch (err) {
      console.error(err);
      clearVideoPolling(videoId);
      toast.error("Falha ao monitorar processamento do vídeo.");
    }
  }, [clearVideoPolling, countKeyMoments, loadVideoClips]);

  const handleProcessVideo = useCallback(async (video: StudioVideoItem) => {
    if (typeof video.file_size === "number" && video.file_size > MAX_PROCESS_VIDEO_BYTES) {
      toast.error("Vídeo muito grande para processamento automático. Use um arquivo de até 2GB.");
      return;
    }

    if (video.error_message) {
      toast.error(`Último erro: ${video.error_message}`);
    }

    clearVideoPolling(video.id);
    setVideoPollingBusyIds((prev) => ({ ...prev, [video.id]: true }));

    try {
      const { error: fnError } = await supabase.functions.invoke("process-video", {
        body: {
          video_id: video.id,
          config: submagicConfig,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      toast.success("Processamento iniciado.");
      await loadVideos();
      void pollVideoStatus(video.id, 0, undefined);
    } catch (err) {
      console.error(err);
      setVideoPollingBusyIds((prev) => ({ ...prev, [video.id]: false }));
      toast.error(err instanceof Error ? err.message : "Erro ao iniciar processamento do vídeo.");
    }
  }, [clearVideoPolling, loadVideos, pollVideoStatus, supabase, submagicConfig]);

  // Handler para publicar vídeo diretamente (sem pipeline Nina)
  const handlePublishVideoDirect = useCallback(async () => {
    if (!selectedVideoForPublish) return;

    setIsPublishingVideo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado.");
        return;
      }

      const postType = publishVideoFormat === "story" ? "story" : "reels";
      const { data: postData, error: postError } = await supabase
        .from("posts")
        .insert({
          title: selectedVideoForPublish.title || "Vídeo",
          caption: publishVideoCaption,
          post_type: postType,
          status: "draft",
          brand: publishVideoBrand,
          created_by: user.id,
          created_by_ai: false,
          metadata: { video_url: selectedVideoForPublish.file_url },
        } as never)
        .select("id")
        .single();

      if (postError || !postData) {
        console.error("[STUDIO] Post insert error:", postError);
        toast.error("Erro ao criar post.");
        return;
      }

      const createdPostId = (postData as { id: string }).id;

      // Inserir na fila de publicação
      const { error: queueError } = await supabase
        .from("studio_publish_queue")
        .insert({
          post_id: createdPostId,
          brand: publishVideoBrand,
          platform: "instagram",
          scheduled_for: new Date().toISOString(),
          status: "pending",
        } as never);

      if (queueError) {
        console.error("[STUDIO] Queue insert error:", queueError);
        toast.error("Erro ao adicionar à fila.");
        return;
      }

      // Publicar imediatamente
      const { data: publishData, error: fnError } = await supabase.functions.invoke<PublishScheduledPostsResponse>("publish-scheduled-posts", {
        body: { post_id: createdPostId },
      });

      if (fnError) {
        toast.error(getPublishErrorMessage(fnError, publishData ?? undefined) ?? "Erro ao publicar vídeo.");
        return;
      }

      if (!publishData?.success || (publishData.published ?? 0) < 1) {
        toast.error(getPublishErrorMessage(null, publishData ?? undefined) ?? "Erro ao publicar vídeo.");
        return;
      }

      toast.success("Vídeo enviado para publicação!");
      setShowPublishVideoModal(false);
      setSelectedVideoForPublish(null);
      setPublishVideoCaption("");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao publicar vídeo.");
    } finally {
      setIsPublishingVideo(false);
    }
  }, [selectedVideoForPublish, publishVideoCaption, publishVideoBrand, publishVideoFormat, supabase]);

  const pollClipStatus = useCallback(async (
    clipId: string,
    noChangeAttempts = 0,
    lastStatus?: StudioClipStatus,
  ) => {
    try {
      const row = await getStudioClipPollingById(clipId);
      if (!row) {
        clearClipPolling(clipId);
        return;
      }

      const currentStatus = row.status;
      updateClipInState(clipId, {
        status: currentStatus,
        file_url: row.file_url,
      });

      if (currentStatus === "ready" || currentStatus === "failed") {
        clearClipPolling(clipId);
        return;
      }

      if (!TRANSITIONAL_CLIP_STATUSES.includes(currentStatus)) {
        clearClipPolling(clipId);
        return;
      }

      const nextNoChangeAttempts = currentStatus === lastStatus ? noChangeAttempts + 1 : 0;
      if (nextNoChangeAttempts >= POLL_INTERVALS.length) {
        clearClipPolling(clipId);
        return;
      }

      const delay = POLL_INTERVALS[nextNoChangeAttempts];
      const timer = setTimeout(() => {
        void pollClipStatus(clipId, nextNoChangeAttempts, currentStatus);
      }, delay);
      clipPollingTimersRef.current[clipId] = timer;
    } catch (err) {
      console.error(err);
      clearClipPolling(clipId);
      toast.error("Falha ao monitorar render do clipe.");
    }
  }, [clearClipPolling, updateClipInState]);

  const handleRenderClip = useCallback(async (clip: StudioClipItem) => {
    clearClipPolling(clip.id);
    setClipRenderInvokingIds((prev) => ({ ...prev, [clip.id]: true }));

    try {
      updateClipInState(clip.id, { status: "rendering" });
      const { error: fnError } = await supabase.functions.invoke("render-clip", {
        body: { clip_id: clip.id },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      setClipPollingBusyIds((prev) => ({ ...prev, [clip.id]: true }));
      void pollClipStatus(clip.id, 0, undefined);
    } catch (err) {
      console.error(err);
      updateClipInState(clip.id, { status: "pending" });
      toast.error(err instanceof Error ? err.message : "Erro ao iniciar render do clipe.");
    } finally {
      setClipRenderInvokingIds((prev) => ({ ...prev, [clip.id]: false }));
    }
  }, [clearClipPolling, pollClipStatus, supabase, updateClipInState]);

  const handleClipModeration = useCallback(async (clipId: string, status: "approved" | "failed") => {
    setClipModeratingIds((prev) => ({ ...prev, [clipId]: true }));
    try {
      const { error } = await supabase
        .from("studio_clips")
        .update({ status } as never)
        .eq("id", clipId);

      if (error) throw new Error(error.message);

      updateClipInState(clipId, { status });
      toast.success(status === "approved" ? "Clipe aprovado." : "Clipe recusado.");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar status do clipe.");
    } finally {
      setClipModeratingIds((prev) => ({ ...prev, [clipId]: false }));
    }
  }, [supabase, updateClipInState]);

  const handlePublishClip = useCallback(async (clip: StudioClipItem) => {
    setClipPublishingIds((prev) => ({ ...prev, [clip.id]: true }));
    try {
      const { data: authData } = await supabase.auth.getUser();
      const createdBy = authData.user?.id;
      if (!createdBy) {
        toast.error("Sessão inválida. Faça login novamente para publicar.");
        return;
      }

      // Etapa 1: criar post
      const { data: postData, error: postErr } = await supabase
        .from("posts")
        .insert({
          title: clip.title || "Clipe LA Music",
          caption: clip.title || "",
          post_type: "reels",
          status: "draft",
          brand: clip.brand ?? brand,
          created_by: createdBy,
          created_by_ai: true,
          ai_agent_name: "Nina",
          metadata: {
            video_url: clip.file_url,
            image_url: clip.file_url,
            clip_id: clip.id,
            video_id: clip.video_id,
            start_seconds: clip.start_seconds,
            end_seconds: clip.end_seconds,
          },
        } as never)
        .select("id")
        .single();

      if (postErr || !postData) {
        toast.error(postErr?.message || "Erro ao criar post");
        return;
      }

      const createdPostId = (postData as { id: string }).id;

      // Etapa 1.5: colocar na fila de publicação imediata
      const { error: queueErr } = await supabase
        .from("studio_publish_queue")
        .insert({
          post_id: createdPostId,
          brand: clip.brand ?? brand,
          platform: "instagram",
          scheduled_for: new Date().toISOString(),
          status: "pending",
        } as never);

      if (queueErr) {
        toast.error(queueErr.message || "Erro ao enfileirar publicação");
        return;
      }

      // Etapa 2: publicar
      const { data: publishData, error: pubErr } = await supabase.functions.invoke<PublishScheduledPostsResponse>("publish-scheduled-posts", {
        body: { post_id: createdPostId },
      });

      if (pubErr) {
        toast.error(getPublishErrorMessage(pubErr, publishData ?? undefined) ?? "Erro ao publicar no Instagram");
        return;
      }

      if (!publishData?.success || (publishData.published ?? 0) < 1) {
        toast.error(getPublishErrorMessage(null, publishData ?? undefined) ?? "Publicação não concluída. Verifique credenciais/fila.");
        return;
      }

      // Etapa 3: atualizar clipe
      const publishedAt = new Date().toISOString();
      const { error: clipUpdateErr } = await supabase
        .from("studio_clips")
        .update({
          status: "published",
          post_id: createdPostId,
          published_at: publishedAt,
        } as never)
        .eq("id", clip.id);

      if (clipUpdateErr) {
        toast.error("Publicado, mas falhou ao atualizar o status do clipe.");
        return;
      }

      updateClipInState(clip.id, {
        status: "published",
        post_id: createdPostId,
        published_at: publishedAt,
      });
      toast.success("Clipe publicado no Instagram! 🎬");
      await loadVideoClips(clip.video_id);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao publicar no Instagram");
    } finally {
      setClipPublishingIds((prev) => ({ ...prev, [clip.id]: false }));
    }
  }, [supabase, brand, updateClipInState, loadVideoClips]);

  // Publicar clip com formato (Reels / Stories) via Meta Graph API direta
  const publishClipWithFormat = useCallback(async () => {
    const { clip, format } = clipPublishModal;
    if (!clip) return;

    setClipPublishModal(prev => ({ ...prev, isPublishing: true, error: null }));

    try {
      // 1. Buscar credenciais do Instagram
      const clipBrand = clip.brand || brand;
      const integrationName = clipBrand === 'la_music_kids' ? 'instagram_kids' : 'instagram_school';
      const igUserId = clipBrand === 'la_music_kids' ? '17841404041835860' : '17841401761485758';

      const { data: cred, error: credError } = await supabase
        .from('integration_credentials')
        .select('*')
        .eq('integration_name', integrationName)
        .single();

      if (credError || !cred) {
        throw new Error('Credenciais do Instagram não encontradas');
      }

      const credData = cred as { credentials?: { access_token?: string }; metadata?: { access_token?: string } };
      const accessToken = credData.credentials?.access_token || credData.metadata?.access_token;
      if (!accessToken) {
        throw new Error('Token do Instagram não configurado');
      }

      // 2. Criar container na Meta API
      if (!clip.file_url) {
        throw new Error('Clipe sem URL de vídeo');
      }
      const createBody: Record<string, string> = {
        video_url: clip.file_url,
        media_type: format,
        access_token: accessToken,
      };
      // Stories NÃO aceitam caption
      if (format === 'REELS') {
        createBody.caption = clip.title || '🎵 #LAMusic';
      }

      const createRes = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}/media`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createBody) }
      );
      const createData = await createRes.json() as { id?: string; error?: { message?: string } };
      if (!createRes.ok || !createData.id) {
        throw new Error(createData.error?.message || 'Erro ao criar container no Instagram');
      }

      // 3. Polling: aguardar container ficar pronto (max 60s)
      const maxAttempts = 12;
      let isReady = false;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(r => setTimeout(r, 5000));
        const statusRes = await fetch(
          `https://graph.facebook.com/v19.0/${createData.id}?fields=status_code&access_token=${accessToken}`
        );
        const statusData = await statusRes.json() as { status_code?: string; error?: { message?: string } };
        console.log(`[IG] Container status (attempt ${attempt + 1}):`, statusData.status_code);

        if (statusData.status_code === 'FINISHED') {
          isReady = true;
          break;
        }
        if (statusData.status_code === 'ERROR') {
          throw new Error('Instagram falhou ao processar o vídeo');
        }
      }

      if (!isReady) {
        throw new Error('Timeout: Instagram não terminou de processar o vídeo');
      }

      const publishRes = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creation_id: createData.id, access_token: accessToken })
        }
      );
      const publishData = await publishRes.json() as { id?: string; error?: { message?: string } };
      if (!publishRes.ok || !publishData.id) {
        throw new Error(publishData.error?.message || 'Erro ao publicar no Instagram');
      }

      // 4. Atualizar banco
      const publishedAt = new Date().toISOString();
      await supabase
        .from('studio_clips')
        .update({
          status: 'published',
          published_at: publishedAt,
        } as never)
        .eq('id', clip.id);

      // 5. Atualizar estado local
      updateClipInState(clip.id, {
        status: 'published',
        published_at: publishedAt,
      });

      setClipPublishModal({ open: false, clip: null, format: 'REELS', isPublishing: false, error: null });
      toast.success(`Clipe publicado como ${format === 'REELS' ? 'Reels' : 'Stories'}! 🎬`);
      await loadVideoClips(clip.video_id);

    } catch (err) {
      console.error('[publishClipWithFormat]', err);
      setClipPublishModal(prev => ({
        ...prev,
        isPublishing: false,
        error: err instanceof Error ? err.message : 'Erro ao publicar'
      }));
    }
  }, [clipPublishModal, supabase, brand, updateClipInState, loadVideoClips]);

  const validateVideoFile = useCallback((file: File): string | null => {
    const lowerName = file.name.toLowerCase();
    const hasAllowedExtension = lowerName.endsWith(".mp4") || lowerName.endsWith(".mov");
    const hasAllowedMime = ALLOWED_VIDEO_MIME_TYPES.includes(file.type);

    if (!hasAllowedMime && !hasAllowedExtension) {
      return "Formato inválido. Envie apenas MP4 ou MOV.";
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      return "Arquivo maior que 2GB. Envie um vídeo menor.";
    }

    return null;
  }, []);

  const handleVideoFileSelected = useCallback((file: File | null) => {
    if (!file) {
      setVideoUploadFile(null);
      return;
    }

    const validationError = validateVideoFile(file);
    if (validationError) {
      setVideoUploadFile(null);
      toast.error(validationError);
      return;
    }

    setVideoUploadFile(file);
  }, [validateVideoFile]);

  const handleVideoUpload = useCallback(async () => {
    if (!videoUploadTitle.trim()) {
      toast.error("Informe o título do vídeo.");
      return;
    }

    const isYouTubeUrl = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/.test(videoUploadYouTubeUrl.trim());

    if (!videoUploadFile && !isYouTubeUrl) {
      toast.error("Selecione um arquivo de vídeo ou informe uma URL do YouTube.");
      return;
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const uploadedBy = authData.user?.id ?? null;

      // ========== FLUXO YOUTUBE ==========
      if (isYouTubeUrl) {
        setVideoUploadStage("processing");

        const youtubeUrl = videoUploadYouTubeUrl.trim();
        const { error: insertError } = await supabase.from("studio_videos").insert({
          title: videoUploadTitle.trim(),
          brand: videoUploadBrand,
          event_name: videoUploadEventName.trim() || null,
          file_url: youtubeUrl,
          storage_path: youtubeUrl,
          file_size: null,
          mime_type: "video/youtube",
          status: "uploaded",
          uploaded_by: uploadedBy,
          metadata: { source: "youtube", youtube_url: youtubeUrl },
        } as never);

        if (insertError) throw new Error(insertError.message);

        toast.success("Vídeo do YouTube adicionado!");
        setVideoUploadTitle("");
        setVideoUploadEventName("");
        setVideoUploadYouTubeUrl("");
        setVideoUploadFile(null);

        if (brand !== videoUploadBrand) {
          setBrand(videoUploadBrand);
        }

        const refreshedVideos = await getStudioVideosByBrand(videoUploadBrand);
        setVideos(refreshedVideos);
        setVideoUploadStage("idle");
        return;
      }

      // ========== FLUXO UPLOAD ARQUIVO ==========
      setVideoUploadStage("validating");
      const validationError = validateVideoFile(videoUploadFile!);
      if (validationError) {
        setVideoUploadStage("idle");
        toast.error(validationError);
        return;
      }

      setVideoUploadStage("uploading");
      setVideoUploadProgress(0);

      const safeName = videoUploadFile!.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-zA-Z0-9._-]/g, "");

      const storagePath = `raw/${Date.now()}-${safeName}`;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada. Faça login novamente.");

      const projectId = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://", "").replace(".supabase.co", "") ?? "";

      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(videoUploadFile!, {
          endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            authorization: `Bearer ${accessToken}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
          },
          uploadDataDuringCreation: false,
          removeFingerprintOnSuccess: true,
          metadata: {
            bucketName: "videos",
            objectName: storagePath,
            contentType: videoUploadFile!.type || "video/mp4",
            cacheControl: "3600",
          },
          chunkSize: 6 * 1024 * 1024,
          onError: (error) => reject(error),
          onProgress: (bytesUploaded, bytesTotal) => {
            const pct = Math.round((bytesUploaded / bytesTotal) * 100);
            setVideoUploadProgress(pct);
          },
          onSuccess: () => resolve(),
        });

        upload.findPreviousUploads().then((previousUploads) => {
          if (previousUploads.length) {
            upload.resumeFromPreviousUpload(previousUploads[0]);
          }
          upload.start();
        });
      });

      const { data: publicData } = supabase.storage.from("videos").getPublicUrl(storagePath);

      setVideoUploadStage("processing");

      const { error: insertError } = await supabase.from("studio_videos").insert({
        title: videoUploadTitle.trim(),
        brand: videoUploadBrand,
        event_name: videoUploadEventName.trim() || null,
        file_url: publicData.publicUrl,
        storage_path: storagePath,
        file_size: videoUploadFile!.size,
        mime_type: videoUploadFile!.type || "video/mp4",
        status: "uploaded",
        uploaded_by: uploadedBy,
      } as never);

      if (insertError) throw new Error(insertError.message);

      toast.success("Vídeo enviado com sucesso!");
      setVideoUploadTitle("");
      setVideoUploadEventName("");
      setVideoUploadFile(null);
      setVideoUploadYouTubeUrl("");

      if (brand !== videoUploadBrand) {
        setBrand(videoUploadBrand);
      }

      const refreshedVideos = await getStudioVideosByBrand(videoUploadBrand);
      setVideos(refreshedVideos);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao enviar vídeo.");
    } finally {
      setVideoUploadStage("idle");
    }
  }, [videoUploadTitle, videoUploadFile, videoUploadYouTubeUrl, validateVideoFile, supabase, videoUploadBrand, videoUploadEventName, brand]);

  // Comprime imagem se > 2MB usando canvas
  const compressImage = useCallback(async (file: File, maxSizeMB = 2): Promise<Blob> => {
    if (file.size <= maxSizeMB * 1024 * 1024) {
      return file;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Reduz proporcionalmente até ficar abaixo do limite
        const maxDimension = 1920;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Erro ao criar contexto do canvas"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Erro ao comprimir imagem"));
          },
          "image/jpeg",
          0.85
        );
      };
      img.onerror = () => reject(new Error("Erro ao carregar imagem"));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Upload paralelo com controle de concorrência
  const uploadFilesInParallel = useCallback(async <T,>(
    files: File[],
    uploadFn: (file: File, index: number) => Promise<T>,
    onProgress: (completed: number, failed: number, total: number) => void,
    concurrency = 5
  ): Promise<{ succeeded: number; failed: number; results: T[] }> => {
    const total = files.length;
    let completed = 0;
    let failed = 0;
    const results: T[] = [];

    // Processa em chunks para não sobrecarregar memória
    for (let i = 0; i < files.length; i += concurrency) {
      const chunk = files.slice(i, i + concurrency);
      const chunkPromises = chunk.map(async (file, chunkIndex) => {
        const globalIndex = i + chunkIndex;
        try {
          const result = await uploadFn(file, globalIndex);
          results.push(result);
          completed++;
        } catch (err) {
          console.error(`Erro no arquivo ${file.name}:`, err);
          failed++;
        }
        onProgress(completed, failed, total);
      });

      await Promise.all(chunkPromises);
    }

    return { succeeded: completed, failed, results };
  }, []);

  // Upload de foto para um asset específico
  const handleUploadPhoto = useCallback(async (assetId: string, file: File) => {
    setUploadingAssetId(assetId);

    try {
      // Validação
      if (!file.type.startsWith("image/")) {
        toast.error("Por favor, selecione uma imagem válida.");
        return;
      }

      // Comprime se necessário
      const blob = await compressImage(file);
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const storagePath = `students/${assetId}.${ext}`;

      // Upload para Supabase Storage (bucket posts)
      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(storagePath, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw new Error(uploadError.message);

      // Pega URL pública
      const { data: urlData } = supabase.storage
        .from("posts")
        .getPublicUrl(storagePath);

      const publicUrl = urlData.publicUrl;

      // Atualiza o registro no banco
      const { error: updateError } = await supabase
        .from("assets")
        .update({
          file_url: publicUrl,
          storage_path: storagePath,
          metadata: { has_real_photo: true },
        } as never)
        .eq("id", assetId);

      if (updateError) throw new Error(updateError.message);

      // Atualiza estado local
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId ? { ...a, file_url: publicUrl } : a
        )
      );

      toast.success("Foto atualizada com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Erro ao fazer upload");
    } finally {
      setUploadingAssetId(null);
      setSelectedAssetForUpload(null);
    }
  }, [compressImage, supabase]);

  // Handler para quando arquivo é selecionado
  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAssetForUpload) return;

    void handleUploadPhoto(selectedAssetForUpload.id, file);

    // Reset input para permitir selecionar mesmo arquivo novamente
    e.target.value = "";
  }, [handleUploadPhoto, selectedAssetForUpload]);

  // Abre seletor de arquivo para um asset
  const openFileSelector = useCallback((asset: PhotoAsset) => {
    setSelectedAssetForUpload(asset);
    fileInputRef.current?.click();
  }, []);

  // Fuzzy match: compara nome do arquivo com person_name dos assets
  const fuzzyMatchAsset = useCallback((fileName: string, allAssets: PhotoAsset[]): PhotoAsset | null => {
    // Remove extensão e normaliza
    const baseName = fileName.replace(/\.[^.]+$/, "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    for (const asset of allAssets) {
      if (!asset.person_name) continue;
      const assetName = asset.person_name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      // Match exato
      if (baseName === assetName) return asset;

      // Match parcial (primeiro nome ou primeiro + último)
      const baseTokens = baseName.split(/[\s_-]+/);
      const assetTokens = assetName.split(/\s+/);

      if (baseTokens[0] === assetTokens[0]) {
        // Primeiro nome igual
        if (baseTokens.length === 1 || assetTokens.length === 1) return asset;
        // Último nome também igual
        if (baseTokens[baseTokens.length - 1] === assetTokens[assetTokens.length - 1]) return asset;
      }
    }

    return null;
  }, []);

  // Carrega todos os assets para matching (sem paginação)
  const loadAllAssetsForMatching = useCallback(async (): Promise<PhotoAsset[]> => {
    const response = await getPhotoAssets(brand, 1, 2000, null, "", "alunos");
    return response.rows;
  }, [brand]);

  // Processar arquivos selecionados para upload em lote
  const handleBatchFilesSelected = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (fileArray.length === 0) return;

    setBatchFiles(fileArray);
    setShowBatchUploadModal(true);

    // Carregar todos assets para fazer matching
    const allAssets = await loadAllAssetsForMatching();

    const matches = fileArray.map(file => ({
      file,
      asset: fuzzyMatchAsset(file.name, allAssets),
      confirmed: false,
    }));

    setBatchMatches(matches);
  }, [fuzzyMatchAsset, loadAllAssetsForMatching]);

  // Confirmar upload em lote
  const handleBatchUploadConfirm = useCallback(async () => {
    const toUpload = batchMatches.filter(m => m.asset && m.confirmed);
    if (toUpload.length === 0) {
      toast.error("Nenhum arquivo confirmado para upload.");
      return;
    }

    setIsBatchUploading(true);
    setBatchProgress(0);

    let uploaded = 0;
    for (const match of toUpload) {
      if (!match.asset) continue;
      try {
        await handleUploadPhoto(match.asset.id, match.file);
        uploaded++;
        setBatchProgress(Math.round((uploaded / toUpload.length) * 100));
      } catch (err) {
        console.error(`Erro ao fazer upload de ${match.file.name}:`, err);
      }
    }

    setIsBatchUploading(false);
    setShowBatchUploadModal(false);
    setBatchFiles([]);
    setBatchMatches([]);
    toast.success(`${uploaded} foto(s) enviada(s) com sucesso!`);
    void loadAssets();
  }, [batchMatches, handleUploadPhoto, loadAssets]);

  // Gerar slug para evento
  const generateEventSlug = (name: string): string => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  // Processa drop de pasta ou arquivos no modal de evento
  const handleEventDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setEventDragOver(false);

    const files: File[] = [];
    let folderName: string | null = null;

    // Tenta usar webkitGetAsEntry para detectar pasta
    const items = e.dataTransfer.items;
    let usedWebkitApi = false;

    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const entry = item.webkitGetAsEntry?.();

        if (entry?.isDirectory) {
          usedWebkitApi = true;
          folderName = entry.name;

          // Ler arquivos da pasta
          const dirReader = (entry as FileSystemDirectoryEntry).createReader();
          const readAllEntries = (): Promise<FileSystemEntry[]> => {
            return new Promise((resolve) => {
              const allEntries: FileSystemEntry[] = [];
              const readBatch = () => {
                dirReader.readEntries((entries) => {
                  if (entries.length === 0) {
                    resolve(allEntries);
                  } else {
                    allEntries.push(...entries);
                    readBatch();
                  }
                });
              };
              readBatch();
            });
          };

          try {
            const entries = await readAllEntries();
            for (const fileEntry of entries) {
              if (fileEntry.isFile) {
                const file = await new Promise<File>((resolve, reject) => {
                  (fileEntry as FileSystemFileEntry).file(resolve, reject);
                });
                if (file.type.startsWith("image/")) {
                  files.push(file);
                }
              }
            }
          } catch (err) {
            console.error("Erro ao ler pasta:", err);
          }
        } else if (entry?.isFile) {
          usedWebkitApi = true;
          const file = item.getAsFile();
          if (file?.type.startsWith("image/")) {
            files.push(file);
          }
        }
      }
    }

    // Fallback: usar dataTransfer.files (não detecta nome de pasta)
    if (!usedWebkitApi && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      for (const file of droppedFiles) {
        if (file.type.startsWith("image/")) {
          files.push(file);
        }
      }
      // Tentar extrair nome da pasta do path (se disponível)
      const firstFile = droppedFiles[0];
      if (firstFile && "webkitRelativePath" in firstFile && firstFile.webkitRelativePath) {
        const pathParts = (firstFile.webkitRelativePath as string).split("/");
        if (pathParts.length > 1) {
          folderName = pathParts[0];
        }
      }
    }

    if (files.length > 0) {
      setEventFiles(files);
      if (folderName && !eventName.trim()) {
        setEventName(folderName);
      }
      toast.success(`${files.length} foto(s) carregada(s)`);
    } else {
      toast.error("Nenhuma imagem encontrada");
    }
  }, [eventName]);

  // Upload de evento
  const handleEventUpload = useCallback(async () => {
    if (!eventName.trim()) {
      toast.error("Digite o nome do evento.");
      return;
    }
    if (eventFiles.length === 0) {
      toast.error("Selecione pelo menos uma foto.");
      return;
    }

    setIsEventUploading(true);
    setEventUploadProgress(0);
    setEventUploadedCount(0);
    setEventFailedCount(0);

    // Pega o user ID do usuário autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logado para fazer upload.");
      setIsEventUploading(false);
      return;
    }

    const slug = generateEventSlug(eventName);
    const trimmedName = eventName.trim();

    // Função de upload de cada arquivo
    const uploadSingleFile = async (file: File, index: number) => {
      const blob = await compressImage(file);
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const timestamp = Date.now();
      const storagePath = `events/${slug}/${timestamp}-${index}.${ext}`;

      // Upload para Storage
      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(storagePath, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw new Error(uploadError.message);

      // Pega URL pública
      const { data: urlData } = supabase.storage
        .from("posts")
        .getPublicUrl(storagePath);

      // Insere registro em assets
      const { error: insertError } = await supabase
        .from("assets")
        .insert({
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: blob.size,
          mime_type: "image/jpeg",
          asset_type: "image",
          source: "upload",
          storage_path: storagePath,
          storage_provider: "supabase",
          event_name: trimmedName,
          event_date: eventDate,
          brand: eventBrand,
          is_approved: true,
          uploaded_by: user.id,
        } as never);

      if (insertError) throw new Error(insertError.message);

      return storagePath;
    };

    // Upload paralelo com 5 simultâneos
    const { succeeded, failed } = await uploadFilesInParallel(
      eventFiles,
      uploadSingleFile,
      (completed, failedCount, total) => {
        setEventUploadedCount(completed);
        setEventFailedCount(failedCount);
        setEventUploadProgress(Math.round(((completed + failedCount) / total) * 100));
      },
      5
    );

    setIsEventUploading(false);
    setShowEventUploadModal(false);
    setEventName("");
    setEventFiles([]);

    if (failed > 0) {
      toast.warning(`${succeeded} foto(s) enviada(s), ${failed} falharam.`);
    } else {
      toast.success(`${succeeded} foto(s) do evento enviada(s)!`);
    }

    // Muda para aba de eventos e recarrega
    setAssetsFilterType("eventos");
    void loadGroupedEvents();
  }, [eventName, eventDate, eventBrand, eventFiles, compressImage, supabase, loadGroupedEvents, uploadFilesInParallel]);

  useEffect(() => {
    void loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (assetsFilterType === "eventos") {
      void loadGroupedEvents();
    } else {
      void loadAssets();
    }
  }, [loadAssets, loadGroupedEvents, assetsFilterType]);

  useEffect(() => {
    if (activeTab === "video") {
      void loadVideos();
    }
  }, [activeTab, loadVideos]);

  useEffect(() => {
    setVideoUploadBrand(brand);
  }, [brand]);

  useEffect(() => {
    return () => {
      Object.values(videoPollingTimersRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
      Object.values(clipPollingTimersRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  // Carregar fotos de eventos quando abrir aba Criar
  useEffect(() => {
    if (activeTab === "criar") {
      void loadEventPhotosForNina();
    }
  }, [activeTab, loadEventPhotosForNina, brand]);

  // Handler para abrir detalhes do evento
  const handleOpenEventDetail = useCallback(async (event: GroupedEvent) => {
    setSelectedEvent(event);
    setShowEventDetailModal(true);
    setLoadingEventPhotos(true);
    try {
      const photos = await getEventPhotos(event.event_name, brand);
      setEventDetailPhotos(photos);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar fotos do evento.");
    } finally {
      setLoadingEventPhotos(false);
    }
  }, [brand]);

  // Handler para excluir evento
  const handleDeleteEvent = useCallback(async () => {
    if (!eventToDelete) return;
    setIsDeleting(true);
    try {
      await deleteEvent(eventToDelete.asset_ids, eventToDelete.storage_paths);
      toast.success(`Evento "${eventToDelete.event_name}" excluído!`);
      setEventToDelete(null);
      setShowEventDetailModal(false);
      void loadGroupedEvents();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir evento.");
    } finally {
      setIsDeleting(false);
    }
  }, [eventToDelete, loadGroupedEvents]);

  // Handler para adicionar fotos a evento existente
  const handleAddPhotosToEvent = useCallback(async () => {
    if (!targetEventForPhotos || additionalPhotos.length === 0) return;
    setIsAddingPhotos(true);
    setAddPhotosProgress(0);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logado.");
      setIsAddingPhotos(false);
      return;
    }

    const slug = generateEventSlug(targetEventForPhotos.event_name);
    const eventData = targetEventForPhotos;

    // Função de upload de cada arquivo
    const uploadSingleFile = async (file: File, index: number) => {
      const blob = await compressImage(file);
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const timestamp = Date.now();
      const storagePath = `events/${slug}/${timestamp}-${index}.${ext}`;

      const { error: storageError } = await supabase.storage
        .from("posts")
        .upload(storagePath, blob, { contentType: "image/jpeg", upsert: false });

      if (storageError) throw new Error(storageError.message);

      const { data: urlData } = supabase.storage.from("posts").getPublicUrl(storagePath);

      const { error: insertError } = await supabase.from("assets").insert({
        file_name: file.name,
        file_url: urlData.publicUrl,
        storage_path: storagePath,
        event_name: eventData.event_name,
        event_date: eventData.event_date,
        brand: eventData.brand,
        source: "upload",
        uploaded_by: user.id,
      } as never);

      if (insertError) throw new Error(insertError.message);

      return storagePath;
    };

    // Upload paralelo com 5 simultâneos
    const { succeeded, failed } = await uploadFilesInParallel(
      additionalPhotos,
      uploadSingleFile,
      (completed, failedCount, total) => {
        setAddPhotosProgress(Math.round(((completed + failedCount) / total) * 100));
      },
      5
    );

    setIsAddingPhotos(false);
    setShowAddPhotosModal(false);
    setAdditionalPhotos([]);
    setTargetEventForPhotos(null);

    if (failed > 0) {
      toast.warning(`${succeeded} foto(s) adicionada(s), ${failed} falharam.`);
    } else {
      toast.success(`${succeeded} foto(s) adicionada(s) ao evento!`);
    }

    void loadGroupedEvents();

    // Atualizar a galeria se estiver aberta
    if (selectedEvent && selectedEvent.event_name === eventData.event_name) {
      const photos = await getEventPhotos(eventData.event_name, brand);
      setEventDetailPhotos(photos);
      setSelectedEvent({
        ...selectedEvent,
        photo_count: selectedEvent.photo_count + succeeded,
      });
    }
  }, [targetEventForPhotos, additionalPhotos, supabase, compressImage, loadGroupedEvents, selectedEvent, brand, uploadFilesInParallel]);

  const handleGenerateWithNina = async () => {
    setIsGeneratingWithNina(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke<NinaGenerationResponse>("nina-create-post", {
        body: {
          mode: "brief",
          brand,
          brief: postBrief,
          post_type: postPlatform,
          // Passa foto do evento se selecionada
          event_asset_id: selectedEventPhotoForNina?.id ?? null,
          reference_image_url: selectedEventPhotoForNina?.file_url ?? null,
          event_name: selectedEventPhotoForNina?.event_name ?? null,
        },
      });

      if (fnError) {
        toast.error("Não foi possível gerar com a Nina agora.");
        return;
      }

      const hashtags = Array.isArray(data?.hashtags)
        ? data.hashtags.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : typeof data?.hashtags === "string"
          ? data.hashtags
              .split(/\s+/)
              .filter((item) => item.startsWith("#") && item.trim().length > 1)
          : [];

      let finalImageUrl = data?.image_url ?? null;

      // Se a Nina retornou configuração para criar arte, faz via Canvas no frontend
      if (data?.needs_text_overlay && data?.image_url && data?.text_config?.phrase) {
        try {
          // Determina formato baseado no tipo de post
          const artFormat = postPlatform === "story" ? "story" : "feed";
          console.log("[STUDIO] Creating art via Canvas...", { format: artFormat });
          const imageBlob = await createArtWithCanvas(
            data.image_url,
            data.text_config.phrase,
            data.text_config.brand_name,
            data.text_config.is_kids,
            artFormat
          );

          // Upload da arte final para o Storage
          const fileName = `nina/art-${brand}-${Date.now()}.jpg`;
          const { error: uploadErr } = await supabase.storage
            .from("posts")
            .upload(fileName, imageBlob, { contentType: "image/jpeg", upsert: true });

          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from("posts").getPublicUrl(fileName);
            finalImageUrl = urlData.publicUrl;
            console.log("[STUDIO] Art created successfully:", finalImageUrl);
          } else {
            console.error("[STUDIO] Upload error:", uploadErr);
          }
        } catch (overlayErr) {
          console.error("[STUDIO] Canvas art error:", overlayErr);
          // Continua com a imagem original sem overlay
        }
      }

      setNinaPreviewUrl(finalImageUrl);
      setNinaHashtags(hashtags);
      setNinaGenerationMethod(data?.generation_method ?? null);

      const generatedCaption = [data?.caption?.trim(), hashtags.join(" ")].filter(Boolean).join("\n\n");
      if (generatedCaption) {
        setPostCaption(generatedCaption);
      }

      toast.success("Prévia gerada com sucesso!");
    } catch {
      toast.error("Falha ao gerar conteúdo com a Nina.");
    } finally {
      setIsGeneratingWithNina(false);
    }
  };

  const handlePublishNow = async () => {
    if (!ninaPreviewUrl) {
      toast.info("Gere uma arte com a Nina antes de publicar.");
      return;
    }

    setIsPublishingNow(true);
    try {
      // Obtém o usuário atual (fallback para admin se sessão expirar)
      let userId: string | null = null;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
      } else {
        const { data: admin } = await supabase.from("user_profiles" as never).select("user_id").eq("is_admin", true).limit(1).single();
        userId = (admin as { user_id: string } | null)?.user_id ?? null;
      }
      if (!userId) {
        toast.error("Usuário não autenticado.");
        return;
      }

      // Cria o post com status draft
      // Converte "feed" para "image" (valor aceito pelo enum do banco)
      const dbPostType = postPlatform === "feed" ? "image" : postPlatform;
      const scheduledFor = `${postDate}T${postTime}:00`;
      const { data: postData, error: insertError } = await supabase
        .from("posts")
        .insert({
          title: postBrief.slice(0, 100) || "Post Nina",
          caption: postCaption,
          post_type: dbPostType,
          status: "draft",
          brand,
          scheduled_for: scheduledFor,
          created_by_ai: true,
          created_by: userId,
          ai_agent_name: "Nina",
          metadata: { image_url: ninaPreviewUrl },
        } as never)
        .select("id")
        .single();

      if (insertError || !postData) {
        console.error("[STUDIO] Insert error:", insertError);
        toast.error("Erro ao criar post.");
        return;
      }

      const createdPostId = (postData as { id: string }).id;

      // Insere na fila de publicação
      const { error: queueError } = await supabase
        .from("studio_publish_queue")
        .insert({
          post_id: createdPostId,
          brand,
          scheduled_for: new Date().toISOString(),
          status: "pending",
        } as never);

      if (queueError) {
        console.error("[STUDIO] Queue insert error:", queueError);
        toast.error("Erro ao adicionar à fila de publicação.");
        return;
      }

      // Publica imediatamente
      const { data: publishData, error: fnError } = await supabase.functions.invoke<PublishScheduledPostsResponse>("publish-scheduled-posts", {
        body: { post_id: createdPostId },
      });

      if (fnError) {
        toast.error(getPublishErrorMessage(fnError, publishData ?? undefined) ?? "Não foi possível publicar agora.");
        return;
      }

      if (!publishData?.success || (publishData.published ?? 0) < 1) {
        toast.error(getPublishErrorMessage(null, publishData ?? undefined) ?? "Não foi possível publicar agora.");
        return;
      }

      toast.success("Publicação disparada com sucesso!");
      // Limpa os campos
      setNinaPreviewUrl(null);
      setPostCaption("");
      setPostBrief("");
      setSelectedEventPhotoForNina(null);
      await loadBaseData();
    } catch {
      toast.error("Falha ao publicar agora.");
    } finally {
      setIsPublishingNow(false);
    }
  };

  const handleSchedulePost = async () => {
    if (!ninaPreviewUrl) {
      toast.info("Gere uma arte com a Nina antes de agendar.");
      return;
    }

    // Validação: não permitir agendamento no passado
    const scheduledDate = new Date(`${postDate}T${postTime}:00`);
    const now = new Date();
    if (scheduledDate <= now) {
      toast.error("Não é possível agendar no passado. Escolha um horário futuro.");
      return;
    }

    setIsScheduling(true);
    try {
      // Obtém o usuário atual (fallback para admin)
      let schedUserId: string | null = null;
      const { data: { user: schedUser } } = await supabase.auth.getUser();
      if (schedUser) {
        schedUserId = schedUser.id;
      } else {
        const { data: admin } = await supabase.from("user_profiles" as never).select("user_id").eq("is_admin", true).limit(1).single();
        schedUserId = (admin as { user_id: string } | null)?.user_id ?? null;
      }
      if (!schedUserId) {
        toast.error("Usuário não autenticado.");
        return;
      }

      // Converte "feed" para "image" (valor aceito pelo enum do banco)
      const dbPostType = postPlatform === "feed" ? "image" : postPlatform;
      const scheduledFor = `${postDate}T${postTime}:00`;
      const { data: postData, error: insertError } = await supabase
        .from("posts")
        .insert({
          title: postBrief.slice(0, 100) || "Post Nina",
          caption: postCaption,
          post_type: dbPostType,
          status: "scheduled",
          brand,
          scheduled_for: scheduledFor,
          created_by_ai: true,
          created_by: schedUserId,
          ai_agent_name: "Nina",
          metadata: { image_url: ninaPreviewUrl },
        } as never)
        .select("id")
        .single();

      if (insertError || !postData) {
        console.error("[STUDIO] Schedule error:", insertError);
        toast.error("Erro ao agendar post.");
        return;
      }

      const createdId = (postData as { id: string }).id;

      // Insere na fila de publicação para o horário agendado
      const { error: queueError } = await supabase
        .from("studio_publish_queue")
        .insert({
          post_id: createdId,
          brand,
          scheduled_for: scheduledFor,
          status: "pending",
        } as never);

      if (queueError) {
        console.error("[STUDIO] Queue insert error:", queueError);
        toast.error("Erro ao adicionar à fila.");
        return;
      }

      toast.success(`Post agendado para ${postDate} às ${postTime}!`);
      // Limpa os campos
      setNinaPreviewUrl(null);
      setPostCaption("");
      setPostBrief("");
      setSelectedEventPhotoForNina(null);
      await loadBaseData();
    } catch {
      toast.error("Falha ao agendar post.");
    } finally {
      setIsScheduling(false);
    }
  };

  // Seleciona uma foto aleatória do array
  const handleSelectRandomEventPhoto = useCallback(() => {
    if (eventPhotosForNina.length === 0) return;
    const randomIndex = Math.floor(Math.random() * eventPhotosForNina.length);
    setSelectedEventPhotoForNina(eventPhotosForNina[randomIndex]);
  }, [eventPhotosForNina]);

  // Generate birthday post client-side with Canvas API
  const handleGenerateBirthdayPost = useCallback(async (asset: PhotoAsset) => {
    if (!asset.id) return;

    setBirthdayGenerating((prev) => ({ ...prev, [asset.id]: true }));

    try {
      toast.info(`Gerando post de aniversário para ${asset.person_name}...`);

      const studentName = asset.person_name || "Aluno";
      const nameParts = studentName.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
      const hasRealPhoto = !!(asset.metadata as Record<string, unknown>)?.has_real_photo;
      const photoUrl = hasRealPhoto ? asset.file_url : null;

      // Call Edge Function that uses Gemini to generate birthday image
      const result = await generateBirthdayPost(asset.id, brand);

      if (!result.success || !result.image_url) {
        throw new Error(result.error || "Falha ao gerar post");
      }

      const imageUrl = result.image_url;

      setBirthdayPreview({
        assetId: asset.id,
        imageUrl,
        studentName,
      });
      toast.success("Post gerado com sucesso!");

      // Refresh birthday history
      const birthdaysRes = await getBirthdaysOverview(brand);
      setBirthdays(birthdaysRes.upcoming);
      setBirthdayHistory(birthdaysRes.history);
    } catch (err) {
      toast.error("Erro ao gerar post de aniversário");
      console.error("[BIRTHDAY]", err);
    } finally {
      setBirthdayGenerating((prev) => ({ ...prev, [asset.id]: false }));
    }
  }, [brand]);

  const renderCalendarTab = () => (
    <div className="space-y-4">
      <Card variant="compact" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[160px] border-slate-700 bg-slate-900/70 text-slate-200">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[170px] border-slate-700 bg-slate-900/70 text-slate-200">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[170px] border-slate-700 bg-slate-900/70 text-slate-200">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="story">Story</SelectItem>
              <SelectItem value="image">Feed</SelectItem>
              <SelectItem value="reels">Reels</SelectItem>
              <SelectItem value="carousel">Carrossel</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" onClick={() => setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
              <CaretLeft size={16} />
            </Button>
            <span className="min-w-[160px] text-center text-sm capitalize text-slate-200">{monthLabel}</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
              <CaretRight size={16} />
            </Button>
            <Button variant="primary" size="sm" onClick={() => setActiveTab("criar")}>
              <Sparkle size={14} /> + Novo post
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-7 gap-2 text-xs text-slate-400">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
          <div key={day} className="rounded-lg border border-slate-800 bg-slate-900/40 p-2 text-center font-semibold">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {monthDays.map((day) => {
          const key = day.toISOString().slice(0, 10);
          const dayPosts = postsByDate.get(key) ?? [];
          const inCurrentMonth = day.getMonth() === calendarDate.getMonth();

          return (
            <div key={key} className={cn("min-h-[118px] rounded-xl border p-2", inCurrentMonth ? "border-slate-800 bg-slate-900/60" : "border-slate-900 bg-slate-950/50") }>
              <div className={cn("mb-2 text-xs", inCurrentMonth ? "text-slate-300" : "text-slate-600")}>{day.getDate()}</div>
              <div className="space-y-1">
                {dayPosts.slice(0, 3).map((post) => (
                  <Badge key={post.id} variant="status" color={STATUS_COLORS[post.status]} className="w-full cursor-pointer justify-start rounded-md px-2 py-1 text-[10px] hover:opacity-80" onClick={() => { setSelectedPost(post); setPostModalOpen(true); }}>
                    {post.title?.substring(0, 15) || STATUS_LABELS[post.status]}
                  </Badge>
                ))}
                {dayPosts.length > 3 && <p className="text-[10px] text-slate-500">+{dayPosts.length - 3} posts</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderCreateTab = () => (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_1.5fr_1fr]">
      <Card variant="default" className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-100">Configuração</h3>
        <div className="space-y-3">
          <label className="block text-xs text-slate-400">Marca</label>
          <Select value={brand} onValueChange={(v) => setBrand(v as StudioBrand)}>
            <SelectTrigger className="border-slate-700 bg-slate-900/70 text-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BRAND_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <label className="block text-xs text-slate-400">Plataforma</label>
          <Select value={postPlatform} onValueChange={(v) => setPostPlatform(v as StudioPlatform)}>
            <SelectTrigger className="border-slate-700 bg-slate-900/70 text-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLATFORM_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs text-slate-400">Foto do evento</label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectRandomEventPhoto}
              disabled={eventPhotosForNina.length === 0}
              className="h-6 px-2 text-[11px]"
            >
              <Sparkle size={12} /> Aleatória
            </Button>
          </div>
          {loadingEventPhotosForNina ? (
            <div className="flex h-24 items-center justify-center">
              <SpinnerGap size={20} className="animate-spin text-slate-400" />
            </div>
          ) : eventPhotosForNina.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5">
              {eventPhotosForNina.slice(0, 6).map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setSelectedEventPhotoForNina(photo)}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-lg transition-all",
                    selectedEventPhotoForNina?.id === photo.id
                      ? "ring-2 ring-teal-500 ring-offset-2 ring-offset-slate-900"
                      : "ring-1 ring-slate-700 hover:ring-slate-500"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.file_url}
                    alt={photo.event_name || ""}
                    className="h-full w-full object-cover"
                  />
                  {selectedEventPhotoForNina?.id === photo.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-teal-500/20">
                      <CheckCircle size={24} weight="fill" className="text-teal-400" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Nenhuma foto de evento disponível. Faça upload na aba Banco de Fotos.</p>
          )}
          {selectedEventPhotoForNina && (
            <div className="flex items-center gap-2 rounded-lg border border-teal-500/30 bg-teal-500/10 p-2">
              <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedEventPhotoForNina.file_url} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-200 truncate">{selectedEventPhotoForNina.event_name || "Foto selecionada"}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEventPhotoForNina(null)}
                className="p-1 rounded hover:bg-slate-700"
              >
                <X size={14} className="text-slate-400" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-slate-400">Legenda</label>
          <textarea
            value={postCaption}
            onChange={(e) => setPostCaption(e.target.value)}
            className="min-h-[130px] w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
            placeholder="Legenda editável do post..."
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <DatePicker value={postDate} onChange={setPostDate} placeholder="Data" className="h-10 border-slate-700 bg-slate-900/70" />
          <TimePicker value={postTime} onChange={setPostTime} minuteStep={1} className="h-10" />
        </div>
      </Card>

      <Card variant="default" className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant={creationMode === "nina" ? "primary" : "outline"} size="sm" onClick={() => setCreationMode("nina")}>🤖 Nina cria</Button>
          <Button variant={creationMode === "manual" ? "primary" : "outline"} size="sm" onClick={() => setCreationMode("manual")}>✏ Manual</Button>
        </div>

        <div className="space-y-2">
          <label className="block text-xs text-slate-400">Brief para Nina</label>
          <textarea
            value={postBrief}
            onChange={(e) => setPostBrief(e.target.value)}
            className="min-h-[150px] w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100"
            placeholder="Descreva o estilo da arte e objetivo do post..."
          />
        </div>

        <Button
          variant="primary"
          size="md"
          disabled={isGeneratingWithNina || !postBrief.trim()}
          onClick={() => void handleGenerateWithNina()}
          className="w-full"
        >
          <Sparkle size={14} /> {isGeneratingWithNina ? "Gerando..." : "Gerar com Nina"}
        </Button>

        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4">
          {ninaPreviewUrl ? (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ninaPreviewUrl} alt="Prévia gerada pela Nina" className="max-h-[260px] w-full rounded-lg object-cover" />
              {ninaGenerationMethod ? <p className="text-[11px] text-slate-500">Método: {ninaGenerationMethod}</p> : null}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Preview da arte gerada aparecerá aqui.</p>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isGeneratingWithNina || !postBrief.trim()}
              onClick={() => void handleGenerateWithNina()}
            >
              {isGeneratingWithNina ? <SpinnerGap size={12} className="animate-spin" /> : null}
              Regenerar
            </Button>
            <Button variant="outline" size="sm" disabled>Editar no Canva ↗</Button>
          </div>
        </div>

        {ninaHashtags.length > 0 ? <p className="text-xs text-slate-500">Hashtags: {ninaHashtags.join(" ")}</p> : null}
      </Card>

      <Card variant="default" className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-100">Preview</h3>
        <div
          className={cn(
            "mx-auto overflow-hidden rounded-xl border border-slate-700 bg-gradient-to-b from-cyan-500/10 to-orange-500/10",
            postPlatform === "story" || postPlatform === "reels" ? "aspect-[9/16] w-[180px]" : "aspect-square w-[180px]"
          )}
        >
          {ninaPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ninaPreviewUrl} alt="Preview final do post" className="h-full w-full object-cover" />
          ) : null}
        </div>

        <div className="space-y-2">
          <Button className="w-full" variant="outline" size="sm" disabled>Enviar para aprovação</Button>
          <Button
            className="w-full"
            variant="accent"
            size="sm"
            disabled={isPublishingNow || !ninaPreviewUrl}
            onClick={() => void handlePublishNow()}
          >
            {isPublishingNow ? <SpinnerGap size={14} className="animate-spin" /> : null}
            {isPublishingNow ? "Publicando..." : "Publicar agora"}
          </Button>
          <Button
            className="w-full"
            variant="primary"
            size="sm"
            disabled={isScheduling || !ninaPreviewUrl}
            onClick={() => void handleSchedulePost()}
          >
            {isScheduling ? <SpinnerGap size={14} className="animate-spin" /> : <Clock size={14} />}
            {isScheduling ? "Agendando..." : `Agendar ${postDate} ${postTime}`}
          </Button>
        </div>

        <p className="text-[11px] text-slate-500">
          {ninaPreviewUrl ? "Arte pronta para publicar ou agendar." : "Gere uma arte com a Nina primeiro."}
        </p>
      </Card>
    </div>
  );

  const renderPhotosTab = () => (
    <div className="space-y-4">
      {/* Input file hidden para upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelected}
        className="hidden"
      />

      <Card variant="compact" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro: Alunos / Eventos */}
          <Select value={assetsFilterType} onValueChange={(v) => {
            setAssetsFilterType(v as AssetFilterType);
            setAssetsPage(1);
            setAssetsSearch("");
          }}>
            <SelectTrigger className="w-[130px] border-slate-700 bg-slate-900/70 text-slate-200"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alunos">Alunos</SelectItem>
              <SelectItem value="eventos">Eventos</SelectItem>
            </SelectContent>
          </Select>

          <input
            value={assetsSearch}
            onChange={(e) => {
              setAssetsSearch(e.target.value);
              setAssetsPage(1);
            }}
            className="h-10 min-w-[180px] rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
            placeholder={assetsFilterType === "eventos" ? "Buscar evento..." : "Buscar por nome..."}
          />

          {assetsFilterType === "alunos" && (
            <Select value={assetsOnlyWithPhoto} onValueChange={(v) => {
              setAssetsOnlyWithPhoto(v as "todos" | "com" | "sem");
              setAssetsPage(1);
            }}>
              <SelectTrigger className="w-[130px] border-slate-700 bg-slate-900/70 text-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="com">Com foto</SelectItem>
                <SelectItem value="sem">Sem foto</SelectItem>
              </SelectContent>
            </Select>
          )}

          <div className="ml-auto flex items-center gap-2">
            {assetsFilterType === "alunos" ? (
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => e.target.files && handleBatchFilesSelected(e.target.files)}
                  className="hidden"
                />
                <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-transparent px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800">
                  <Upload size={14} /> Upload em lote
                </span>
              </label>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowEventUploadModal(true)}>
                <Plus size={14} /> Novo evento
              </Button>
            )}
          </div>
        </div>
      </Card>

      {assetsFilterType === "alunos" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {assets.map((asset) => {
            const hasPhoto = Boolean(asset.file_url);
            const isUploading = uploadingAssetId === asset.id;
            return (
              <Card key={asset.id} variant="compact" className="space-y-2 p-3">
                <div className="aspect-square overflow-hidden rounded-lg bg-slate-800">
                  {hasPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.file_url} alt={asset.person_name ?? "Aluno"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-500">
                      <Images size={28} />
                    </div>
                  )}
                </div>
                <p className="line-clamp-1 text-xs font-semibold text-slate-200">{asset.person_name ?? "Sem nome"}</p>
                <Badge variant="neutral" size="sm">{asset.brand === "la_music_kids" ? "Kids" : "School"}</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={isUploading}
                  onClick={() => openFileSelector(asset)}
                >
                  {isUploading ? "Enviando..." : "↑ Trocar"}
                </Button>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Grid de eventos agrupados */
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {groupedEvents.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 py-12">
              <Folder size={48} className="text-slate-600" />
              <p className="text-sm text-slate-400">Nenhum evento cadastrado</p>
              <Button variant="outline" size="sm" onClick={() => setShowEventUploadModal(true)}>
                <Plus size={14} /> Criar primeiro evento
              </Button>
            </div>
          ) : (
            groupedEvents.map((event) => (
              <Card
                key={event.event_name}
                variant="interactive"
                className="group relative space-y-2 p-3 cursor-pointer"
                onClick={() => handleOpenEventDetail(event)}
              >
                {/* Preview Grid - 2x2 collage */}
                <div className="grid grid-cols-2 gap-1 aspect-square overflow-hidden rounded-lg bg-slate-800">
                  {event.preview_photos.slice(0, 4).map((photo) => (
                    <div key={photo.id} className="relative overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.file_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                  {/* Fill empty slots */}
                  {Array.from({ length: Math.max(0, 4 - event.preview_photos.length) }).map((_, i) => (
                    <div key={`empty-${i}`} className="bg-slate-700" />
                  ))}
                </div>

                {/* Event Info */}
                <p className="line-clamp-1 text-sm font-semibold text-slate-200">
                  {event.event_name}
                </p>

                <div className="flex items-center justify-between">
                  <Badge variant="neutral" size="sm">
                    {event.photo_count} foto{event.photo_count !== 1 ? "s" : ""}
                  </Badge>
                  {event.event_date && (
                    <span className="text-[10px] text-slate-500">
                      {new Date(event.event_date).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>

                {/* Hover Actions */}
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTargetEventForPhotos(event);
                      setShowAddPhotosModal(true);
                    }}
                    className="rounded-md bg-slate-800/90 p-1.5 text-slate-300 hover:bg-cyan-500 hover:text-white transition-colors"
                    title="Adicionar fotos"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEventToDelete(event);
                    }}
                    className="rounded-md bg-slate-800/90 p-1.5 text-slate-300 hover:bg-red-500 hover:text-white transition-colors"
                    title="Excluir evento"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-3">
        <p className="text-xs text-slate-400">
          Página {assetsPage} de {assetsFilterType === "eventos" ? eventsPages : assetsPages} · {assetsFilterType === "eventos" ? eventsTotal : assetsTotal} {assetsFilterType === "eventos" ? "eventos" : "registros"}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon-sm" disabled={assetsPage <= 1} onClick={() => setAssetsPage((v) => Math.max(1, v - 1))}><CaretLeft size={16} /></Button>
          <Button variant="ghost" size="icon-sm" disabled={assetsPage >= (assetsFilterType === "eventos" ? eventsPages : assetsPages)} onClick={() => setAssetsPage((v) => Math.min(assetsFilterType === "eventos" ? eventsPages : assetsPages, v + 1))}><CaretRight size={16} /></Button>
        </div>
      </div>

      {/* Event Detail Modal */}
      {showEventDetailModal && selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowEventDetailModal(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-auto rounded-2xl border border-slate-700 bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-5 py-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{selectedEvent.event_name}</h3>
                <p className="text-xs text-slate-400">
                  {selectedEvent.photo_count} foto(s) · {selectedEvent.event_date ? new Date(selectedEvent.event_date).toLocaleDateString("pt-BR") : "Sem data"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTargetEventForPhotos(selectedEvent);
                    setShowAddPhotosModal(true);
                  }}
                >
                  <Plus size={14} /> Adicionar fotos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-400 hover:text-red-300 hover:border-red-400"
                  onClick={() => setEventToDelete(selectedEvent)}
                >
                  <Trash size={14} /> Excluir
                </Button>
                <button
                  onClick={() => setShowEventDetailModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Photo Grid */}
            <div className="p-5">
              {loadingEventPhotos ? (
                <div className="flex items-center justify-center py-12">
                  <SpinnerGap size={32} className="animate-spin text-slate-400" />
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {eventDetailPhotos.map((photo) => (
                    <div key={photo.id} className="aspect-square overflow-hidden rounded-lg bg-slate-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.file_url}
                        alt=""
                        className="h-full w-full object-cover hover:scale-105 transition-transform"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Photos Modal */}
      {showAddPhotosModal && targetEventForPhotos && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            setShowAddPhotosModal(false);
            setAdditionalPhotos([]);
            setTargetEventForPhotos(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <h3 className="text-base font-semibold text-slate-100">
                Adicionar fotos a &quot;{targetEventForPhotos.event_name}&quot;
              </h3>
              <button
                onClick={() => {
                  setShowAddPhotosModal(false);
                  setAdditionalPhotos([]);
                  setTargetEventForPhotos(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* File Input */}
              <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/50 py-8 cursor-pointer hover:border-slate-600 transition-colors">
                <Upload size={32} className="text-slate-400" />
                <span className="text-sm text-slate-300">Clique para selecionar fotos</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      const files = Array.from(e.target.files).filter((f) => f.type.startsWith("image/"));
                      setAdditionalPhotos((prev) => [...prev, ...files]);
                    }
                    e.target.value = "";
                  }}
                  className="hidden"
                />
              </label>

              {/* Selected Files Preview */}
              {additionalPhotos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-slate-300">{additionalPhotos.length} foto(s) selecionada(s)</p>
                  <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto">
                    {additionalPhotos.slice(0, 12).map((file, idx) => (
                      <div key={idx} className="aspect-square rounded-md bg-slate-800 overflow-hidden relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={URL.createObjectURL(file)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <button
                          onClick={() => setAdditionalPhotos((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          <X size={16} className="text-white" />
                        </button>
                      </div>
                    ))}
                    {additionalPhotos.length > 12 && (
                      <div className="aspect-square rounded-md bg-slate-700 flex items-center justify-center">
                        <span className="text-xs text-slate-300">+{additionalPhotos.length - 12}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Progress */}
              {isAddingPhotos && (
                <div className="space-y-2">
                  <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 transition-all"
                      style={{ width: `${addPhotosProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 text-center">{addPhotosProgress}% concluído</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddPhotosModal(false);
                  setAdditionalPhotos([]);
                  setTargetEventForPhotos(null);
                }}
                disabled={isAddingPhotos}
              >
                Cancelar
              </Button>
              <Button
                variant="accent"
                size="sm"
                disabled={isAddingPhotos || additionalPhotos.length === 0}
                onClick={handleAddPhotosToEvent}
              >
                {isAddingPhotos ? (
                  <>
                    <SpinnerGap size={14} className="animate-spin" />
                    Enviando...
                  </>
                ) : (
                  `Adicionar ${additionalPhotos.length} foto(s)`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <AlertDialogContent className="border-slate-700 bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Isso vai excluir permanentemente <strong className="text-slate-200">{eventToDelete?.event_name}</strong> e suas{" "}
              <strong className="text-slate-200">{eventToDelete?.photo_count}</strong> foto(s). Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteEvent}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal Publicar Vídeo Direto */}
      <AlertDialog open={showPublishVideoModal} onOpenChange={(open) => !open && setShowPublishVideoModal(false)}>
        <AlertDialogContent className="border-slate-700 bg-slate-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-100">Publicar vídeo direto</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {selectedVideoForPublish?.title || "Vídeo"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Legenda</label>
              <textarea
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
                rows={3}
                placeholder="Escreva a legenda do post..."
                value={publishVideoCaption}
                onChange={(e) => setPublishVideoCaption(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Marca</label>
                <Select value={publishVideoBrand} onValueChange={(v) => setPublishVideoBrand(v as StudioBrand)}>
                  <SelectTrigger className="border-slate-700 bg-slate-800 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-slate-800">
                    <SelectItem value="la_music_school">LA Music School</SelectItem>
                    <SelectItem value="la_music_kids">LA Music Kids</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Formato</label>
                <Select value={publishVideoFormat} onValueChange={(v) => setPublishVideoFormat(v as "reels" | "story")}>
                  <SelectTrigger className="border-slate-700 bg-slate-800 text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-slate-800">
                    <SelectItem value="reels">Reels</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPublishingVideo} className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isPublishingVideo}
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => void handlePublishVideoDirect()}
            >
              {isPublishingVideo ? "Publicando..." : "Publicar agora"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );

  const renderAutomationsTab = () => {
    // Separar aniversariantes por período
    const today = new Date();
    const todayStr = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const birthdaysToday: PhotoAsset[] = [];
    const birthdaysNext7Days: PhotoAsset[] = [];

    birthdays.forEach((item) => {
      if (!item.birth_date) return;
      const [, month, day] = item.birth_date.split("-");
      const itemStr = `${month}-${day}`;

      if (itemStr === todayStr) {
        birthdaysToday.push(item);
      } else {
        birthdaysNext7Days.push(item);
      }
    });

    const renderBirthdayCard = (item: PhotoAsset, isToday: boolean) => (
      <div key={item.id} className={cn(
        "rounded-lg border p-3",
        isToday ? "border-orange-500/50 bg-orange-500/10" : "border-slate-800 bg-slate-900/50"
      )}>
        <div className="flex items-start gap-3">
          {item.file_url && (
            <img
              src={item.file_url}
              alt={item.person_name || "Foto"}
              className={cn(
                "h-12 w-12 rounded-full object-cover border",
                isToday ? "border-orange-500" : "border-slate-700"
              )}
            />
          )}
          <div className="flex-1">
            <p className="text-sm text-slate-100">{item.person_name ?? "Aluno"}</p>
            <p className="text-xs text-slate-400">
              {item.brand === "la_music_kids" ? "LA Music Kids" : "LA Music School"}
              {item.unit && ` • ${item.unit.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}`}
              {item.birth_date && ` • ${new Date(item.birth_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isToday && (
              <span className="text-xs font-semibold text-orange-400 bg-orange-500/20 px-2 py-0.5 rounded">HOJE</span>
            )}
            {birthdayHistory.some(h => h.student_name === item.person_name && (h.approval_status === "published" || h.approval_status === "auto_published" || h.approval_status === "pending")) && (
              <span className="text-xs font-semibold text-green-400 bg-green-500/20 px-2 py-0.5 rounded">
                {birthdayHistory.find(h => h.student_name === item.person_name)?.approval_status?.includes("publish") ? "PUBLICADO" : "GERADO"}
              </span>
            )}
          </div>
        </div>
        <div className="mt-2 flex gap-2">
          <Button
            variant="accent"
            size="sm"
            onClick={() => handleGenerateBirthdayPost(item)}
            disabled={birthdayGenerating[item.id]}
          >
            {birthdayGenerating[item.id] ? (
              <>
                <SpinnerGap size={14} className="animate-spin mr-1" />
                Gerando...
              </>
            ) : (
              birthdayHistory.some(h => h.student_name === item.person_name) ? "Regenerar" : "Gerar post"
            )}
          </Button>
          {!birthdayHistory.some(h => h.student_name === item.person_name) && (
            <Button variant="outline" size="sm">Pular</Button>
          )}
        </div>
      </div>
    );

    return (
    <div className="space-y-4">
      <div className="flex rounded-xl border border-slate-800 bg-slate-900/60 p-1">
        <button className={cn("flex-1 rounded-lg px-3 py-2 text-sm", automationTab === "aniversarios" ? "bg-slate-800 text-slate-100" : "text-slate-400")} onClick={() => setAutomationTab("aniversarios")}>🎂 Aniversários</button>
        <button className={cn("flex-1 rounded-lg px-3 py-2 text-sm", automationTab === "datas" ? "bg-slate-800 text-slate-100" : "text-slate-400")} onClick={() => setAutomationTab("datas")}>📅 Datas Comemorativas</button>
      </div>

      {automationTab === "aniversarios" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {/* Aniversariantes de HOJE */}
            {birthdaysToday.length > 0 && (
              <Card variant="default" className="space-y-3 border-orange-500/30">
                <h3 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
                  🎉 Hoje ({birthdaysToday.length})
                </h3>
                {birthdaysToday.map((item) => renderBirthdayCard(item, true))}
              </Card>
            )}

            {/* Próximos 7 dias */}
            <Card variant="default" className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-100">Próximos 7 dias</h3>
              {birthdaysNext7Days.length === 0 && birthdaysToday.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum aniversariante para este período.</p>
              ) : birthdaysNext7Days.length === 0 ? (
                <p className="text-sm text-slate-500">Sem aniversariantes nos próximos dias.</p>
              ) : (
                birthdaysNext7Days.map((item) => renderBirthdayCard(item, false))
              )}
            </Card>
          </div>

          <Card variant="default" className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-100">Histórico do mês ({birthdayHistory.length})</h3>
            {birthdayHistory.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum post de aniversário este mês.</p>
            ) : (
              <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1">
              {birthdayHistory.map((row) => {
                const student = birthdays.find(b => b.person_name === row.student_name);
                return (
                <div key={row.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                  {student?.file_url ? (
                    <img src={student.file_url} alt="" className="h-10 w-10 rounded-full object-cover border border-slate-700 flex-shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400 flex-shrink-0">
                      {row.student_name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-100 truncate">{row.student_name}</p>
                    <p className="text-xs text-slate-500">
                      {row.brand === "la_music_kids" ? "LA Music Kids" : "LA Music School"}
                      {student?.unit && ` • ${student.unit.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}`}
                      {` • ${new Date(row.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                  </div>
                  <Badge variant="status" color={row.approval_status.includes("publish") ? "#22C55E" : row.approval_status === "pending" ? "#F59E0B" : "#94A3B8"}>
                    {row.approval_status.includes("publish") ? "Publicado" : row.approval_status === "pending" ? "Pendente" : row.approval_status}
                  </Badge>
                </div>
                );
              })}
              </div>
            )}
          </Card>
        </div>
      ) : (() => {
        // Helper: days until next occurrence
        const getDaysUntil = (month: number, day: number) => {
          const now = new Date();
          const thisYear = now.getFullYear();
          let next = new Date(thisYear, month - 1, day);
          if (next < now) next = new Date(thisYear + 1, month - 1, day);
          return Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        };

        // Helper: proximity badge
        const getProximityBadge = (days: number) => {
          if (days === 0) return { text: "HOJE", color: "bg-red-500/20 text-red-400 border-red-500/30" };
          if (days === 1) return { text: "AMANHÃ", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" };
          if (days <= 7) return { text: `EM ${days}D`, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
          if (days <= 30) return { text: `EM ${days}D`, color: "bg-slate-700 text-slate-300 border-slate-600" };
          return { text: `${Math.ceil(days / 7)}SEM`, color: "bg-slate-800 text-slate-500 border-slate-700" };
        };

        // Helper: category icon
        const getCategoryIcon = (cat: string) => {
          if (cat === "music") return <MusicNote size={16} weight="duotone" className="text-cyan-400" />;
          if (cat === "kids") return <Baby size={16} weight="duotone" className="text-pink-400" />;
          return <Confetti size={16} weight="duotone" className="text-yellow-400" />;
        };

        // Helper: status badge
        const getStatusBadge = (status: string) => {
          const map: Record<string, { label: string; cls: string }> = {
            pending: { label: "Pendente", cls: "bg-slate-700 text-slate-300" },
            in_progress: { label: "Em progresso", cls: "bg-cyan-500/20 text-cyan-400" },
            ready: { label: "Pronto", cls: "bg-green-500/20 text-green-400" },
            published: { label: "Publicado", cls: "bg-emerald-500/20 text-emerald-400" },
            skipped: { label: "Pulado", cls: "bg-slate-800 text-slate-500" },
          };
          const s = map[status] || map.pending;
          return <span className={cn("px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded", s.cls)}>{s.label}</span>;
        };

        // Helper: assigned badge
        const getAssignedBadge = (assigned: string) => {
          if (assigned === "nina") return <span className="flex items-center gap-1 text-xs text-cyan-400"><Robot size={12} /> Nina</span>;
          return <span className="flex items-center gap-1 text-xs text-slate-400"><User size={12} /> {assigned.charAt(0).toUpperCase() + assigned.slice(1)}</span>;
        };

        const MONTHS_PT = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

        // Filter & sort
        const filteredCommDates = commemorativeDates.filter(d => {
          if (commDateFilter.category !== "all" && d.category !== commDateFilter.category) return false;
          if (commDateFilter.assigned !== "all" && d.assigned_to !== commDateFilter.assigned) return false;
          if (commDateFilter.status !== "all" && d.content_status !== commDateFilter.status) return false;
          return true;
        });

        const sortedCommDates = [...filteredCommDates].map(d => ({
          ...d,
          _daysUntil: getDaysUntil(d.date_month, d.date_day),
        })).sort((a, b) => a._daysUntil - b._daysUntil);

        const thisWeekDates = sortedCommDates.filter(d => d._daysUntil <= 7);
        const next30Dates = sortedCommDates.filter(d => d._daysUntil > 7 && d._daysUntil <= 30);

        // Group all by month for calendar view
        const byMonth = new Map<number, typeof sortedCommDates>();
        for (const d of sortedCommDates) {
          const arr = byMonth.get(d.date_month) || [];
          arr.push(d);
          byMonth.set(d.date_month, arr);
        }

        // Render a single date card
        const renderCommDateCard = (d: CommemorativeDateItem & { _daysUntil: number }, compact = false) => {
          const badge = getProximityBadge(d._daysUntil);
          return (
            <div key={d.id} className={cn(
              "flex flex-wrap items-center gap-2 rounded-lg border p-2.5",
              d._daysUntil === 0 ? "border-red-500/40 bg-red-500/5" :
              d._daysUntil <= 7 ? "border-orange-500/30 bg-orange-500/5" : "border-slate-800 bg-slate-900/50"
            )}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {getCategoryIcon(d.category)}
                <div className="min-w-0">
                  <p className={cn("font-medium truncate", compact ? "text-xs text-slate-200" : "text-sm text-slate-100")}>{d.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {String(d.date_day).padStart(2, "0")}/{String(d.date_month).padStart(2, "0")}
                    {d.brand !== "both" && ` • ${d.brand === "la_music_kids" ? "Kids" : "School"}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={cn("px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded border", badge.color)}>{badge.text}</span>
                {!compact && getStatusBadge(d.content_status)}
                {!compact && getAssignedBadge(d.assigned_to)}
                <button onClick={() => {
                  const brief = d.caption_hint || d.post_idea || d.name;
                  setPostBrief(`${d.name}: ${brief}`);
                  setActiveTab("criar");
                }} className="px-2 py-1 text-[11px] font-medium rounded bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30">
                  Criar post
                </button>
                <button onClick={() => { setCommDateEditing(d); setCommDateModalOpen(true); }}
                  className="p-1 text-slate-500 hover:text-slate-200"><Pencil size={14} /></button>
                <button onClick={async () => {
                  if (!confirm("Remover esta data comemorativa?")) return;
                  try {
                    await deleteCommemorativeDate(d.id);
                    setCommemorativeDates(prev => prev.filter(x => x.id !== d.id));
                    toast.success("Data removida");
                  } catch { toast.error("Erro ao remover"); }
                }} className="p-1 text-slate-500 hover:text-red-400"><Trash size={14} /></button>
              </div>
            </div>
          );
        };

        return (
          <div className="space-y-4">
            {/* Header + Add button */}
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100 mr-auto">Datas Comemorativas ({filteredCommDates.length})</h3>
              <button
                onClick={() => { setCommDateEditing(null); setCommDateModalOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
              >
                <Plus size={14} /> Nova Data
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
              {[{label:"Todos",val:"all"},{label:"Música",val:"music"},{label:"Geral",val:"general"},{label:"Kids",val:"kids"}].map(f => (
                <button key={f.val} onClick={() => setCommDateFilter(p => ({...p, category: f.val}))}
                  className={cn("px-2.5 py-1 text-xs rounded-lg", commDateFilter.category === f.val ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-slate-800 text-slate-400 hover:text-slate-200")}>
                  {f.label}
                </button>
              ))}
              <div className="w-px h-5 bg-slate-700 self-center" />
              {[{label:"Todos",val:"all"},{label:"Nina",val:"nina"},{label:"John",val:"john"},{label:"Yuri",val:"yuri"}].map(f => (
                <button key={f.val} onClick={() => setCommDateFilter(p => ({...p, assigned: f.val}))}
                  className={cn("px-2.5 py-1 text-xs rounded-lg", commDateFilter.assigned === f.val ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "bg-slate-800 text-slate-400 hover:text-slate-200")}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* This Week section */}
            {thisWeekDates.length > 0 && (
              <Card variant="default" className="space-y-2 border-orange-500/30">
                <h4 className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Esta Semana ({thisWeekDates.length})</h4>
                {thisWeekDates.map(d => renderCommDateCard(d))}
              </Card>
            )}

            {/* Next 30 days */}
            {next30Dates.length > 0 && (
              <Card variant="default" className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Próximos 30 Dias ({next30Dates.length})</h4>
                {next30Dates.map(d => renderCommDateCard(d))}
              </Card>
            )}

            {/* Annual Calendar grouped by month */}
            <Card variant="default" className="space-y-1">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Calendário Anual</h4>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                const dates = byMonth.get(month) || [];
                if (dates.length === 0) return null;
                const expanded = commDateExpandedMonths.has(month);
                return (
                  <div key={month}>
                    <button
                      onClick={() => setCommDateExpandedMonths(prev => {
                        const next = new Set(prev);
                        if (next.has(month)) next.delete(month); else next.add(month);
                        return next;
                      })}
                      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800/50 rounded-lg transition-colors"
                    >
                      {expanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
                      <span className="font-bold text-slate-200">{MONTHS_PT[month - 1]}</span>
                      <span className="text-slate-500">({dates.length})</span>
                    </button>
                    {expanded && (
                      <div className="pl-6 space-y-1 pb-2">
                        {dates.map(d => renderCommDateCard(d, true))}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>

            {filteredCommDates.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                Nenhuma data encontrada com os filtros selecionados.
              </div>
            )}
          </div>
        );
      })()}
    </div>
    );
  };

  const renderPerformanceTab = () => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card variant="compact">
          <p className="text-xs text-slate-400">Alcance</p>
          <p className="mt-1 text-2xl font-bold text-slate-100">{metrics.alcance.toLocaleString("pt-BR")}</p>
        </Card>
        <Card variant="compact">
          <p className="text-xs text-slate-400">Engajamento</p>
          <p className="mt-1 text-2xl font-bold text-slate-100">{metrics.engajamento.toLocaleString("pt-BR")}</p>
        </Card>
        <Card variant="compact">
          <p className="text-xs text-slate-400">Taxa de engajamento</p>
          <p className="mt-1 text-2xl font-bold text-slate-100">{metrics.taxaEngajamento.toFixed(2)}%</p>
        </Card>
        <Card variant="compact">
          <p className="text-xs text-slate-400">Posts publicados</p>
          <p className="mt-1 text-2xl font-bold text-slate-100">{metrics.publicados}</p>
        </Card>
      </div>

      <Card variant="default" className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">Posts recentes</h3>
        <div className="space-y-2">
          {posts.slice(0, 10).map((post) => (
            <div key={post.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <div>
                <p className="text-sm text-slate-100">{post.title}</p>
                <p className="text-xs text-slate-500">{post.brand} • {post.post_type}</p>
              </div>
              <Badge variant="status" color={STATUS_COLORS[post.status]}>{STATUS_LABELS[post.status]}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderConnectionsTab = () => (
    <Card variant="default" className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-100">Conexões</h3>
      {integrations.length === 0 ? (
        <p className="text-sm text-slate-500">Sem acesso às integrações para este perfil.</p>
      ) : (
        integrations.map((item) => {
          const status = getIntegrationStatus(item);
          return (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 p-3">
              <div>
                <p className="text-sm text-slate-100">{item.integration_name}</p>
                <p className="text-xs text-slate-500">{status.detail}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="status" color={status.color}>{status.label}</Badge>
                <Button variant="outline" size="sm">Reconectar</Button>
              </div>
            </div>
          );
        })
      )}
    </Card>
  );

  return (
    <>
      <Header title="Nina Studio" subtitle="Estúdio IA">
        <Select value={brand} onValueChange={(v) => setBrand(v as StudioBrand)}>
          <SelectTrigger className="w-[180px] border-slate-700 bg-slate-900/70 text-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BRAND_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Badge variant="status" color={ninaConfig?.is_enabled ? "#22C55E" : "#64748B"}>
          <span className="inline-flex items-center gap-1">
            {ninaConfig?.is_enabled ? <CheckCircle size={12} /> : <Warning size={12} />} Nina {ninaConfig?.is_enabled ? "ativa" : "pausada"}
          </span>
        </Badge>

        <Button variant="primary" size="sm" onClick={() => setActiveTab("criar")}>
          <Sparkle size={14} /> Criar agora
        </Button>

        <Badge variant="status" color={pendingApprovals > 0 ? "#F59E0B" : "#22C55E"}>
          <Bell size={12} /> {pendingApprovals} aprovações pendentes
        </Badge>
      </Header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-5">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-1 md:grid-cols-7">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    active ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  )}
                >
                  <Icon size={15} /> {tab.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <Card variant="default" className="flex items-center gap-3">
              <Clock size={16} className="animate-pulse text-cyan-400" />
              <p className="text-sm text-slate-300">Carregando dados do Studio...</p>
            </Card>
          ) : error ? (
            <Card variant="default" className="flex items-center gap-3 border-orange-500/30">
              <Warning size={16} className="text-orange-400" />
              <p className="text-sm text-orange-200">{error}</p>
            </Card>
          ) : null}

          {activeTab === "calendario" && renderCalendarTab()}
          {activeTab === "criar" && renderCreateTab()}
          {activeTab === "banco" && renderPhotosTab()}
          {activeTab === "video" && renderVideoTab()}
          {activeTab === "automacoes" && renderAutomationsTab()}
          {activeTab === "performance" && renderPerformanceTab()}
          {activeTab === "conexoes" && renderConnectionsTab()}
        </div>
      </div>

      {/* Modal: Upload em lote de alunos */}
      {showBatchUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <h3 className="text-base font-semibold text-slate-100">Upload em lote - Alunos</h3>
              <button onClick={() => { setShowBatchUploadModal(false); setBatchFiles([]); setBatchMatches([]); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-5">
              {batchMatches.length === 0 ? (
                <p className="text-sm text-slate-400">Processando arquivos...</p>
              ) : (
                <div className="space-y-2">
                  <p className="mb-3 text-xs text-slate-500">{batchMatches.length} arquivo(s) · Clique em "Confirmar" nos que deseja enviar</p>
                  {batchMatches.map((match, idx) => (
                    <div key={idx} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <div className="h-12 w-12 overflow-hidden rounded bg-slate-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={URL.createObjectURL(match.file)} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-200">{match.file.name}</p>
                        {match.asset ? (
                          <p className="text-xs text-cyan-400">→ {match.asset.person_name}</p>
                        ) : (
                          <p className="text-xs text-orange-400">Nenhum aluno encontrado</p>
                        )}
                      </div>
                      {match.asset && (
                        <Button
                          variant={match.confirmed ? "accent" : "outline"}
                          size="sm"
                          onClick={() => setBatchMatches(prev => prev.map((m, i) => i === idx ? { ...m, confirmed: !m.confirmed } : m))}
                        >
                          {match.confirmed ? <CheckCircle size={14} /> : null} {match.confirmed ? "Confirmado" : "Confirmar"}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
              {isBatchUploading ? (
                <div className="flex items-center gap-2">
                  <SpinnerGap size={16} className="animate-spin text-cyan-400" />
                  <span className="text-sm text-slate-300">{batchProgress}%</span>
                </div>
              ) : (
                <p className="text-xs text-slate-500">{batchMatches.filter(m => m.confirmed).length} confirmado(s)</p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={isBatchUploading} onClick={() => { setShowBatchUploadModal(false); setBatchFiles([]); setBatchMatches([]); }}>
                  Cancelar
                </Button>
                <Button variant="accent" size="sm" disabled={isBatchUploading || batchMatches.filter(m => m.confirmed).length === 0} onClick={() => void handleBatchUploadConfirm()}>
                  {isBatchUploading ? "Enviando..." : "Enviar confirmados"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Upload de evento */}
      {showEventUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <h3 className="text-base font-semibold text-slate-100">Novo evento</h3>
              <button onClick={() => { setShowEventUploadModal(false); setEventName(""); setEventFiles([]); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Nome do evento</label>
                <input
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Ex: LA All Stars Rock in Rio"
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-sm text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Data</label>
                  <DatePicker
                    value={eventDate}
                    onChange={setEventDate}
                    placeholder="Selecione a data"
                    className="h-10 border-slate-700 bg-slate-900/70"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Marca</label>
                  <Select value={eventBrand} onValueChange={(v) => setEventBrand(v as StudioBrand)}>
                    <SelectTrigger className="h-10 border-slate-700 bg-slate-900/70 text-slate-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="la_music_school">LA Music School</SelectItem>
                      <SelectItem value="la_music_kids">LA Music Kids</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Fotos do evento</label>
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/40 py-6">
                  <Folder size={32} className="text-slate-500" />
                  <span className="text-sm text-slate-400">Selecione uma pasta ou arquivos</span>
                  <div className="flex gap-2">
                    <label className="cursor-pointer rounded-lg border border-cyan-500 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-400 hover:bg-cyan-500/20">
                      Selecionar pasta
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        // @ts-expect-error webkitdirectory is not in types
                        webkitdirectory=""
                        onChange={(e) => {
                          const files = e.target.files;
                          if (!files || files.length === 0) return;
                          const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
                          if (imageFiles.length === 0) {
                            toast.error("Nenhuma imagem encontrada na pasta");
                            return;
                          }
                          setEventFiles(imageFiles);
                          // Extrair nome da pasta do path
                          const firstPath = imageFiles[0].webkitRelativePath;
                          if (firstPath && !eventName.trim()) {
                            const folderName = firstPath.split("/")[0];
                            setEventName(folderName);
                          }
                          toast.success(`${imageFiles.length} foto(s) carregada(s)`);
                        }}
                        className="hidden"
                      />
                    </label>
                    <label className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs text-slate-300 hover:bg-slate-700">
                      Selecionar arquivos
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = e.target.files;
                          if (!files || files.length === 0) return;
                          const imageFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
                          setEventFiles(imageFiles);
                          toast.success(`${imageFiles.length} foto(s) carregada(s)`);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
                {eventFiles.length > 0 && (
                  <p className="mt-2 text-xs text-cyan-400">{eventFiles.length} foto(s) selecionada(s)</p>
                )}
              </div>
            </div>

            {isEventUploading && (
              <div className="px-5 pb-3 space-y-2">
                <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all duration-300"
                    style={{ width: `${eventUploadProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">
                    {eventUploadedCount + eventFailedCount} de {eventFiles.length} fotos
                  </span>
                  <span className="text-slate-400">
                    {eventUploadedCount} enviadas{eventFailedCount > 0 && <span className="text-red-400"> · {eventFailedCount} falhas</span>}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
              {isEventUploading ? (
                <div className="flex items-center gap-2">
                  <SpinnerGap size={16} className="animate-spin text-cyan-400" />
                  <span className="text-sm text-slate-300">Enviando em paralelo...</span>
                </div>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={isEventUploading} onClick={() => { setShowEventUploadModal(false); setEventName(""); setEventFiles([]); }}>
                  Cancelar
                </Button>
                <Button variant="accent" size="sm" disabled={isEventUploading || !eventName.trim() || eventFiles.length === 0} onClick={() => void handleEventUpload()}>
                  {isEventUploading ? "Enviando..." : "Criar evento"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Publicar Clipe (Reels / Stories) */}
      <Dialog open={clipPublishModal.open} onOpenChange={(open) => !open && setClipPublishModal(prev => ({ ...prev, open: false }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Publicar Clipe no Instagram</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground truncate">
              {clipPublishModal.clip?.title || 'Sem título'}
            </p>

            {/* Seletor Reels / Stories */}
            <div>
              <label className="text-sm font-medium mb-2 block">Formato</label>
              <div className="flex gap-2">
                <Button
                  variant={clipPublishModal.format === 'REELS' ? 'accent' : 'outline'}
                  onClick={() => setClipPublishModal(prev => ({ ...prev, format: 'REELS' }))}
                  className="flex-1"
                >
                  🎬 Reels
                </Button>
                <Button
                  variant={clipPublishModal.format === 'STORIES' ? 'accent' : 'outline'}
                  onClick={() => setClipPublishModal(prev => ({ ...prev, format: 'STORIES' }))}
                  className="flex-1"
                >
                  📱 Stories
                </Button>
              </div>
            </div>

            {clipPublishModal.format === 'STORIES' && (
              <p className="text-xs text-muted-foreground">
                ⚠️ Stories não exibem legenda
              </p>
            )}

            {clipPublishModal.error && (
              <p className="text-sm text-destructive">{clipPublishModal.error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClipPublishModal(prev => ({ ...prev, open: false }))}
              disabled={clipPublishModal.isPublishing}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void publishClipWithFormat()}
              disabled={clipPublishModal.isPublishing}
            >
              {clipPublishModal.isPublishing ? 'Publicando...' : `Publicar como ${clipPublishModal.format === 'REELS' ? 'Reels' : 'Stories'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Preview de Clipe - no nível principal para funcionar em qualquer tab */}
      <Dialog open={!!previewClip} onOpenChange={() => setPreviewClip(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden bg-black border-slate-700">
          <DialogHeader className="p-3 bg-slate-900">
            <DialogTitle className="text-white text-sm truncate">{previewClip?.title}</DialogTitle>
          </DialogHeader>
          <video
            src={previewClip?.url}
            controls
            autoPlay
            playsInline
            className="w-full"
            style={{ aspectRatio: "9/16", maxHeight: "70vh" }}
          />
        </DialogContent>
      </Dialog>

      {/* Modal Preview de Post de Aniversário */}
      <Dialog open={!!birthdayPreview} onOpenChange={(open) => !open && !birthdayPublishing && setBirthdayPreview(null)}>
        <DialogContent className="max-w-xs border-slate-700 bg-slate-900 max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-slate-100 text-sm">
              Aniversário - {birthdayPreview?.studentName}
            </DialogTitle>
          </DialogHeader>

          {birthdayPreview && (
            <div className="flex-1 overflow-hidden space-y-3">
              {/* Preview da imagem */}
              <div className="relative rounded-lg overflow-hidden border border-slate-700 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={birthdayPreview.imageUrl}
                  alt={`Post de aniversário de ${birthdayPreview.studentName}`}
                  className="w-full object-contain"
                  style={{ maxHeight: "55vh" }}
                />
                {/* Botão trocar foto (overlay) */}
                <button
                  type="button"
                  disabled={birthdayUploadingPhoto || birthdayPublishing}
                  onClick={() => birthdayPhotoInputRef.current?.click()}
                  className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-black/70 text-white hover:bg-black/90 transition-colors backdrop-blur-sm"
                >
                  {birthdayUploadingPhoto ? (
                    <SpinnerGap size={14} className="animate-spin" />
                  ) : (
                    <Camera size={14} weight="bold" />
                  )}
                  {birthdayUploadingPhoto ? "Trocando..." : "Trocar foto"}
                </button>
                <input
                  ref={birthdayPhotoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !birthdayPreview) return;

                    // Validar
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("Arquivo muito grande. Máximo 5MB.");
                      return;
                    }

                    setBirthdayUploadingPhoto(true);
                    try {
                      const ext = file.name.split(".").pop() || "jpg";
                      const storagePath = `alunos/${brand}/${birthdayPreview.assetId}.${ext}`;

                      // Upload para storage
                      const { error: uploadErr } = await supabase.storage
                        .from("assets")
                        .upload(storagePath, file, { upsert: true, contentType: file.type });

                      if (uploadErr) throw uploadErr;

                      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(storagePath);
                      const newPhotoUrl = urlData.publicUrl;

                      // Atualizar asset no banco
                      await supabase
                        .from("assets" as never)
                        .update({ file_url: newPhotoUrl, metadata: { active: true, has_real_photo: true, source: "la_music_report", synced_at: new Date().toISOString() } } as never)
                        .eq("id", birthdayPreview.assetId);

                      toast.success("Foto atualizada! Regenerando post...");

                      // Regenerar post com nova foto
                      const result = await generateBirthdayPost(birthdayPreview.assetId, brand);
                      if (result.success && result.image_url) {
                        setBirthdayPreview({
                          ...birthdayPreview,
                          imageUrl: result.image_url,
                        });
                        toast.success("Post regenerado com a nova foto!");
                      } else {
                        toast.error(result.error || "Erro ao regenerar post");
                      }
                    } catch (err) {
                      console.error("[BIRTHDAY_PHOTO]", err);
                      toast.error("Erro ao trocar foto");
                    } finally {
                      setBirthdayUploadingPhoto(false);
                      // Reset input
                      if (birthdayPhotoInputRef.current) birthdayPhotoInputRef.current.value = "";
                    }
                  }}
                />
              </div>

              {/* Info */}
              <p className="text-xs text-slate-400">
                Stories: @{brand === "la_music_kids" ? "lamusickids" : "lamusicschool"}
              </p>
            </div>
          )}

          <DialogFooter className="flex-shrink-0 gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBirthdayPreview(null)}
              disabled={birthdayPublishing}
            >
              Descartar
            </Button>
            <Button
              variant="accent"
              size="sm"
              disabled={birthdayPublishing}
              onClick={async () => {
                if (!birthdayPreview) return;

                setBirthdayPublishing(true);
                toast.info("Publicando no Stories...");

                try {
                  const result = await publishBirthdayStory(
                    birthdayPreview.imageUrl,
                    brand,
                    birthdayPreview.studentName
                  );

                  if (result.success) {
                    toast.success(`Story publicado! @${brand === "la_music_kids" ? "lamusickids" : "lamusicschool"}`);
                    setBirthdayPreview(null);

                    // Refresh birthday history
                    const birthdaysRes = await getBirthdaysOverview(brand);
                    setBirthdays(birthdaysRes.upcoming);
                    setBirthdayHistory(birthdaysRes.history);
                  } else {
                    toast.error(result.error || "Erro ao publicar");
                  }
                } catch (err) {
                  toast.error("Erro ao publicar story");
                  console.error("[PUBLISH_STORY]", err);
                } finally {
                  setBirthdayPublishing(false);
                }
              }}
            >
              {birthdayPublishing ? (
                <>
                  <SpinnerGap size={14} className="animate-spin mr-1" />
                  Publicando...
                </>
              ) : (
                "Publicar Story"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Data Comemorativa */}
      <Dialog open={commDateModalOpen} onOpenChange={(open) => {
        if (!commDateSaving) {
          setCommDateModalOpen(open);
          if (open && !commDateEditing) {
            setCommForm({ name: "", date_day: 1, date_month: 1, category: "music", brand: "both", post_type: "story", assigned_to: "nina", auto_generate: false, days_advance: 7, caption_hint: "", post_idea: "", hashtags: "" });
          } else if (open && commDateEditing) {
            setCommForm({ name: commDateEditing.name, date_day: commDateEditing.date_day, date_month: commDateEditing.date_month, category: commDateEditing.category || "music", brand: commDateEditing.brand || "both", post_type: commDateEditing.post_type || "story", assigned_to: commDateEditing.assigned_to || "nina", auto_generate: commDateEditing.auto_generate || false, days_advance: commDateEditing.days_advance || 7, caption_hint: commDateEditing.caption_hint || "", post_idea: commDateEditing.post_idea || "", hashtags: (commDateEditing.hashtags || []).join(" ") });
          }
        }
      }}>
        <DialogContent className="max-w-md border-slate-700 bg-slate-900 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {commDateEditing ? "Editar Data" : "Nova Data Comemorativa"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Nome</label>
              <input value={commForm.name} onChange={e => setCommForm(p => ({ ...p, name: e.target.value }))} placeholder="Dia do Guitarrista" className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900/50 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Dia</label>
                <Select value={String(commForm.date_day)} onValueChange={v => setCommForm(p => ({ ...p, date_day: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from({length:31},(_,i)=>i+1).map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Mês</label>
                <Select value={String(commForm.date_month)} onValueChange={v => setCommForm(p => ({ ...p, date_month: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((m,i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Categoria</label>
                <Select value={commForm.category} onValueChange={v => setCommForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="music">Música</SelectItem>
                    <SelectItem value="general">Geral</SelectItem>
                    <SelectItem value="kids">Kids</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Marca</label>
                <Select value={commForm.brand} onValueChange={v => setCommForm(p => ({ ...p, brand: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Ambas</SelectItem>
                    <SelectItem value="la_music_school">LA Music School</SelectItem>
                    <SelectItem value="la_music_kids">LA Music Kids</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Tipo de Post</label>
                <Select value={commForm.post_type} onValueChange={v => setCommForm(p => ({ ...p, post_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="story">Story</SelectItem>
                    <SelectItem value="feed">Feed</SelectItem>
                    <SelectItem value="carousel">Carrossel</SelectItem>
                    <SelectItem value="reels">Reels</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">Responsável</label>
                <Select value={commForm.assigned_to} onValueChange={v => setCommForm(p => ({ ...p, assigned_to: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nina">Nina (IA)</SelectItem>
                    <SelectItem value="john">John</SelectItem>
                    <SelectItem value="yuri">Yuri</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">Auto-gerar com Nina</label>
              <Switch checked={commForm.auto_generate} onCheckedChange={v => setCommForm(p => ({ ...p, auto_generate: v }))} />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Alertar com antecedência (dias)</label>
              <input type="number" min={1} max={90} value={commForm.days_advance} onChange={e => setCommForm(p => ({ ...p, days_advance: Number(e.target.value) || 7 }))} className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900/50 border border-slate-700 text-slate-200" />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Dica de legenda</label>
              <textarea rows={2} value={commForm.caption_hint} onChange={e => setCommForm(p => ({ ...p, caption_hint: e.target.value }))} placeholder="Ex: Celebre os guitarristas..." className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900/50 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50" />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Ideia de post</label>
              <textarea rows={2} value={commForm.post_idea} onChange={e => setCommForm(p => ({ ...p, post_idea: e.target.value }))} placeholder="Ex: Foto de aluno tocando guitarra..." className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900/50 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50" />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Hashtags</label>
              <input value={commForm.hashtags} onChange={e => setCommForm(p => ({ ...p, hashtags: e.target.value }))} placeholder="#diadoguitarrista #musica" className="w-full px-3 py-2 text-sm rounded-lg bg-slate-900/50 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setCommDateModalOpen(false); setCommDateEditing(null); }} disabled={commDateSaving}>Cancelar</Button>
              <Button type="button" variant="primary" size="sm" disabled={commDateSaving || !commForm.name} onClick={async () => {
                const payload = {
                  name: commForm.name,
                  date_day: commForm.date_day,
                  date_month: commForm.date_month,
                  category: commForm.category,
                  brand: commForm.brand,
                  post_type: commForm.post_type,
                  assigned_to: commForm.assigned_to,
                  auto_generate: commForm.auto_generate,
                  days_advance: commForm.days_advance,
                  caption_hint: commForm.caption_hint || null,
                  post_idea: commForm.post_idea || null,
                  description: null,
                  hashtags: commForm.hashtags.split(/[,\s]+/).filter(Boolean),
                  content_status: commDateEditing?.content_status || "pending",
                  is_active: true,
                };
                setCommDateSaving(true);
                try {
                  if (commDateEditing) {
                    await updateCommemorativeDate(commDateEditing.id, payload);
                    setCommemorativeDates(prev => prev.map(d => d.id === commDateEditing.id ? { ...d, ...payload } : d));
                    toast.success("Data atualizada!");
                  } else {
                    const created = await addCommemorativeDate(payload);
                    setCommemorativeDates(prev => [...prev, created]);
                    toast.success("Data adicionada!");
                  }
                  setCommDateModalOpen(false);
                  setCommDateEditing(null);
                } catch (err) {
                  toast.error("Erro ao salvar");
                  console.error(err);
                } finally {
                  setCommDateSaving(false);
                }
              }}>
                {commDateSaving ? <SpinnerGap size={14} className="animate-spin mr-1" /> : null}
                {commDateSaving ? "Salvando..." : commDateEditing ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post Detail/Edit Modal — CRUD completo */}
      <Dialog open={postModalOpen} onOpenChange={(open) => { setPostModalOpen(open); if (!open) { setSelectedPost(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{selectedPost?.title || "Detalhes do Post"}</DialogTitle>
          </DialogHeader>
          {selectedPost && (() => {
            const imgUrl = selectedPost.metadata?.image_url;
            const [editBrand, setEditBrand] = [selectedPost.brand, (v: string) => setSelectedPost(prev => prev ? { ...prev, brand: v as StudioBrand } : prev)];
            const [editPostType, setEditPostType] = [selectedPost.post_type, (v: string) => setSelectedPost(prev => prev ? { ...prev, post_type: v } : prev)];
            const [editDate, setEditDate] = [selectedPost.scheduled_for?.substring(0, 10) || "", (v: string) => setSelectedPost(prev => prev ? { ...prev, scheduled_for: `${v}T${prev.scheduled_for?.substring(11, 16) || "10:00"}:00` } : prev)];
            const [editTime, setEditTime] = [selectedPost.scheduled_for?.substring(11, 16) || "10:00", (v: string) => setSelectedPost(prev => prev ? { ...prev, scheduled_for: `${prev.scheduled_for?.substring(0, 10) || ""}T${v}:00` } : prev)];
            return (
            <div className="space-y-4">

              {/* Image preview */}
              {imgUrl && (
                <img src={imgUrl} alt="Preview" className="w-full rounded-lg" style={{ maxHeight: "400px", objectFit: "contain" }} />
              )}
              <Button type="button" size="sm" variant="accent" className="w-full" disabled={postUpdating} onClick={async () => {
                setPostUpdating(true);
                toast.info("Regenerando imagem com IA...");
                try {
                  const { data: genData } = await supabase.functions.invoke("nina-create-post", {
                    body: { mode: "brief", brand: selectedPost.brand, brief: selectedPost.title, post_type: (selectedPost.post_type === "story" || selectedPost.post_type === "reels") ? "story" : "feed" },
                  });
                  if (genData?.image_url) {
                    await supabase.from("posts").update({ metadata: { ...selectedPost.metadata, image_url: genData.image_url }, caption: genData.caption || selectedPost.caption } as never).eq("id", selectedPost.id);
                    setSelectedPost(prev => prev ? { ...prev, metadata: { ...prev.metadata, image_url: genData.image_url }, caption: genData.caption || prev.caption } : prev);
                    setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, metadata: { ...p.metadata, image_url: genData.image_url } } : p));
                    toast.success("Imagem e texto regenerados!");
                  } else { toast.error(genData?.error || "Falha ao regenerar."); }
                } catch { toast.error("Erro ao regenerar."); }
                finally { setPostUpdating(false); }
              }}>
                Regenerar com IA
              </Button>

              {/* Status */}
              <div className="flex items-center gap-2">
                <Badge variant="status" color={STATUS_COLORS[selectedPost.status]}>{STATUS_LABELS[selectedPost.status]}</Badge>
                {selectedPost.created_by_ai && <span className="text-xs text-cyan-400">Gerado por IA</span>}
                {selectedPost.published_at && <span className="text-xs text-slate-500">Publicado: {new Date(selectedPost.published_at).toLocaleString("pt-BR")}</span>}
              </div>

              {/* Title */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Título</label>
                <input defaultValue={selectedPost.title} onChange={(e) => setSelectedPost(prev => prev ? { ...prev, title: e.target.value } : prev)} className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200" />
              </div>

              {/* Caption */}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Legenda</label>
                <textarea defaultValue={selectedPost.caption || ""} onChange={(e) => setSelectedPost(prev => prev ? { ...prev, caption: e.target.value } : prev)} rows={5} className="w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200 resize-y" />
              </div>

              {/* Brand + Type — shadcn Select */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Marca</label>
                  <Select value={editBrand} onValueChange={setEditBrand}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="la_music_school">LA Music School</SelectItem>
                      <SelectItem value="la_music_kids">LA Music Kids</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Tipo</label>
                  <Select value={editPostType} onValueChange={(v) => {
                    setEditPostType(v);
                    if (v !== selectedPost.post_type) {
                      toast.info("Tipo alterado. Clique em 'Regenerar com IA' para gerar a imagem no novo formato.");
                    }
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="story">Story (9:16)</SelectItem>
                      <SelectItem value="image">Feed (4:5)</SelectItem>
                      <SelectItem value="reels">Reels (9:16)</SelectItem>
                      <SelectItem value="carousel">Carrossel (4:5)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date + Time — Design system */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Data</label>
                  <DatePicker value={editDate} onChange={setEditDate} placeholder="Data" className="h-10 border-slate-700 bg-slate-900/70" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Horário</label>
                  <TimePicker value={editTime} onChange={setEditTime} minuteStep={15} className="h-10" />
                </div>
              </div>

              {/* Action buttons — clear UX */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <AlertDialog open={postDeleteConfirmOpen} onOpenChange={setPostDeleteConfirmOpen}>
                  <Button type="button" variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-900/20" onClick={() => setPostDeleteConfirmOpen(true)}>
                    Excluir
                  </Button>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir post?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir &quot;{selectedPost.title}&quot;? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction className="bg-red-600 hover:bg-red-500" disabled={postUpdating} onClick={async () => {
                        setPostUpdating(true);
                        try {
                          await supabase.from("posts").delete().eq("id", selectedPost.id);
                          await supabase.from("studio_publish_queue").delete().eq("post_id", selectedPost.id);
                          setPosts(prev => prev.filter(p => p.id !== selectedPost.id));
                          toast.success("Post excluído.");
                          setPostModalOpen(false);
                          setPostDeleteConfirmOpen(false);
                        } catch { toast.error("Erro ao excluir."); }
                        finally { setPostUpdating(false); }
                      }}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <div className="flex gap-2">
                  <Button type="button" variant="primary" size="sm" disabled={postUpdating} onClick={async () => {
                    setPostUpdating(true);
                    toast.info("Publicando agora...");
                    try {
                      await supabase.from("posts").update({ status: "scheduled", scheduled_for: new Date().toISOString() } as never).eq("id", selectedPost.id);
                      const { data: pubData, error: fnErr } = await supabase.functions.invoke("publish-scheduled-posts", { body: { post_id: selectedPost.id } });
                      if (fnErr || !(pubData as { success?: boolean })?.success) { toast.error("Falha ao publicar."); }
                      else { toast.success("Publicado!"); await loadBaseData(); setPostModalOpen(false); }
                    } catch { toast.error("Erro."); }
                    finally { setPostUpdating(false); }
                  }}>
                    Publicar agora
                  </Button>
                  <Button type="button" size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white" disabled={postUpdating} onClick={async () => {
                    if (!selectedPost.scheduled_for || selectedPost.scheduled_for.length < 10) { toast.error("Escolha uma data e horário para agendar."); return; }
                    const schedDate = new Date(selectedPost.scheduled_for);
                    if (schedDate <= new Date()) { toast.error("Escolha um horário futuro."); return; }
                    setPostUpdating(true);
                    try {
                      await supabase.from("posts").update({ title: selectedPost.title, caption: selectedPost.caption, brand: selectedPost.brand, post_type: selectedPost.post_type, scheduled_for: selectedPost.scheduled_for, status: "scheduled" } as never).eq("id", selectedPost.id);
                      await supabase.from("studio_publish_queue").upsert({ post_id: selectedPost.id, brand: selectedPost.brand, scheduled_for: selectedPost.scheduled_for, status: "pending" } as never, { onConflict: "post_id" });
                      setPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, ...selectedPost, status: "scheduled" as const } : p));
                      toast.success(`Agendado para ${schedDate.toLocaleString("pt-BR")}!`);
                      setPostModalOpen(false);
                    } catch { toast.error("Erro ao agendar."); }
                    finally { setPostUpdating(false); }
                  }}>
                    Agendar
                  </Button>
                </div>
              </div>

            </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
