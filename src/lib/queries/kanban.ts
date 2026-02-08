import { createClient } from "@/lib/supabase/client";
import type { KanbanColumn, KanbanCard } from "@/lib/types/database";
import type { KanbanFilters } from "@/types/filters";

function getSupabase() {
  return createClient();
}

// Buscar colunas ordenadas por posição
export async function getKanbanColumns(): Promise<KanbanColumn[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("kanban_columns")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as KanbanColumn[];
}

// Buscar cards ativos com joins manuais (FK aponta para auth.users, não user_profiles)
export async function getKanbanCards(filters?: KanbanFilters): Promise<KanbanCard[]> {
  const supabase = getSupabase();

  // 1. Buscar cards
  let query = supabase
    .from("kanban_cards")
    .select("*")
    .is("deleted_at", null)
    .order("position_in_column", { ascending: true });

  // Filtros opcionais
  if (filters?.priorities && filters.priorities.length > 0) {
    query = query.in("priority", filters.priorities);
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
  if (filters?.brand) {
    query = query.eq("brand", filters.brand);
  }
  if (filters?.search) {
    query = query.ilike("title", `%${filters.search}%`);
  }

  const { data: cards, error } = await query;

  if (error) throw error;
  if (!cards || cards.length === 0) return [];

  // 2. Buscar colunas para join
  const { data: columns } = await supabase
    .from("kanban_columns")
    .select("id, name, slug, color, position");

  const colMap = new Map(
    ((columns ?? []) as unknown as Array<Record<string, unknown>>).map((c) => [c.id as string, c])
  );

  // 3. Buscar profiles dos responsáveis/criadores (FK aponta para auth.users)
  const rows = cards as unknown as Array<Record<string, unknown>>;
  const userIds = [
    ...new Set(
      rows.flatMap((c) =>
        [c.responsible_user_id as string, c.created_by as string].filter(Boolean)
      )
    ),
  ];

  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, user_id, full_name, display_name, avatar_url, role")
    .in("user_id", userIds);

  const profileRows = (profiles ?? []) as unknown as Array<Record<string, unknown>>;
  const profileMap = new Map(profileRows.map((p) => [p.user_id as string, p]));

  // 4. Montar resultado com joins manuais
  return rows.map((card) => ({
    ...card,
    column: card.column_id ? colMap.get(card.column_id as string) ?? null : null,
    responsible: card.responsible_user_id
      ? profileMap.get(card.responsible_user_id as string) ?? null
      : null,
    creator: card.created_by
      ? profileMap.get(card.created_by as string) ?? null
      : null,
  })) as unknown as KanbanCard[];
}

// Mover card para outra coluna/posição
export async function moveKanbanCard(
  cardId: string,
  newColumnId: string,
  newPosition: number
) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("kanban_cards")
    .update({
      column_id: newColumnId,
      position_in_column: newPosition,
      moved_to_column_at: new Date().toISOString(),
    } as never)
    .eq("id", cardId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Atualizar card
export async function updateKanbanCard(
  id: string,
  updates: Partial<KanbanCard>
) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("kanban_cards")
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Criar card
export async function createKanbanCard(card: Partial<KanbanCard>) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("kanban_cards")
    .insert(card as never)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteKanbanCard(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("kanban_cards")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ============================================================
// CRUD — KANBAN COLUMNS
// ============================================================

// Criar nova coluna
export async function createKanbanColumn(column: {
  name: string;
  slug: string;
  color?: string;
  emoji?: string;
  description?: string;
  position: number;
  card_limit?: number;
}): Promise<KanbanColumn> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("kanban_columns")
    .insert(column as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as KanbanColumn;
}

// Atualizar coluna
export async function updateKanbanColumn(
  id: string,
  updates: Partial<Pick<KanbanColumn, "name" | "slug" | "color" | "emoji" | "description" | "card_limit">>
): Promise<KanbanColumn> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("kanban_columns")
    .update(updates as never)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as KanbanColumn;
}

// Excluir coluna (só se não tiver cards)
export async function deleteKanbanColumn(id: string): Promise<void> {
  const supabase = getSupabase();

  // Verificar se há cards na coluna
  const { count, error: countError } = await supabase
    .from("kanban_cards")
    .select("id", { count: "exact", head: true })
    .eq("column_id", id)
    .is("deleted_at", null);

  if (countError) throw countError;
  if (count && count > 0) {
    throw new Error(`Não é possível excluir: existem ${count} card(s) nesta coluna. Mova-os antes de excluir.`);
  }

  const { error } = await supabase
    .from("kanban_columns")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// Reordenar colunas (atualiza position de todas)
export async function reorderKanbanColumns(
  orderedIds: string[]
): Promise<void> {
  const supabase = getSupabase();
  // Atualizar position de cada coluna em sequência
  const updates = orderedIds.map((id, index) =>
    supabase
      .from("kanban_columns")
      .update({ position: index + 1 } as never)
      .eq("id", id)
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}
