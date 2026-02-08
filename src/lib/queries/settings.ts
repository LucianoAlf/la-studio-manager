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

export async function getMyProfile(): Promise<UserProfileExtended | null> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;
  return data as unknown as UserProfileExtended;
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
// MIKE CONFIG (singleton — admin only)
// ============================================================

export async function getMikeConfig(): Promise<MikeConfig | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("mike_config")
    .select("*")
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  return data as unknown as MikeConfig | null;
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
