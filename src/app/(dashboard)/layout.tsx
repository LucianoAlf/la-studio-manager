"use client";

import { useEffect } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ensureUserProfile } from "@/lib/supabase/ensure-profile";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Garantir que o usuário logado tenha um perfil
  useEffect(() => {
    ensureUserProfile();
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-50">
      <AppSidebar />
      {/* Main content with margin for fixed sidebar */}
      <main className="flex flex-1 flex-col ml-72 transition-all">
        {children}
      </main>
    </div>
  );
}
