import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/types/database";

function getSupabase() {
  return createClient();
}

export async function getCurrentUserProfile(): Promise<{ userId: string; profile: UserProfile } | null> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return profile ? { userId: user.id, profile: profile as unknown as UserProfile } : null;
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as unknown as UserProfile[];
}
