"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getMyNotificationSettings, getMikeConfig, getTeamMembers } from "@/lib/queries/settings";
import type { UserNotificationSettings, MikeConfig, UserProfileExtended } from "@/lib/types/settings";
import { ProfileSection } from "./_components/profile-section";
import { NotificationsSection } from "./_components/notifications-section";
import { MikeSection } from "./_components/mike-section";
import { TeamSection } from "./_components/team-section";
import { SpinnerGap } from "@phosphor-icons/react";

type TabId = "perfil" | "notificacoes" | "mike" | "equipe";

const TABS: { id: TabId; label: string }[] = [
  { id: "perfil", label: "Perfil" },
  { id: "notificacoes", label: "Notificações" },
  { id: "mike", label: "Mike" },
  { id: "equipe", label: "Equipe" },
];

export default function ConfiguracoesPage() {
  const { user, loading: userLoading, refetch: refetchUser } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<TabId>("perfil");

  // Data states
  const [notifSettings, setNotifSettings] = useState<UserNotificationSettings | null>(null);
  const [mikeConfig, setMikeConfig] = useState<MikeConfig | null>(null);
  const [teamMembers, setTeamMembers] = useState<UserProfileExtended[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Carregar dados quando o usuário estiver disponível
  useEffect(() => {
    if (!user) {
      setDataLoading(false);
      return;
    }

    async function loadData() {
      setDataLoading(true);
      try {
        const [notif, mike, team] = await Promise.all([
          getMyNotificationSettings(user!.authUserId).catch((e) => { console.error("Erro notif:", e); return null; }),
          user!.isAdmin ? getMikeConfig().catch((e) => { console.error("Erro mike:", e); return null; }) : Promise.resolve(null),
          getTeamMembers().catch((e) => { console.error("Erro team:", e); return []; }),
        ]);
        setNotifSettings(notif);
        setMikeConfig(mike);
        setTeamMembers(team);
      } catch (err) {
        console.error("Erro ao carregar configurações:", err);
      } finally {
        setDataLoading(false);
      }
    }

    loadData();
  }, [user]);

  // Loading state
  if (userLoading || dataLoading) {
    return (
      <>
        <Header title="Configurações" subtitle="Sistema" />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex items-center gap-3 text-slate-400">
            <SpinnerGap size={24} className="animate-spin" />
            <span className="text-sm">Carregando configurações...</span>
          </div>
        </div>
      </>
    );
  }

  // Sem usuário
  if (!user) {
    return (
      <>
        <Header title="Configurações" subtitle="Sistema" />
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-slate-500">Não foi possível carregar seu perfil.</p>
        </div>
      </>
    );
  }

  function handleProfileUpdated(updated: UserProfileExtended) {
    refetchUser();
  }

  return (
    <>
      <Header title="Configurações" subtitle="Sistema" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
          {/* Tabs */}
          <nav className="flex gap-1 p-1 rounded-xl bg-slate-900/60 border border-slate-800">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-slate-800 text-slate-100 shadow-sm"
                    : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/40"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          {activeTab === "perfil" && (
            <ProfileSection
              profile={user.profile}
              onProfileUpdated={handleProfileUpdated}
            />
          )}

          {activeTab === "notificacoes" && (
            <NotificationsSection
              authUserId={user.authUserId}
              settings={notifSettings}
              onSettingsUpdated={setNotifSettings}
            />
          )}

          {activeTab === "mike" && (
            mikeConfig ? (
              <MikeSection
                config={mikeConfig}
                isAdmin={user.isAdmin}
                onConfigUpdated={setMikeConfig}
              />
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-slate-500">
                  {user.isAdmin
                    ? "Configuração do Mike não encontrada. Verifique a tabela mike_config."
                    : "Apenas administradores podem ver as configurações do Mike."}
                </p>
              </div>
            )
          )}

          {activeTab === "equipe" && (
            <TeamSection
              members={teamMembers}
              isAdmin={user.isAdmin}
              currentProfileId={user.profile.id}
              onMembersUpdated={setTeamMembers}
            />
          )}
        </div>
      </div>
    </>
  );
}
