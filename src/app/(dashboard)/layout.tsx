"use client";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { UserProvider, useUser } from "@/contexts/user-context";
import { Toaster } from "@/components/ui/shadcn/sonner";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Componente interno que usa o contexto
function DashboardContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, error } = useUser();
  const router = useRouter();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  useEffect(() => {
    if (!loading && error === "Não autenticado") {
      router.replace("/login");
    }
  }, [loading, error, router]);

  // Tela de loading enquanto verifica auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null; // Redirecionando...
  }

  const userInfo = {
    displayName: user.profile.display_name || user.profile.full_name || "Usuário",
    fullName: user.profile.full_name || "Usuário",
    avatarUrl: user.profile.avatar_url || null,
    role: user.profile.role || "usuario",
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-50">
      <AppSidebar 
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(v => !v)}
        userInfo={userInfo}
      />
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

// Layout principal com Provider
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <DashboardContent>{children}</DashboardContent>
    </UserProvider>
  );
}
