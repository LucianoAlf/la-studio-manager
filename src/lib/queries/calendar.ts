import { createClient } from "@/lib/supabase/client";
import type { CalendarItem, CalendarItemConnection, CalendarItemComment } from "@/lib/types/database";

function getSupabase() {
  return createClient();
}

// Buscar items por período
export async function getCalendarItems(startDate: string, endDate: string): Promise<CalendarItem[]> {
  const supabase = getSupabase();

  // 1. Buscar items do calendário
  const { data: items, error } = await supabase
    .from("calendar_items")
    .select("*")
    .gte("start_time", startDate)
    .lte("start_time", endDate)
    .is("deleted_at", null)
    .order("start_time", { ascending: true });

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
  const { error } = await supabase
    .from("calendar_items")
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq("id", id);
  if (error) throw error;
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
