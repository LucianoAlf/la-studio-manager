import { createClient } from "@/lib/supabase/client";
import type { CalendarItem, CalendarItemConnection, CalendarItemComment } from "@/lib/types/database";
import type { CalendarFilters } from "@/types/filters";

function getSupabase() {
  return createClient();
}

// ============================================================
// LEMBRETES COMO ITENS VISUAIS DO CALENDÁRIO
// ============================================================

export interface CalendarReminder {
  id: string;
  content: string;
  scheduled_for: string;
  status: string;
  source: string;
  recurrence: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Busca lembretes pendentes no período para exibir no calendário.
 * Retorna como CalendarItem[] "virtuais" (type='reminder') para mesclar na view.
 */
export async function getCalendarReminders(startDate: string, endDate: string, userId?: string): Promise<CalendarItem[]> {
  const supabase = getSupabase();

  let query = supabase
    .from("whatsapp_scheduled_messages")
    .select("id, content, scheduled_for, status, source, recurrence, metadata")
    .in("source", ["manual", "dashboard", "calendar_reminder"])
    .in("status", ["pending", "sent"])
    .gte("scheduled_for", startDate)
    .lte("scheduled_for", endDate)
    .order("scheduled_for", { ascending: true })
    .limit(100);

  if (userId) {
    query = query.eq("target_user_id", userId);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  // Converter para formato CalendarItem "virtual"
  return (data as unknown as CalendarReminder[]).map((r) => {
    // Extrair texto limpo do conteúdo
    const cleanText = r.content
      .replace(/^⏰\s*\*Lembrete!?\*\s*\n?\n?/, "")
      .replace(/^📅\s*\*Lembrete de evento\*\s*\n?\n?/, "")
      .split("\n")[0]
      .replace(/^\*|\*$/g, "")
      .trim()
      .slice(0, 80);

    return {
      id: `reminder-${r.id}`,
      title: cleanText || "Lembrete",
      type: "reminder" as CalendarItem["type"],
      start_time: r.scheduled_for,
      end_time: null,
      all_day: false,
      status: r.status === "sent" ? "completed" : "confirmed",
      description: r.content,
      responsible_user_id: null,
      created_by: null,
      location: null,
      content_type: null,
      platforms: null,
      tags: null,
      metadata: {
        ...r.metadata,
        is_reminder: true,
        reminder_source: r.source,
        reminder_status: r.status,
        reminder_recurrence: r.recurrence,
        original_id: r.id,
      },
      created_at: r.scheduled_for,
      updated_at: r.scheduled_for,
      deleted_at: null,
    } as unknown as CalendarItem;
  });
}

// Buscar items por período (com filtros opcionais)
export async function getCalendarItems(startDate: string, endDate: string, filters?: Omit<CalendarFilters, 'startDate' | 'endDate'>): Promise<CalendarItem[]> {
  const supabase = getSupabase();

  // 1. Buscar items do calendário
  let query = supabase
    .from("calendar_items")
    .select("*")
    .gte("start_time", startDate)
    .lte("start_time", endDate)
    .is("deleted_at", null)
    .order("start_time", { ascending: true });

  // Filtros opcionais
  if (filters?.types) {
    if (filters.types.length === 0) return []; // nenhum tipo selecionado → nada a retornar
    query = query.in("type", filters.types);
  }
  if (filters?.priorities && filters.priorities.length > 0) {
    const orClauses = filters.priorities.map((p) => `metadata->>priority.eq.${p}`).join(",");
    query = query.or(orClauses);
  }
  if (filters?.responsibleId) {
    query = query.eq("responsible_user_id", filters.responsibleId);
  }
  if (filters?.contentType) {
    query = query.eq("content_type", filters.contentType);
  }
  if (filters?.platforms && filters.platforms.length > 0) {
    query = query.overlaps("platforms", filters.platforms);
  }

  const { data: items, error } = await query;

  if (error) throw error;
  if (!items || items.length === 0) return [];

  // 2. Buscar profiles dos responsáveis (FK aponta para auth.users, não user_profiles)
  const rows = items as unknown as Array<Record<string, unknown>>;
  const userIds = [...new Set(rows.flatMap((i) => [i.responsible_user_id as string, i.created_by as string].filter(Boolean)))];
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, user_id, full_name, display_name, avatar_url, role")
    .in("user_id", userIds);

  const profileRows = (profiles ?? []) as unknown as Array<Record<string, unknown>>;
  const profileMap = new Map(profileRows.map((p) => [p.user_id as string, p]));

  // 3. Montar resultado com joins manuais
  return rows.map((item) => ({
    ...item,
    responsible: item.responsible_user_id ? profileMap.get(item.responsible_user_id as string) ?? null : null,
    creator: item.created_by ? profileMap.get(item.created_by as string) ?? null : null,
  })) as unknown as CalendarItem[];
}

// Buscar conexões de um item
export async function getCalendarItemConnections(itemId: string): Promise<CalendarItemConnection[]> {
  const supabase = getSupabase();

  // 1. Buscar conexões
  const { data, error } = await supabase
    .from("calendar_item_connections")
    .select("*")
    .or(`source_item_id.eq.${itemId},target_item_id.eq.${itemId}`);

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // 2. Buscar items conectados
  const connRows = data as unknown as Array<Record<string, unknown>>;
  const itemIds = [...new Set(connRows.flatMap((c) => [c.source_item_id as string, c.target_item_id as string]))];
  const { data: linkedItems } = await supabase
    .from("calendar_items")
    .select("id, title, type, start_time, status")
    .in("id", itemIds);

  const itemMap = new Map((linkedItems as unknown as Array<Record<string, unknown>> ?? []).map((i) => [i.id as string, i]));

  return connRows.map((conn) => ({
    ...conn,
    source_item: itemMap.get(conn.source_item_id as string) ?? null,
    target_item: itemMap.get(conn.target_item_id as string) ?? null,
  })) as unknown as CalendarItemConnection[];
}

// Buscar comentários de um item
export async function getCalendarItemComments(itemId: string): Promise<CalendarItemComment[]> {
  const supabase = getSupabase();

  // 1. Buscar comentários
  const { data, error } = await supabase
    .from("calendar_item_comments")
    .select("*")
    .eq("calendar_item_id", itemId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // 2. Buscar profiles dos autores (FK aponta para auth.users)
  const commentRows = data as unknown as Array<Record<string, unknown>>;
  const userIds = [...new Set(commentRows.map((c) => c.user_id as string).filter(Boolean))];
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, user_id, full_name, display_name, avatar_url")
    .in("user_id", userIds);

  const profileRows = (profiles ?? []) as unknown as Array<Record<string, unknown>>;
  const profileMap = new Map(profileRows.map((p) => [p.user_id as string, p]));

  return commentRows.map((c) => ({
    ...c,
    user: profileMap.get(c.user_id as string) ?? null,
  })) as unknown as CalendarItemComment[];
}

// ============================================================
// MARCADORES DE ENTREGA (cards vinculados via kanban_card_id)
// ============================================================

/**
 * Busca calendar_items que têm kanban_card_id, carrega o due_date do card vinculado,
 * e gera "items fantasma" tipo delivery para exibir no calendário principal.
 * Só retorna marcadores cuja due_date cai dentro do range solicitado.
 */
export async function getDeliveryMarkers(startDate: string, endDate: string): Promise<CalendarItem[]> {
  const supabase = getSupabase();

  // 1. Buscar calendar_items que têm kanban_card_id (sem filtro de data — o item pode estar fora do range mas a entrega dentro)
  const { data: linkedItems, error: linkedErr } = await supabase
    .from("calendar_items")
    .select("id, title, kanban_card_id, responsible_user_id, content_type, platforms, metadata")
    .not("kanban_card_id", "is", null)
    .is("deleted_at", null);

  if (linkedErr || !linkedItems || linkedItems.length === 0) return [];

  // 2. Buscar os kanban_cards vinculados
  const rows = linkedItems as unknown as Array<Record<string, unknown>>;
  const cardIds = [...new Set(rows.map((i) => i.kanban_card_id as string).filter(Boolean))];
  if (cardIds.length === 0) return [];

  const { data: cards, error: cardsErr } = await supabase
    .from("kanban_cards")
    .select("id, title, due_date, start_date")
    .in("id", cardIds);

  if (cardsErr || !cards) return [];

  const cardMap = new Map((cards as unknown as Array<Record<string, unknown>>).map((c) => [c.id as string, c]));

  // 3. Gerar marcadores fantasma de entrega
  const markers: CalendarItem[] = [];
  const rangeStart = new Date(startDate).getTime();
  const rangeEnd = new Date(endDate).getTime();

  for (const item of rows) {
    const card = cardMap.get(item.kanban_card_id as string);
    if (!card || !card.due_date) continue;

    const dueTime = new Date(card.due_date as string).getTime();
    if (dueTime < rangeStart || dueTime > rangeEnd) continue;

    markers.push({
      id: `delivery-${item.id}`,
      title: `📦 Entrega: ${item.title}`,
      type: "delivery" as CalendarItem["type"],
      start_time: card.due_date as string,
      end_time: null,
      all_day: false,
      status: "pending",
      description: `Entrega do card "${card.title ?? item.title}"`,
      responsible_user_id: item.responsible_user_id as string | null,
      created_by: null,
      location: null,
      content_type: item.content_type as string | null,
      platforms: (item.platforms as string[]) ?? [],
      kanban_card_id: item.kanban_card_id as string | null,
      post_id: null,
      color: null,
      metadata: {
        ...(item.metadata as Record<string, unknown> ?? {}),
        is_delivery_marker: true,
        source_calendar_item_id: item.id,
      },
      created_at: card.due_date as string,
      updated_at: card.due_date as string,
    } as unknown as CalendarItem);
  }

  return markers;
}

// === CRUD ===

export async function createCalendarItem(item: Partial<CalendarItem>) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("calendar_items")
    .insert(item as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCalendarItem(id: string, updates: Partial<CalendarItem>) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("calendar_items")
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCalendarItem(id: string) {
  const supabase = getSupabase();

  // Tentar hard delete primeiro
  const { data, error } = await supabase
    .from("calendar_items")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[Calendar] Hard delete error:", error);
    // Fallback: soft delete (update deleted_at)
    const { error: softError } = await supabase
      .from("calendar_items")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (softError) throw softError;
    return;
  }

  // Se hard delete retornou 0 rows, tentar soft delete
  if (!data || data.length === 0) {
    console.warn("[Calendar] Hard delete returned 0 rows, trying soft delete");
    const { error: softError } = await supabase
      .from("calendar_items")
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", id);
    if (softError) throw softError;
  }
}

// Mover item (drag & drop persistence)
export async function moveCalendarItem(
  itemId: string,
  newStartTime: string,
  newEndTime?: string
) {
  const supabase = getSupabase();

  const updateData: Record<string, unknown> = {
    start_time: newStartTime,
    updated_at: new Date().toISOString(),
  };

  if (newEndTime) {
    updateData.end_time = newEndTime;
  }

  const { data, error } = await supabase
    .from("calendar_items")
    .update(updateData as never)
    .eq("id", itemId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function addCalendarComment(
  itemId: string,
  userId: string,
  text: string
): Promise<CalendarItemComment> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("calendar_item_comments")
    .insert({ calendar_item_id: itemId, user_id: userId, comment_text: text } as never)
    .select(`
      *,
      user:user_profiles!calendar_item_comments_user_id_fkey(
        id, user_id, full_name, display_name, avatar_url
      )
    `)
    .single();
  if (error) throw error;
  return data as unknown as CalendarItemComment;
}
