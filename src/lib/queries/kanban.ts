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
