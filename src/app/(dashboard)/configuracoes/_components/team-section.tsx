"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UsersThree, Shield, ShieldCheck } from "@phosphor-icons/react";
import type { UserProfileExtended } from "@/lib/types/settings";
import { updateTeamMemberRole } from "@/lib/queries/settings";
import { toast } from "sonner";

interface TeamSectionProps {
  members: UserProfileExtended[];
  isAdmin: boolean;
  currentProfileId: string;
  onMembersUpdated: (members: UserProfileExtended[]) => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  editor: "Editor",
  viewer: "Visualizador",
  developer: "Desenvolvedor",
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Administrador" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Visualizador" },
  { value: "developer", label: "Desenvolvedor" },
];

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

function getColor(name: string): string {
  const colors = ["#1AA8BF", "#A78BFA", "#F59E0B", "#22C55E", "#F97316", "#EF4444", "#06B6D4"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function TeamSection({
  members,
  isAdmin,
  currentProfileId,
  onMembersUpdated,
}: TeamSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleRoleChange(memberId: string, newRole: string) {
    try {
      const isAdminRole = newRole === "admin";
      await updateTeamMemberRole(memberId, {
        role: newRole,
        is_admin: isAdminRole,
      });

      const updated = members.map((m) =>
        m.id === memberId ? { ...m, role: newRole, is_admin: isAdminRole } : m
      );
      onMembersUpdated(updated);
      setEditingId(null);
      toast.success("Cargo atualizado!");
    } catch (err) {
      toast.error("Erro ao atualizar: " + (err instanceof Error ? err.message : "Erro"));
    }
  }

  return (
    <Card variant="default" className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-500/10">
          <UsersThree size={20} weight="duotone" className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Equipe</h2>
          <p className="text-xs text-slate-500">
            {members.length} membro{members.length !== 1 ? "s" : ""} ativo{members.length !== 1 ? "s" : ""}
            {!isAdmin && " — somente administradores podem editar cargos"}
          </p>
        </div>
      </div>

      {/* Lista de membros */}
      <div className="space-y-2">
        {members.map((member) => {
          const isCurrentUser = member.id === currentProfileId;
          const isEditing = editingId === member.id;

          return (
            <div
              key={member.id}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/30 border border-slate-800 hover:bg-slate-800/50 transition-colors"
            >
              {/* Avatar */}
              <Avatar
                size="md"
                initial={getInitial(member.full_name)}
                color={getColor(member.full_name)}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-200 truncate">
                    {member.full_name}
                  </span>
                  {isCurrentUser && (
                    <span className="text-[10px] font-medium text-accent-cyan bg-accent-cyan/10 px-1.5 py-0.5 rounded">
                      VOCÊ
                    </span>
                  )}
                  {member.is_admin && (
                    <ShieldCheck size={14} weight="fill" className="text-amber-400" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {member.phone && (
                    <span className="text-[11px] text-slate-500">{member.phone}</span>
                  )}
                  {member.specializations && member.specializations.length > 0 && (
                    <span className="text-[11px] text-slate-600">
                      · {member.specializations.slice(0, 3).join(", ")}
                      {member.specializations.length > 3 && ` +${member.specializations.length - 3}`}
                    </span>
                  )}
                </div>
              </div>

              {/* Role */}
              {isAdmin && !isCurrentUser ? (
                isEditing ? (
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                    onBlur={() => setEditingId(null)}
                    autoFocus
                    className="h-8 px-2 rounded-lg bg-slate-800 border border-slate-600 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 appearance-none cursor-pointer"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingId(member.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 bg-slate-800/60 border border-slate-700 hover:border-slate-600 hover:text-slate-300 transition-colors"
                  >
                    {member.is_admin ? (
                      <Shield size={12} weight="fill" className="text-amber-400" />
                    ) : null}
                    {ROLE_LABELS[member.role] || member.role}
                  </button>
                )
              ) : (
                <Badge variant="neutral" size="sm">
                  {ROLE_LABELS[member.role] || member.role}
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Info */}
      <p className="text-[11px] text-slate-600 text-center">
        Novos membros são adicionados via painel de autenticação do Supabase.
        <br />
        Ao fazer login pela primeira vez, o membro pode editar seu perfil e especializações.
      </p>
    </Card>
  );
}
