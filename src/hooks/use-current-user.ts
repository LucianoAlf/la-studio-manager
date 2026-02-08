"use client";

import { useEffect, useState, useRef } from "react";
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

const TIMEOUT_MS = 10000; // 10 segundos timeout

export function useCurrentUser(): UseCurrentUserReturn {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  async function fetchUser() {
    // Limpar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Setar timeout de segurança
    timeoutRef.current = setTimeout(() => {
      console.warn("[useCurrentUser] Timeout - forçando fim do loading");
      setLoading(false);
      if (!user) {
        setError("Tempo de carregamento excedido. Tente recarregar a página.");
      }
    }, TIMEOUT_MS);

    try {
      setLoading(true);
      setError(null);

      console.log("[useCurrentUser] Iniciando...");
      const supabase = createClient();

      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.error("[useCurrentUser] Auth error:", authError.message);
        setError(`Erro de autenticação: ${authError.message}`);
        setUser(null);
        return;
      }

      if (!authUser) {
        console.warn("[useCurrentUser] Nenhum usuário logado");
        setError("Você precisa fazer login para acessar as configurações.");
        setUser(null);
        return;
      }

      console.log("[useCurrentUser] Buscando perfil para:", authUser.id);

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", authUser.id)
        .maybeSingle(); // Usar maybeSingle em vez de single para não dar erro se não encontrar

      if (profileError) {
        console.error("[useCurrentUser] Profile error:", profileError.message);
        setError(`Erro ao buscar perfil: ${profileError.message}`);
        setUser(null);
        return;
      }

      if (!profile) {
        console.error("[useCurrentUser] Perfil não encontrado para user_id:", authUser.id);
        setError("Perfil não encontrado. Entre em contato com o administrador.");
        setUser(null);
        return;
      }

      console.log("[useCurrentUser] Perfil carregado:", (profile as any).full_name);

      setUser({
        authUserId: authUser.id,
        profile: profile as unknown as UserProfileExtended,
        isAdmin: (profile as any).is_admin === true || (profile as any).role === "admin",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[useCurrentUser] Exceção:", msg);
      setError(`Erro inesperado: ${msg}`);
      setUser(null);
    } finally {
      setLoading(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  }

  useEffect(() => {
    fetchUser();
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { user, loading, error, refetch: fetchUser };
}
