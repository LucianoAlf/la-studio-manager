"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ensureUserProfile } from "@/lib/supabase/ensure-profile";
import { createClient } from "@/lib/supabase/client";
import { Toaster } from "@/components/ui/shadcn/sonner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const authCheckedRef = useRef(false);

  useEffect(() => {
    // Evitar re-verificação de auth em navegações subsequentes
    if (authCheckedRef.current) return;

    const checkAuth = async () => {
      const supabase = createClient();

      // Restaurar sessão do localStorage (fallback para browsers que não persistem cookies)
      const storedToken = localStorage.getItem("la-studio-auth-token");
      if (storedToken) {
        const storedRefresh = localStorage.getItem("la-studio-auth-refresh") || "";
        const { data } = await supabase.auth.setSession({
          access_token: storedToken,
          refresh_token: storedRefresh,
        });
        // Atualizar tokens se foram renovados
        if (data.session) {
          localStorage.setItem("la-studio-auth-token", data.session.access_token);
          localStorage.setItem("la-studio-auth-refresh", data.session.refresh_token);
          authCheckedRef.current = true;
          setIsAuthenticated(true);
          ensureUserProfile();
          return;
        }
        // Token expirado e não renovável — limpar e redirecionar
        localStorage.removeItem("la-studio-auth-token");
        localStorage.removeItem("la-studio-auth-refresh");
      }

      // Verificar sessão via cookies (browser normal)
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
      } else {
        authCheckedRef.current = true;
        setIsAuthenticated(true);
        ensureUserProfile();
      }
    };

    checkAuth();
  }, [router]);

  // Tela de loading enquanto verifica auth (apenas no primeiro acesso)
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-50">
      <AppSidebar expanded={sidebarExpanded} onToggle={() => setSidebarExpanded((v) => !v)} />
      {/* Main content with margin for fixed sidebar */}
      <main
        className="flex flex-1 flex-col min-h-0 overflow-hidden transition-[margin] duration-200"
        style={{ marginLeft: sidebarExpanded ? 250 : 64 }}
      >
        {children}
      </main>
      <Toaster />
    </div>
  );
}
