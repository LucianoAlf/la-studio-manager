import {
  // Navigation & Structure
  SquaresFour,
  FolderSimple,
  CalendarDots,
  Robot,
  Image,
  ChartLine,
  Gear,
  Bell,
  MagnifyingGlass,
  Plus,
  CaretLeft,
  CaretRight,
  X,
  Check,
  DotsThreeVertical,
  DotsThree,
  PencilSimple,
  Trash,
  ArrowSquareOut,
  LinkSimple,
  Copy,
  Funnel,
  SlidersHorizontal,

  // Content & Media
  VideoCamera,
  Images,
  Camera,
  FilmSlate,
  DeviceMobile,
  Newspaper,
  Lightning,
  FileText,
  MusicNote,
  Spinner,

  // Social Platforms
  InstagramLogo,
  YoutubeLogo,
  FacebookLogo,
  TiktokLogo,

  // Status & Priority
  Warning,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Minus,
  Clock,
  CheckCircle,
  XCircle,

  // People & Teams
  User,
  Users,
  UserPlus,

  // Misc
  MapPin,
  Tag,
  BookmarkSimple,
  PaperPlaneTilt,
  ChatDots,
  Eye,
  DownloadSimple,
  UploadSimple,

  type IconProps,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";

type PhosphorIcon = ComponentType<IconProps>;

// ============================================
// CAMADA 1: ÍCONES ESTRUTURAIS (Phosphor)
// Usar em: sidebar, botões, toolbars, badges,
// headers, actions, formulários
// ============================================

// Sidebar navigation
export const NAV_ICONS = {
  dashboard: SquaresFour,
  projetos: FolderSimple,
  calendario: CalendarDots,
  agentes: Robot,
  ativos: Image,
  relatorios: ChartLine,
  configuracoes: Gear,
} as const;

// Actions (botões, toolbars)
export const ACTION_ICONS = {
  add: Plus,
  edit: PencilSimple,
  delete: Trash,
  close: X,
  confirm: Check,
  search: MagnifyingGlass,
  filter: Funnel,
  settings: SlidersHorizontal,
  more: DotsThreeVertical,
  moreH: DotsThree,
  link: LinkSimple,
  external: ArrowSquareOut,
  copy: Copy,
  send: PaperPlaneTilt,
  comment: ChatDots,
  view: Eye,
  download: DownloadSimple,
  upload: UploadSimple,
  notification: Bell,
  loading: Spinner,
  back: CaretLeft,
  forward: CaretRight,
} as const;

// Status icons
export const STATUS_ICONS: Record<string, { icon: PhosphorIcon; color: string; label: string }> = {
  pending:     { icon: Clock,        color: "#F59E0B", label: "Pendente" },
  in_progress: { icon: Spinner,      color: "#3B82F6", label: "Em Progresso" },
  completed:   { icon: CheckCircle,  color: "#22C55E", label: "Concluído" },
  cancelled:   { icon: XCircle,      color: "#6B7280", label: "Cancelado" },
};

// Priority icons
export const PRIORITY_ICONS: Record<string, { icon: PhosphorIcon; color: string; label: string }> = {
  urgent: { icon: Warning,   color: "#EF4444", label: "Urgente" },
  high:   { icon: ArrowUp,   color: "#F97316", label: "Alta" },
  medium: { icon: Minus,     color: "#F59E0B", label: "Média" },
  low:    { icon: ArrowDown, color: "#6B7280", label: "Baixa" },
};

// Platform icons (Phosphor tem logos reais!)
export const PLATFORM_ICONS: Record<string, { icon: PhosphorIcon; color: string; label: string }> = {
  instagram: { icon: InstagramLogo, color: "#E1306C", label: "Instagram" },
  youtube:   { icon: YoutubeLogo,   color: "#FF0000", label: "YouTube" },
  tiktok:    { icon: TiktokLogo,    color: "#00F2EA", label: "TikTok" },
  facebook:  { icon: FacebookLogo,  color: "#1877F2", label: "Facebook" },
};

// Content type icons (Phosphor — para contextos estruturais)
export const CONTENT_TYPE_ICONS: Record<string, { icon: PhosphorIcon; label: string }> = {
  video:      { icon: VideoCamera,  label: "Vídeo" },
  carousel:   { icon: Images,       label: "Carrossel" },
  image:      { icon: Camera,       label: "Imagem" },
  reels:      { icon: FilmSlate,    label: "Reels" },
  story:      { icon: DeviceMobile, label: "Story" },
  newsletter: { icon: Newspaper,    label: "Newsletter" },
  short:      { icon: Lightning,    label: "Short" },
};

// People
export const PEOPLE_ICONS = {
  user: User,
  users: Users,
  addUser: UserPlus,
} as const;

// Misc
export const MISC_ICONS = {
  location: MapPin,
  tag: Tag,
  bookmark: BookmarkSimple,
  file: FileText,
  music: MusicNote,
} as const;

// ============================================
// CAMADA 2: EMOJIS DE IDENTIDADE (conteúdo)
// Usar APENAS em blocos visuais do calendário,
// cards do kanban, e chips de tipo.
// NÃO usar em labels, headers ou forms.
// ============================================

export const CALENDAR_TYPE_EMOJIS: Record<string, string> = {
  event:    "🎸",
  delivery: "🔴",
  creation: "📹",
  task:     "✅",
  meeting:  "🧠",
};

export const CONTENT_TYPE_EMOJIS: Record<string, string> = {
  video:      "🎬",
  carousel:   "🎠",
  image:      "📸",
  reels:      "🎥",
  story:      "📱",
  newsletter: "📰",
  short:      "⚡",
};
