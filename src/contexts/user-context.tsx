"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfileExtended } from "@/lib/types/settings";

interface CurrentUser {
  authUserId: string;
  profile: UserProfileExtended;
  isAdmin: boolean;
  email?: string | null;
}

interface UserContextValue {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isInitialized: boolean;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  error: null,
  refresh: async () => {},
  isInitialized: false,
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  async function fetchUser() {
    // Se já temos usuário carregado e não está em estado de erro, não recarrega
    // A não ser que seja chamado explicitamente via refresh()
    if (isInitialized && user && !error) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      // Tentar restaurar sessão do localStorage primeiro (para Simple Browser)
      const storedToken = localStorage.getItem("la-studio-auth-token");
      let authUser = null;
      let email: string | null = null;

      if (storedToken) {
        const storedRefresh = localStorage.getItem("la-studio-auth-refresh") || "";
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: storedToken,
          refresh_token: storedRefresh,
        });
        if (sessionError || !sessionData.session?.user) {
          // Token expirado/inválido — limpar localStorage
          localStorage.removeItem("la-studio-auth-token");
          localStorage.removeItem("la-studio-auth-refresh");
        } else {
          authUser = sessionData.session.user;
          email = sessionData.session.user.email ?? null;
          // Atualizar tokens se renovados
          localStorage.setItem("la-studio-auth-token", sessionData.session.access_token);
          localStorage.setItem("la-studio-auth-refresh", sessionData.session.refresh_token);
        }
      }

      // Se não conseguiu via localStorage, tenta via cookies
      if (!authUser) {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          // Sessão expirada, token inválido, etc. → tratar como não autenticado
          setUser(null);
          setError("Não autenticado");
          return;
        }
        authUser = user;
        email = user?.email || null;
      }

      if (!authUser) {
        setUser(null);
        setError("Não autenticado");
        return;
      }

      // Buscar perfil
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(`Profile error: ${profileError.message}`);
      }

      if (!profile) {
        setError("Perfil não encontrado");
        setUser(null);
        return;
      }

      setUser({
        authUserId: authUser.id,
        profile: profile as unknown as UserProfileExtended,
        isAdmin: (profile as any).is_admin === true || (profile as any).role === "admin",
        email,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[UserContext] Error:", msg);
      setError(msg);
      setUser(null);
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  }

  useEffect(() => {
    fetchUser();
  }, []);

  const refresh = async () => {
    setIsInitialized(false);
    await fetchUser();
  };

  return (
    <UserContext.Provider value={{ user, loading, error, refresh, isInitialized }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser deve ser usado dentro de UserProvider");
  }
  return context;
}

// Hook legado para compatibilidade - agora usa o contexto
export function useCurrentUser() {
  const { user, loading, error, refresh } = useUser();
  return {
    user,
    loading,
    error,
    refetch: refresh,
  };
}
