// ============================================================
// QUERIES — Configurações (WA-07)
// ============================================================

import { createClient } from "@/lib/supabase/client";
import type {
  UserNotificationSettings,
  MikeConfig,
  UserProfileExtended,
  TeamMemberWithEmail,
} from "@/lib/types/settings";

function getSupabase() {
  return createClient();
}

// ============================================================
// PROFILE
// ============================================================

/**
 * Busca o primeiro perfil ativo (para uso quando auth não está disponível no iframe).
 * Em produção com múltiplos usuários, usar getProfileByUserId.
 */
export async function getFirstActiveProfile(): Promise<UserProfileExtended | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("role", { ascending: true }) // admin primeiro
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as UserProfileExtended;
}

/**
 * Busca perfil por user_id do auth (quando auth está disponível).
 */
export async function getProfileByUserId(userId: string): Promise<UserProfileExtended | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as UserProfileExtended;
}

/**
 * Tenta buscar perfil via auth, fallback para localStorage ou primeiro perfil ativo.
 * Retorna também o email do auth.users se disponível.
 */
export async function getMyProfile(): Promise<UserProfileExtended | null> {
  const supabase = getSupabase();
  
  // Tentar via auth primeiro
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const profile = await getProfileByUserId(user.id);
      if (profile) return profile;
    }
  } catch {
    // Auth falhou (ex: iframe sem cookies) — continuar para fallback
  }

  // Fallback: tentar restaurar sessão do localStorage (Simple Browser)
  const storedToken = localStorage.getItem("la-studio-auth-token");
  if (storedToken) {
    try {
      const storedRefresh = localStorage.getItem("la-studio-auth-refresh") || "";
      const { data } = await supabase.auth.setSession({
        access_token: storedToken,
        refresh_token: storedRefresh,
      });
      if (data.session?.user) {
        const profile = await getProfileByUserId(data.session.user.id);
        if (profile) return profile;
      }
    } catch {
      // Fallthrough para último recurso
    }
  }

  // Em produção: não retornar perfil aleatório — retornar null
  console.warn("[getMyProfile] Não foi possível identificar o usuário autenticado.");
  return null;
}

/**
 * Busca perfil + email do auth (quando disponível).
 * Fallback: usa localStorage para identificar usuário no Simple Browser.
 */
export async function getMyProfileWithEmail(): Promise<{ profile: UserProfileExtended | null; email: string | null }> {
  const supabase = getSupabase();
  let email: string | null = null;
  
  // Tentar via auth primeiro
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      email = user.email || null;
      const profile = await getProfileByUserId(user.id);
      if (profile) return { profile, email };
    }
  } catch {
    // Auth falhou (ex: iframe sem cookies) — continuar para fallback
  }

  // Fallback: tentar restaurar sessão do localStorage (Simple Browser)
  const storedToken = localStorage.getItem("la-studio-auth-token");
  if (storedToken) {
    try {
      const storedRefresh = localStorage.getItem("la-studio-auth-refresh") || "";
      const { data } = await supabase.auth.setSession({
        access_token: storedToken,
        refresh_token: storedRefresh,
      });
      if (data.session?.user) {
        email = data.session.user.email || null;
        const profile = await getProfileByUserId(data.session.user.id);
        if (profile) return { profile, email };
      }
    } catch {
      // Fallthrough para último recurso
    }
  }

  // Em produção: não retornar perfil aleatório — retornar null
  console.warn("[getMyProfileWithEmail] Não foi possível identificar o usuário autenticado.");
  return { profile: null, email };
}

export async function updateMyProfile(
  profileId: string,
  updates: Partial<
    Pick<
      UserProfileExtended,
      "full_name" | "display_name" | "phone" | "avatar_url" | "bio" | "specializations"
    >
  >
): Promise<UserProfileExtended | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_profiles")
    .update(updates as never)
    .eq("id", profileId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as UserProfileExtended;
}

// ============================================================
// NOTIFICATION SETTINGS
// ============================================================

