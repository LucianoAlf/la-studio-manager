"use client";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { UserProvider, useUser } from "@/contexts/user-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-cyan border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
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
        onToggle={() => setSidebarExpanded((value) => !value)}
        userInfo={userInfo}
      />
      <main
        className="flex min-h-0 flex-1 flex-col overflow-hidden transition-[margin] duration-200"
        style={{ marginLeft: sidebarExpanded ? 250 : 64 }}
      >
        {children}
      </main>
    </div>
  );
}

export function DashboardClientLayout({
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
