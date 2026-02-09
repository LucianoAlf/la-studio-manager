"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  UsersThree,
  ShieldCheck,
  Plus,
  PencilSimple,
  UserMinus,
  UserPlus as UserPlusIcon,
  Key,
  Envelope,
  Phone,
  SpinnerGap,
  Warning,
  CheckCircle,
  XCircle,
  Eye,
  EyeSlash,
  X,
} from "@phosphor-icons/react";
import type { TeamMemberWithEmail } from "@/lib/types/settings";
import { ROLE_LABELS } from "@/lib/types/settings";
import {
  createTeamMember,
  updateTeamMember,
  deactivateTeamMember,
  reactivateTeamMember,
  resetMemberPassword,
} from "@/lib/queries/settings";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";

interface TeamSectionProps {
  members: TeamMemberWithEmail[];
  isAdmin: boolean;
  currentProfileId: string;
  onMembersUpdated: (members: TeamMemberWithEmail[]) => void;
}

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

// ============================================================
// MODAL: Criar Membro
// ============================================================
function CreateMemberModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("usuario");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !fullName || !password) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    if (password.length < 6) {
      setError("Senha deve ter no mínimo 6 caracteres.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createTeamMember({
        email,
        password,
        full_name: fullName,
        phone: phone || undefined,
        role,
      });
      toast.success(`Membro ${fullName} criado com sucesso!`);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar membro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <UserPlusIcon size={20} weight="duotone" className="text-accent-cyan" />
          Novo Membro
        </h3>

        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Email <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Envelope size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@lamusic.com.br"
              required
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/40"
            />
          </div>
        </div>

        {/* Nome */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Nome completo <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nome do membro"
            required
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/40"
          />
        </div>

        {/* Telefone */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Telefone (WhatsApp)
          </label>
          <div className="relative">
            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+5521999999999"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/40"
            />
          </div>
        </div>

        {/* Perfil de acesso */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Perfil de acesso <span className="text-red-400">*</span>
          </label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usuario">Usuário (acesso padrão)</SelectItem>
              <SelectItem value="admin">Administrador (acesso total)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Senha */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Senha inicial <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              className="w-full pl-9 pr-10 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/40"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-1">
            O membro pode alterar a senha no perfil dele após o primeiro login.
          </p>
        </div>

        {/* Erro */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <Warning size={14} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-accent-cyan text-slate-900 hover:bg-accent-cyan/90 transition-colors disabled:opacity-50"
          >
            {saving && <SpinnerGap size={14} className="animate-spin" />}
            {saving ? "Criando..." : "Criar membro"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}

// ============================================================
// MODAL: Editar Membro
// ============================================================
function EditMemberModal({
  member,
  onClose,
  onUpdated,
}: {
  member: TeamMemberWithEmail;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [fullName, setFullName] = useState(member.full_name);
  const [displayName, setDisplayName] = useState(member.display_name || "");
  const [phone, setPhone] = useState(member.phone || "");
  const [role, setRole] = useState(member.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset password
  const [showResetPw, setShowResetPw] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Nome é obrigatório.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateTeamMember(member.id, {
        full_name: fullName.trim(),
        display_name: displayName.trim() || fullName.trim().split(" ")[0],
        phone: phone.trim() || undefined,
        role,
      });
      toast.success("Perfil atualizado!");
      onUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres.");
      return;
    }
    setResettingPw(true);
    try {
      await resetMemberPassword(member.id, newPassword);
      toast.success(`Senha de ${member.full_name} resetada!`);
      setShowResetPw(false);
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao resetar senha");
    } finally {
      setResettingPw(false);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <PencilSimple size={20} weight="duotone" className="text-accent-cyan" />
          Editar Membro
        </h3>

        {/* Email (read-only) */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
          <div className="relative">
            <Envelope size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="email"
              value={member.email || "—"}
              disabled
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-sm text-slate-500 cursor-not-allowed"
            />
          </div>
        </div>

        {/* Nome completo */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Nome completo <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/40"
          />
        </div>

        {/* Nome de exibição */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Nome de exibição</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={fullName.split(" ")[0]}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/40"
          />
        </div>

        {/* Telefone */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Telefone (WhatsApp)</label>
          <div className="relative">
            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+5521999999999"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/40"
            />
          </div>
        </div>

        {/* Perfil de acesso */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Perfil de acesso</label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usuario">Usuário</SelectItem>
              <SelectItem value="admin">Administrador</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Resetar senha */}
        <div className="border-t border-slate-800 pt-3">
          {!showResetPw ? (
            <button
              type="button"
              onClick={() => setShowResetPw(true)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-amber-400 transition-colors"
            >
              <Key size={14} />
              Resetar senha deste membro
            </button>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">Nova senha</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    className="w-full px-3 pr-9 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showNewPw ? <EyeSlash size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resettingPw}
                  className="px-3 py-2 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                >
                  {resettingPw ? <SpinnerGap size={14} className="animate-spin" /> : "Resetar"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Erro */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <Warning size={14} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-accent-cyan text-slate-900 hover:bg-accent-cyan/90 transition-colors disabled:opacity-50"
          >
            {saving && <SpinnerGap size={14} className="animate-spin" />}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}

// ============================================================
// MODAL: Overlay genérico
// ============================================================
function ModalOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden border border-slate-700 shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// MODAL: Confirmação de desativação/reativação
// ============================================================
function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmVariant = "danger",
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: "danger" | "success";
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  const btnClass =
    confirmVariant === "danger"
      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
      : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30";

  return (
    <ModalOverlay onClose={onClose}>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Warning size={20} weight="duotone" className={confirmVariant === "danger" ? "text-red-400" : "text-emerald-400"} />
          {title}
        </h3>
        <p className="text-sm text-slate-400">{message}</p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${btnClass}`}
          >
            {loading && <SpinnerGap size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL: TeamSection
// ============================================================
export function TeamSection({
  members,
  isAdmin,
  currentProfileId,
  onMembersUpdated,
}: TeamSectionProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMemberWithEmail | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "deactivate" | "reactivate";
    member: TeamMemberWithEmail;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const activeMembers = members.filter((m) => m.is_active);
  const inactiveMembers = members.filter((m) => !m.is_active);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const { getTeamMembersWithEmail } = await import("@/lib/queries/settings");
      const fresh = await getTeamMembersWithEmail();
      onMembersUpdated(fresh);
    } catch {
      toast.error("Erro ao atualizar lista");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDeactivate(member: TeamMemberWithEmail) {
    try {
      await deactivateTeamMember(member.id);
      toast.success(`${member.full_name} desativado e acesso bloqueado.`);
      setConfirmAction(null);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao desativar");
    }
  }

  async function handleReactivate(member: TeamMemberWithEmail) {
    try {
      await reactivateTeamMember(member.id);
      toast.success(`${member.full_name} reativado!`);
      setConfirmAction(null);
      handleRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao reativar");
    }
  }

  function renderMemberRow(member: TeamMemberWithEmail) {
    const isCurrentUser = member.id === currentProfileId;

    return (
      <div
        key={member.id}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
          member.is_active
            ? "bg-slate-800/30 border-slate-800 hover:bg-slate-800/50"
            : "bg-slate-900/50 border-slate-800/50 opacity-60"
        }`}
      >
        {/* Avatar */}
        <Avatar
          size="md"
          initial={getInitial(member.full_name)}
          color={member.is_active ? getColor(member.full_name) : "#475569"}
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
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {member.email && (
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Envelope size={10} />
                {member.email}
              </span>
            )}
            {member.phone && (
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Phone size={10} />
                {member.phone}
              </span>
            )}
          </div>
        </div>

        {/* Status + Role */}
        <div className="flex items-center gap-2 shrink-0">
          {member.is_active ? (
            <Badge variant="status" color="#22C55E" size="sm">
              <CheckCircle size={10} weight="fill" className="mr-1" />
              {ROLE_LABELS[member.role] || member.role}
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm">
              <XCircle size={10} weight="fill" className="mr-1" />
              Inativo
            </Badge>
          )}

          {/* Ações (admin only, não pode editar a si mesmo) */}
          {isAdmin && !isCurrentUser && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setEditingMember(member)}
                title="Editar"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <PencilSimple size={14} />
              </button>
              {member.is_active ? (
                <button
                  type="button"
                  onClick={() => setConfirmAction({ type: "deactivate", member })}
                  title="Desativar"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <UserMinus size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmAction({ type: "reactivate", member })}
                  title="Reativar"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                >
                  <UserPlusIcon size={14} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <Card variant="default" className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-500/10">
              <UsersThree size={20} weight="duotone" className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Gerenciar Equipe</h2>
              <p className="text-xs text-slate-500">
                {activeMembers.length} ativo{activeMembers.length !== 1 ? "s" : ""}
                {inactiveMembers.length > 0 && ` · ${inactiveMembers.length} inativo${inactiveMembers.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent-cyan text-slate-900 hover:bg-accent-cyan/90 transition-colors"
            >
              <Plus size={16} weight="bold" />
              Novo Membro
            </button>
          )}
        </div>

        {/* Info box */}
        {isAdmin && (
          <div className="px-3 py-2.5 rounded-lg bg-accent-cyan/5 border border-accent-cyan/10">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <strong className="text-accent-cyan">Administrador:</strong> Acesso total — gerencia equipe, configurações e Mike.
              <br />
              <strong className="text-slate-300">Usuário:</strong> Acesso ao dashboard e projetos — não gerencia equipe.
            </p>
          </div>
        )}

        {/* Lista de membros ativos */}
        <div className="space-y-2">
          {activeMembers.map(renderMemberRow)}
        </div>

        {/* Membros inativos */}
        {inactiveMembers.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <p className="text-xs font-medium text-slate-600 uppercase tracking-wider">Inativos</p>
            {inactiveMembers.map(renderMemberRow)}
          </div>
        )}
      </Card>

      {/* Modais */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateMemberModal
            onClose={() => setShowCreateModal(false)}
            onCreated={handleRefresh}
          />
        )}

        {editingMember && (
          <EditMemberModal
            member={editingMember}
            onClose={() => setEditingMember(null)}
            onUpdated={handleRefresh}
          />
        )}

        {confirmAction?.type === "deactivate" && (
          <ConfirmModal
            title="Desativar membro"
            message={`Tem certeza que deseja desativar ${confirmAction.member.full_name}? O acesso será bloqueado imediatamente e todas as sessões ativas serão encerradas.`}
            confirmLabel="Desativar"
            confirmVariant="danger"
            onConfirm={() => handleDeactivate(confirmAction.member)}
            onClose={() => setConfirmAction(null)}
          />
        )}

        {confirmAction?.type === "reactivate" && (
          <ConfirmModal
            title="Reativar membro"
            message={`Deseja reativar ${confirmAction.member.full_name}? O acesso ao sistema será restaurado.`}
            confirmLabel="Reativar"
            confirmVariant="success"
            onConfirm={() => handleReactivate(confirmAction.member)}
            onClose={() => setConfirmAction(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