export async function getMyNotificationSettings(
  authUserId: string
): Promise<UserNotificationSettings | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_notification_settings")
    .select("*")
    .eq("user_id", authUserId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = not found (single row)
    throw new Error(error.message);
  }

  return data as unknown as UserNotificationSettings | null;
}

export async function upsertNotificationSettings(
  authUserId: string,
  settings: Partial<Omit<UserNotificationSettings, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<UserNotificationSettings> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_notification_settings")
    .upsert(
      {
        user_id: authUserId,
        ...settings,
      } as never,
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as UserNotificationSettings;
}

// ============================================================
// MIKE CONFIG (singleton — admin only para edição, leitura pública)
// ============================================================

export async function getMikeConfig(): Promise<MikeConfig | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("mike_config")
    .select("*")
    .limit(1)
    .maybeSingle();

  // Se RLS bloqueou (retorna null sem erro), tentar via rpc ou retornar config padrão
  if (error) {
    console.error("[getMikeConfig] Erro:", error.message);
    return null;
  }

  // Se não encontrou dados (RLS pode ter bloqueado), retornar config padrão para dev
  if (!data) {
    console.warn("[getMikeConfig] Nenhum dado retornado - RLS pode estar bloqueando. Retornando config padrão.");
    return getDefaultMikeConfig();
  }

  return data as unknown as MikeConfig;
}

/**
 * Config padrão do Mike para quando RLS bloqueia leitura no client
 */
