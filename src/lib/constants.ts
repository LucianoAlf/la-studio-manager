// ==========================================
// LA STUDIO MANAGER — Constants
// ==========================================

import type { Icon } from "@phosphor-icons/react";
import {
  SquaresFour,
  Kanban,
  CalendarDots,
  Robot,
  Images,
  ChartBar,
  Gear,
  Lightning,
  Lightbulb,
  MapPin,
  PaintBrush,
  PenNib,
  MusicNotes,
} from "@phosphor-icons/react";

// --- Navigation ---
export const SIDEBAR_NAV = [
  { label: "Dashboard", href: "/", icon: SquaresFour, disabled: true },
  { label: "Projetos", href: "/projetos", icon: Kanban, disabled: false },
  { label: "Calendário", href: "/calendario", icon: CalendarDots, disabled: false },
  { label: "Studio", href: "/studio", icon: Lightning, disabled: false },
  { label: "Agentes IA", href: "/agentes", icon: Robot, disabled: true },
  { label: "Ativos", href: "/ativos", icon: Images, disabled: true },
  { label: "Relatórios", href: "/relatorios", icon: ChartBar, disabled: true },
  { label: "Configurações", href: "/configuracoes", icon: Gear, disabled: false },
] as const;

// --- Kanban Columns ---
export const KANBAN_COLUMNS = [
  { slug: "brainstorming", name: "Brainstorm", emoji: "💡", color: "#A78BFA" },
  { slug: "planning", name: "Planning", emoji: "📋", color: "#06B6D4" },
  { slug: "todo", name: "A Fazer", emoji: "📌", color: "#1AA8BF" },
  { slug: "capturing", name: "Captando", emoji: "🎬", color: "#F59E0B" },
  { slug: "editing", name: "Editando", emoji: "✂️", color: "#F97316" },
  { slug: "awaiting_approval", name: "Aprovação", emoji: "✅", color: "#22C55E" },
  { slug: "approved", name: "Aprovado", emoji: "📅", color: "#38C8DB" },
  { slug: "published", name: "Publicado", emoji: "🚀", color: "#1AA8BF" },
  { slug: "archived", name: "Arquivo", emoji: "📦", color: "#5A7A82" },
] as const;

// --- Priority ---
export const PRIORITIES = {
  urgent: { label: "Urgente", color: "#EF4444", bg: "#7F1D1D" },
  high: { label: "Alta", color: "#F97316", bg: "#431407" },
  medium: { label: "Média", color: "#F59E0B", bg: "#78350F" },
  low: { label: "Baixa", color: "#22C55E", bg: "#14532D" },
} as const;

// --- Platforms ---
export const PLATFORMS = {
  instagram: { label: "Instagram", color: "#E1306C" },
  youtube: { label: "YouTube", color: "#FF0000" },
  tiktok: { label: "TikTok", color: "#00F2EA" },
  facebook: { label: "Facebook", color: "#1877F2" },
  whatsapp: { label: "WhatsApp", color: "#25D366" },
} as const;

// --- Brands ---
export const BRANDS = {
  la_music_school: { label: "LA Music School", color: "#1AA8BF" },
  la_music_kids: { label: "LA Music Kids", color: "#22C55E" },
} as const;

// --- AI Agents ---
export const AI_AGENTS = {
  maestro: { name: "Maestro", role: "Orquestrador", color: "#1AA8BF", icon: MusicNotes },
  luna: { name: "Luna", role: "Ideação", color: "#A78BFA", icon: Lightbulb },
  atlas: { name: "Atlas", role: "Planejamento", color: "#06B6D4", icon: MapPin },
  nina: { name: "Nina", role: "Design", color: "#F97316", icon: PaintBrush },
  theo: { name: "Theo", role: "Copywriting", color: "#F59E0B", icon: PenNib },
  ada: { name: "Ada", role: "Analytics", color: "#22C55E", icon: ChartBar },
} as const;

// --- Calendar Categories ---
export const CALENDAR_CATEGORIES = {
  event: { label: "Evento", color: "#F97316", bg: "#431407" },
  delivery: { label: "Entrega", color: "#EF4444", bg: "#7F1D1D" },
  creation: { label: "Criação", color: "#1AA8BF", bg: "#0A2E38" },
  task: { label: "Tarefa", color: "#22C55E", bg: "#14532D" },
  meeting: { label: "Reunião", color: "#A78BFA", bg: "#3B0764" },
} as const;

// --- Team (for reference/seed) ---
export const TEAM = [
  { name: "Yuri", role: "admin", displayRole: "Líder Marketing" },
  { name: "John", role: "usuario", displayRole: "Produção" },
  { name: "Rayan", role: "usuario", displayRole: "Tráfego" },
  { name: "Alf", role: "admin", displayRole: "Desenvolvimento" },
  { name: "Hugo", role: "usuario", displayRole: "Desenvolvimento" },
] as const;
