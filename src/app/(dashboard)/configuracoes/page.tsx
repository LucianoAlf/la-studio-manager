"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Header } from "@/components/layout/header";
import { getMyProfileWithEmail, getMyNotificationSettings, getMikeConfig, getTeamMembersWithEmail } from "@/lib/queries/settings";
import type { UserNotificationSettings, MikeConfig, UserProfileExtended, TeamMemberWithEmail } from "@/lib/types/settings";
import { ProfileSection } from "./_components/profile-section";
import { NotificationsSection } from "./_components/notifications-section";
import { MikeSection } from "./_components/mike-section";
import { TeamSection } from "./_components/team-section";
import { RemindersSection } from "./_components/reminders-section";
import { SpinnerGap } from "@phosphor-icons/react";
import { motion, LayoutGroup } from "framer-motion";

type TabId = "perfil" | "notificacoes" | "mike" | "equipe";

const ALL_TABS: { id: TabId; label: string; adminOnly?: boolean }[] = [
  { id: "perfil", label: "Perfil" },
  { id: "notificacoes", label: "Notificações" },
  { id: "mike", label: "Mike", adminOnly: true },
  { id: "equipe", label: "Equipe", adminOnly: true },
];

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("perfil");

  // Data states
  const [profile, setProfile] = useState<UserProfileExtended | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [notifSettings, setNotifSettings] = useState<UserNotificationSettings | null>(null);
  const [mikeConfig, setMikeConfig] = useState<MikeConfig | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberWithEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = profile?.is_admin === true || profile?.role === "admin";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Buscar perfil + email (com fallback para iframe)
      const { profile: myProfile, email } = await getMyProfileWithEmail();
      if (!myProfile) {
        setError("Não foi possível carregar seu perfil.");
        return;
      }
      setProfile(myProfile);
      setUserEmail(email);

      const profileIsAdmin = myProfile.is_admin === true || myProfile.role === "admin";

      // Buscar dados adicionais em paralelo
      const [notif, mike, team] = await Promise.all([
        getMyNotificationSettings(myProfile.user_id).catch(() => null),
        profileIsAdmin ? getMikeConfig().catch(() => null) : Promise.resolve(null),
        getTeamMembersWithEmail().catch(() => []),
      ]);
      setNotifSettings(notif);
      setMikeConfig(mike);
      setTeamMembers(team);
    } catch (err) {
      console.error("Erro ao carregar configurações:", err);
      setError("Erro ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Loading state
  if (loading) {
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

  // Erro ou sem perfil
  if (error || !profile) {
    return (
      <>
        <Header title="Configurações" subtitle="Sistema" />
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-slate-500">{error || "Não foi possível carregar seu perfil."}</p>
        </div>
      </>
    );
  }

  function handleProfileUpdated(updated: UserProfileExtended) {
    setProfile(updated);
  }

  return (
    <>
      <Header title="Configurações" subtitle="Sistema" />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
          {/* Tabs com sliding indicator */}
          <LayoutGroup>
            <nav className="relative flex p-1 rounded-xl bg-slate-900/60 border border-slate-800">
              {ALL_TABS.filter((tab) => !tab.adminOnly || isAdmin).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="relative flex-1 px-4 py-2 text-sm font-medium z-10"
                >
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute inset-0 rounded-lg bg-slate-800 shadow-sm -z-10"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                  <span className={activeTab === tab.id ? "text-slate-100" : "text-slate-500 hover:text-slate-300"}>
                    {tab.label}
                  </span>
                </button>
              ))}
            </nav>
          </LayoutGroup>

          {/* Content */}
          {activeTab === "perfil" && (
            <ProfileSection
              profile={profile}
              email={userEmail || undefined}
              onProfileUpdated={handleProfileUpdated}
            />
          )}

          {activeTab === "notificacoes" && (
            <>
              <NotificationsSection
                authUserId={profile.user_id}
                settings={notifSettings}
                onSettingsUpdated={setNotifSettings}
              />
              <RemindersSection profileId={profile.id} />
            </>
          )}

          {activeTab === "mike" && (
            mikeConfig ? (
              <MikeSection
                config={mikeConfig}
                isAdmin={isAdmin}
                onConfigUpdated={setMikeConfig}
              />
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-slate-500">
                  {isAdmin
                    ? "Configuração do Mike não encontrada. Verifique a tabela mike_config."
                    : "Apenas administradores podem ver as configurações do Mike."}
                </p>
              </div>
            )
          )}

          {activeTab === "equipe" && (
            <TeamSection
              members={teamMembers}
              isAdmin={isAdmin}
              currentProfileId={profile.id}
              onMembersUpdated={(updated) => setTeamMembers(updated)}
            />
          )}
        </div>
      </div>
    </>
  );
}
