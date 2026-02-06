"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ensureUserProfile } from "@/lib/supabase/ensure-profile";
import { createClient } from "@/lib/supabase/client";

const AUTH_TOKEN_KEY = "la-studio-auth-token";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [debugMsg, setDebugMsg] = useState<string>("Verificando...");

  useEffect(() => {
    const checkAuth = async () => {
      // 1. Primeiro tentar localStorage manual (funciona no Simple Browser)
      const manualToken = localStorage.getItem(AUTH_TOKEN_KEY);
      setDebugMsg(`Token manual: ${manualToken ? "SIM" : "NÃO"}`);

      if (manualToken) {
        // Configurar sessão no Supabase a partir do localStorage manual
        const supabase = createClient();
        await supabase.auth.setSession({
          access_token: manualToken,
          refresh_token: localStorage.getItem("la-studio-auth-refresh") || "",
        });
        setIsAuthenticated(true);
        ensureUserProfile();
        return;
      }

      // 2. Fallback: verificar Supabase client (cookies/normal)
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.replace("/login");
      } else {
        setIsAuthenticated(true);
        ensureUserProfile();
      }
    };

    checkAuth();
  }, [router]);

  // Tela de loading enquanto verifica auth
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-50">
      <AppSidebar />
      {/* Main content with margin for fixed sidebar */}
      <main className="flex flex-1 flex-col ml-72 min-h-0 overflow-hidden transition-all">
        {children}
      </main>
    </div>
  );
}
