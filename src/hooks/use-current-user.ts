"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfileExtended } from "@/lib/types/settings";

interface CurrentUser {
  authUserId: string;
  profile: UserProfileExtended;
  isAdmin: boolean;
}

interface UseCurrentUserReturn {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCurrentUser(): UseCurrentUserReturn {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchUser() {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setUser(null);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", authUser.id)
        .single();

      if (profileError || !profile) {
        setError("Perfil não encontrado");
        setUser(null);
        return;
      }

      const typedProfile = profile as unknown as UserProfileExtended;

      setUser({
        authUserId: authUser.id,
        profile: typedProfile,
        isAdmin: typedProfile.is_admin === true || typedProfile.role === "admin",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar usuário");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUser();
  }, []);

  return { user, loading, error, refetch: fetchUser };
}
