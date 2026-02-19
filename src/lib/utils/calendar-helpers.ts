import type { CalendarItemType } from "@/lib/types/database";

// Cores por tipo (usar nas 3 views)
export const TYPE_COLORS: Record<CalendarItemType, { bg: string; border: string; dot: string; label: string }> = {
  event:    { bg: "rgba(249,115,22,0.12)", border: "#F97316", dot: "#F97316", label: "Evento" },
  delivery: { bg: "rgba(239,68,68,0.12)",  border: "#EF4444", dot: "#EF4444", label: "Entrega" },
  creation: { bg: "rgba(26,168,191,0.12)", border: "#1AA8BF", dot: "#1AA8BF", label: "Criação" },
  task:     { bg: "rgba(34,197,94,0.12)",  border: "#22C55E", dot: "#22C55E", label: "Tarefa" },
  meeting:  { bg: "rgba(139,92,246,0.12)", border: "#8B5CF6", dot: "#8B5CF6", label: "Reunião" },
  reminder: { bg: "rgba(251,191,36,0.12)", border: "#FBBF24", dot: "#FBBF24", label: "Lembrete" },
};

export const TYPE_EMOJIS: Record<CalendarItemType, string> = {
  event: "🎸",
  delivery: "🔴",
  creation: "📹",
  task: "✅",
  meeting: "🧠",
  reminder: "⏰",
};

// Helper: formatar horário "09:00"
export function formatTime(isoString: string) {
  const date = new Date(isoString);
  // Usar UTC para evitar problemas de timezone
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Helper: formatar data "06 fev. 2026"
export function formatDateShort(isoString: string) {
  const date = new Date(isoString);
  // Usar UTC para evitar problemas de timezone
  const dia = date.getUTCDate().toString().padStart(2, '0');
  const mes = date.getUTCMonth();
  const ano = date.getUTCFullYear();
  const meses = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
  return `${dia} ${meses[mes]} ${ano}`;
}

// Helper: calcular posição top e height para week/day view
export function calcEventPosition(
  startTime: string,
  endTime: string | null,
  hourHeight: number = 64,
  startHour: number = 7
) {
  const start = new Date(startTime);
  // Usar UTC para evitar problemas de timezone
  const startH = start.getUTCHours();
  const startM = start.getUTCMinutes();
  const top = (startH - startHour) * hourHeight + (startM / 60) * hourHeight;

  if (!endTime) {
    return { top, height: hourHeight * 0.5 }; // items sem end_time = 30min default
  }

  const end = new Date(endTime);
  const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  const height = Math.max((durationMinutes / 60) * hourHeight, 24); // mínimo 24px

  return { top, height };
}

// Helper: início e fim do período por view
export function getDateRange(date: Date, view: "dia" | "semana" | "mes") {
  // Usar UTC para evitar problemas de timezone
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const dayOfWeek = date.getUTCDay();

  if (view === "dia") {
    const start = new Date(Date.UTC(year, month, day, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, day, 23, 59, 59));
    return { start: start.toISOString(), end: end.toISOString() };
  }

  if (view === "semana") {
    // Semana começa na segunda-feira (alinhado com getWeekStart do calendário)
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(Date.UTC(year, month, day + diff, 0, 0, 0));
    const sunday = new Date(Date.UTC(year, month, day + diff + 6, 23, 59, 59, 999));
    return { start: monday.toISOString(), end: sunday.toISOString() };
  }

  // mes
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
  return { start: start.toISOString(), end: end.toISOString() };
}

// Helper: avatar initial + color a partir de um profile
export function getUserDisplay(
  profile: { full_name: string; display_name?: string | null } | null | undefined
) {
  if (!profile) return { name: "?", initial: "?", color: "#6B7280" };
  const name = profile.display_name || profile.full_name;
  return {
    name,
    initial: name.charAt(0).toUpperCase(),
    color: getColorForName(name),
  };
}

function getColorForName(name: string): string {
  const colors = ["#1AA8BF", "#F97316", "#22C55E", "#8B5CF6", "#EC4899", "#EF4444"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// Cores de plataforma (alinhadas com tailwind.config.ts)
export const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  youtube: "#FF0000",
  tiktok: "#00F2EA",
  facebook: "#1877F2",
  whatsapp: "#25D366",
};