function getDefaultMikeConfig(): MikeConfig {
  return {
    id: "default",
    enabled_groups: {
      "120363154727577617@g.us": "Marketing 2.0 L.A",
      "120363422932217390@g.us": "Marketing LA Music",
    },
    agent_trigger_names: ["mike", "maike", "maik", "mik"],
    group_session_timeout_minutes: 5,
    group_memory_hours_back: 4,
    group_memory_max_messages: 50,
    group_memory_retention_days: 7,
    personality_tone: "casual_profissional",
    personality_emoji_level: "moderado",
    default_ai_model: "gemini-2.5-flash-preview-05-20",
    fallback_ai_model: "gpt-4.1",
    max_output_tokens: 4096,
    bot_phone_number: "5521989784688",
    is_enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function updateMikeConfig(
  configId: string,
  updates: Partial<
    Omit<MikeConfig, "id" | "created_at" | "updated_at">
  >
): Promise<MikeConfig> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("mike_config")
    .update(updates as never)
    .eq("id", configId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as MikeConfig;
}

// ============================================================
// TEAM — Gerenciamento completo via Edge Function + RPC
// ============================================================

const EDGE_FN_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-team`
  : "https://rhxqwraqpabgecgojytj.supabase.co/functions/v1/manage-team";

async function callManageTeam(body: Record<string, unknown>) {
  const res = await fetch(EDGE_FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro na operação");
  return data;
}

/** Lista todos os membros com email (via RPC security definer) */
export async function getTeamMembersWithEmail(): Promise<TeamMemberWithEmail[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("get_team_members_with_email");

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TeamMemberWithEmail[];
}

/** Fallback: lista membros sem email */
export async function getTeamMembers(): Promise<UserProfileExtended[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .is("deleted_at", null)
    .order("is_admin", { ascending: false })
    .order("full_name");

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as UserProfileExtended[];
}

/** Criar novo membro (auth + perfil) */
export async function createTeamMember(params: {
  email: string;
  password: string;
  full_name: string;
  display_name?: string;
  phone?: string;
  role: string;
}) {
  return callManageTeam({ action: "create", ...params });
}

/** Atualizar membro existente */
export async function updateTeamMember(
  profileId: string,
  updates: {
    full_name?: string;
    display_name?: string;
    phone?: string;
    role?: string;
  }
) {
  return callManageTeam({ action: "update", profile_id: profileId, ...updates });
}

/** Desativar membro (bloqueia login) */
export async function deactivateTeamMember(profileId: string) {
  return callManageTeam({ action: "deactivate", profile_id: profileId });
}

/** Reativar membro */
export async function reactivateTeamMember(profileId: string) {
  return callManageTeam({ action: "reactivate", profile_id: profileId });
}

/** Resetar senha de membro */
export async function resetMemberPassword(profileId: string, newPassword: string) {
  return callManageTeam({ action: "reset-password", profile_id: profileId, new_password: newPassword });
}

/** Atualizar role (compat legado) */
export async function updateTeamMemberRole(
  profileId: string,
  updates: { role?: string; is_admin?: boolean }
) {
  return callManageTeam({ action: "update", profile_id: profileId, ...updates });
}

// ============================================================
// LEMBRETES — WA-08
// ============================================================

export interface ScheduledReminder {
  id: string;
  content: string;
  scheduled_for: string;
  status: string;
  source: string;
  recurrence: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Busca lembretes do usuário (pendentes e enviados recentes).
 * Filtra por source IN (manual, calendar_reminder, dashboard).
 */
export async function getMyReminders(
  profileId: string,
  limit = 20
): Promise<ScheduledReminder[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("whatsapp_scheduled_messages")
    .select("id, content, scheduled_for, status, source, recurrence, metadata, created_at")
    .eq("target_user_id", profileId)
    .in("source", ["manual", "calendar_reminder", "dashboard"])
    .in("status", ["pending", "sent"])
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ScheduledReminder[];
}

/**
 * Cria um lembrete pelo dashboard.
 * Reutiliza a mesma estrutura do action-executor.ts (source='dashboard').
 */
export async function createDashboardReminder(
  profileId: string,
  params: { content: string; scheduledFor: string; recurrence?: string | null }
): Promise<ScheduledReminder> {
  const supabase = getSupabase();

  // Buscar telefone do usuário
  const { data: connData } = await supabase
    .from("whatsapp_connections")
    .select("phone_number")
    .eq("user_id", profileId)
    .eq("is_active", true)
    .single();

  const conn = connData as { phone_number: string } | null;
  if (!conn?.phone_number) {
    throw new Error("Nenhum WhatsApp conectado. Conecte seu número primeiro.");
  }

  const { data, error } = await supabase
    .from("whatsapp_scheduled_messages")
    .insert({
      target_type: "user",
      target_user_id: profileId,
      target_phone: conn.phone_number,
      message_type: "text",
      content: `⏰ *Lembrete*\n\n${params.content}`,
      scheduled_for: params.scheduledFor,
      status: "pending",
      source: "dashboard",
      recurrence: params.recurrence || null,
      metadata: {
        source_reference: `dash:${Date.now()}`,
        created_via: "dashboard",
        original_text: params.content,
        recurrence: params.recurrence || null,
      },
    } as never)
    .select("id, content, scheduled_for, status, source, recurrence, metadata, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as ScheduledReminder;
}

/**
 * Atualiza horário e/ou recorrência de um lembrete pendente.
 */
export async function updateReminder(
  reminderId: string,
  params: { scheduledFor?: string; recurrence?: string | null }
): Promise<void> {
  const supabase = getSupabase();
  const updates: Record<string, unknown> = {};
  if (params.scheduledFor !== undefined) updates.scheduled_for = params.scheduledFor;
  if (params.recurrence !== undefined) updates.recurrence = params.recurrence;
  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase
    .from("whatsapp_scheduled_messages")
    .update(updates as never)
    .eq("id", reminderId)
    .eq("status", "pending");

  if (error) throw new Error(error.message);
}

/**
 * Cancela um lembrete pendente.
 */
export async function cancelReminder(reminderId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("whatsapp_scheduled_messages")
    .update({ status: "cancelled" } as never)
    .eq("id", reminderId)
    .eq("status", "pending");

  if (error) throw new Error(error.message);
}

/**
 * Busca histórico de notificações enviadas (últimas N).
 */
export async function getNotificationHistory(
  profileId: string,
  limit = 20
): Promise<ScheduledReminder[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("whatsapp_scheduled_messages")
    .select("id, content, scheduled_for, status, source, recurrence, metadata, created_at")
    .eq("target_user_id", profileId)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ScheduledReminder[];
}
