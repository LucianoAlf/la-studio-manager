import type { KanbanCard, KanbanColumn } from "@/lib/types/database";

// Calcular progresso baseado na posição da coluna
export function getProgressFromColumn(
  column: KanbanColumn | null | undefined,
  totalColumns: number
): number {
  if (!column) return 0;
  const slugProgress: Record<string, number> = {
    brainstorming: 5,
    planning: 15,
    todo: 25,
    capturing: 40,
    editing: 60,
    awaiting_approval: 80,
    approved: 95,
    published: 100,
    archived: 100,
  };
  return slugProgress[column.slug] ?? Math.round((column.position / totalColumns) * 100);
}

// Status display baseado no slug da coluna
export function getStatusFromColumn(
  column: KanbanColumn | null | undefined
): { label: string; color: string; emoji: string; bgClass: string } {
  if (!column) return { label: "Sem status", color: "#6B7280", emoji: "❓", bgClass: "bg-slate-500/15 text-slate-400" };
  const map: Record<string, { label: string; color: string; emoji: string; bgClass: string }> = {
    brainstorming:     { label: "Brainstorm",  color: "#8B5CF6", emoji: "🔮", bgClass: "bg-[#8B5CF6]/15 text-[#A78BFA]" },
    planning:          { label: "Planning",    color: "#3B82F6", emoji: "📋", bgClass: "bg-[#3B82F6]/15 text-[#60A5FA]" },
    todo:              { label: "To Do",       color: "#10B981", emoji: "📌", bgClass: "bg-[#10B981]/15 text-[#34D399]" },
    capturing:         { label: "Captando",    color: "#F59E0B", emoji: "🎬", bgClass: "bg-[#F59E0B]/15 text-[#FBBF24]" },
    editing:           { label: "Editando",    color: "#F97316", emoji: "✂️", bgClass: "bg-[#F97316]/15 text-[#FB923C]" },
    awaiting_approval: { label: "Aprovação",   color: "#22C55E", emoji: "✅", bgClass: "bg-[#22C55E]/15 text-[#4ADE80]" },
    approved:          { label: "Aprovado",    color: "#38C8DB", emoji: "👍", bgClass: "bg-[#38C8DB]/15 text-[#38C8DB]" },
    published:         { label: "Publicado",   color: "#6366F1", emoji: "🚀", bgClass: "bg-[#6366F1]/15 text-[#818CF8]" },
    archived:          { label: "Arquivado",   color: "#5A7A82", emoji: "📦", bgClass: "bg-[#5A7A82]/15 text-[#5A7A82]" },
  };
  return map[column.slug] ?? { label: column.name, color: column.color ?? "#6B7280", emoji: "📄", bgClass: "bg-slate-500/15 text-slate-400" };
}

// Prioridade para badge
export function getPriorityDisplay(
  priority: string | null | undefined
): { label: string; color: string; bgClass: string } | null {
  if (!priority) return null;
  const map: Record<string, { label: string; color: string; bgClass: string }> = {
    urgent: { label: "Urgente", color: "#EF4444", bgClass: "bg-[#EF4444]/15 text-[#F87171]" },
    high:   { label: "Alta",    color: "#F97316", bgClass: "bg-[#F97316]/15 text-[#FB923C]" },
    medium: { label: "Média",   color: "#3B82F6", bgClass: "bg-[#3B82F6]/15 text-[#60A5FA]" },
    low:    { label: "Baixa",   color: "#22C55E", bgClass: "bg-[#22C55E]/15 text-[#4ADE80]" },
  };
  return map[priority] ?? null;
}

// Agrupar cards por coluna
export function groupCardsByColumn(
  cards: KanbanCard[],
  columns: KanbanColumn[]
): Map<string, KanbanCard[]> {
  const grouped = new Map<string, KanbanCard[]>();
  columns.forEach((col) => grouped.set(col.id, []));
  cards.forEach((card) => {
    const existing = grouped.get(card.column_id) ?? [];
    existing.push(card);
    grouped.set(card.column_id, existing);
  });
  return grouped;
}

// Agrupar cards por responsável
export function groupCardsByUser(
  cards: KanbanCard[]
): Map<string, { name: string; role: string; cards: KanbanCard[] }> {
  const grouped = new Map<string, { name: string; role: string; cards: KanbanCard[] }>();
  cards.forEach((card) => {
    const userId = card.responsible_user_id ?? "unassigned";
    const name =
      card.responsible?.display_name ?? card.responsible?.full_name ?? "Sem responsável";
    const role = card.responsible?.role ?? "";
    if (!grouped.has(userId)) {
      grouped.set(userId, { name, role, cards: [] });
    }
    grouped.get(userId)!.cards.push(card);
  });
  return grouped;
}

// Brand do card (extrair de metadata)
export function getCardBrand(card: KanbanCard): string {
  return (card.metadata?.brand as string) ?? "la_music_school";
}

// Content type emoji
export function getContentTypeEmoji(contentType: string | null): string {
  const map: Record<string, string> = {
    video: "🎬",
    carousel: "🎠",
    image: "📸",
    reels: "🎥",
    story: "📱",
    newsletter: "📰",
    short: "⚡",
  };
  return map[contentType ?? ""] ?? "📄";
}

// Cores de plataforma (alinhadas com tailwind.config.ts)
export const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  youtube: "#FF0000",
  tiktok: "#00F2EA",
  facebook: "#1877F2",
  whatsapp: "#25D366",
  Instagram: "#E1306C",
  YouTube: "#FF0000",
  TikTok: "#00F2EA",
};

// Formatar data curta
export function formatDateShort(iso: string) {
  const d = new Date(iso);
  const dia = d.getDate().toString().padStart(2, "0");
  const meses = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
  return `${dia} de ${meses[d.getMonth()]}`;
}

// Verificar se data já passou
export function isOverdue(iso: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return new Date(iso) < hoje;
}
