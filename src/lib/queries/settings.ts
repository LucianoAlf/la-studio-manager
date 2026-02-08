// ============================================================
// QUERIES — Configurações (WA-07)
// ============================================================

import { createClient } from "@/lib/supabase/client";
import type {
  UserNotificationSettings,
  MikeConfig,
  UserProfileExtended,
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
 * Tenta buscar perfil via auth, fallback para primeiro perfil ativo.
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

  // Fallback: primeiro perfil ativo (para dev/iframe)
  return getFirstActiveProfile();
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
      "120363422032217390@g.us": "Marketing LA Music",
    },
    agent_trigger_names: ["mike", "maike", "maik", "mik"],
    group_session_timeout_minutes: 30,
    group_memory_hours_back: 24,
    group_memory_max_messages: 50,
    group_memory_retention_days: 7,
    personality_tone: "Assistente criativo e proativo da equipe de marketing da LA Music.",
    personality_emoji_level: "moderate",
    default_ai_model: "gemini-2.0-flash",
    fallback_ai_model: "gpt-4.1-mini",
    max_output_tokens: 2048,
    bot_phone_number: "5521989784688",
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
// TEAM (read-only para todos, admin pode editar roles)
// ============================================================

export async function getTeamMembers(): Promise<UserProfileExtended[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("full_name");

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as UserProfileExtended[];
}

export async function updateTeamMemberRole(
  profileId: string,
  updates: { role?: string; is_admin?: boolean }
): Promise<UserProfileExtended> {
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
