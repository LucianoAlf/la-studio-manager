"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SpinnerGap, User, FloppyDisk, Eye, EyeSlash, Key, EnvelopeSimple, CaretDown } from "@phosphor-icons/react";
import type { UserProfileExtended } from "@/lib/types/settings";
import { updateMyProfile, updateContactPhone } from "@/lib/queries/settings";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface ProfileSectionProps {
  profile: UserProfileExtended;
  email?: string; // Email do auth.users (read-only)
  onProfileUpdated: (profile: UserProfileExtended) => void;
}

const SPECIALIZATION_OPTIONS = [
  "Vídeo",
  "Fotografia",
  "Design Gráfico",
  "Copywriting",
  "Social Media",
  "Tráfego Pago",
  "Edição de Vídeo",
  "Motion Graphics",
  "Áudio/Podcast",
  "Estratégia",
  "Gestão de Projetos",
  "Desenvolvimento",
];

export function ProfileSection({ profile, email, onProfileUpdated }: ProfileSectionProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: profile.full_name || "",
    display_name: profile.display_name || "",
    phone: profile.phone || "",
    bio: profile.bio || "",
    specializations: profile.specializations || [],
  });

  // Estado para seção de senha
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Estado para avatar
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);

  function handleChange(field: string, value: string | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleSpecialization(spec: string) {
    setForm((prev) => ({
      ...prev,
      specializations: prev.specializations.includes(spec)
        ? prev.specializations.filter((s) => s !== spec)
        : [...prev.specializations, spec],
    }));
  }

  async function handleSave() {
    try {
      setSaving(true);
      const updated = await updateMyProfile(profile.id, {
        full_name: form.full_name,
        display_name: form.display_name || null,
        bio: form.bio || null,
        specializations: form.specializations,
      });
      // Salvar telefone em contacts (fonte única de verdade)
      if (form.phone !== (profile.phone || "")) {
        await updateContactPhone(profile.id, form.phone || null);
      }
      if (updated) {
        onProfileUpdated(updated);
        toast.success("Perfil atualizado com sucesso!");
      }
    } catch (err) {
      toast.error("Erro ao salvar perfil: " + (err instanceof Error ? err.message : "Erro desconhecido"));
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!newPassword || !confirmPassword) {
      toast.error("Preencha a nova senha e a confirmação.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    try {
      setChangingPassword(true);
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) {
        throw new Error(error.message);
      }

      toast.success("Senha alterada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordSection(false);
    } catch (err) {
      toast.error("Erro ao alterar senha: " + (err instanceof Error ? err.message : "Erro desconhecido"));
    } finally {
      setChangingPassword(false);
    }
  }

  function handleAvatarUpdated(newUrl: string) {
    setAvatarUrl(newUrl);
    onProfileUpdated({ ...profile, avatar_url: newUrl });
    toast.success("Foto atualizada com sucesso!");
  }

  return (
    <Card variant="default" className="space-y-6">
      {/* Header com Avatar */}
      <div className="flex items-start gap-4">
        <AvatarUpload
          currentAvatarUrl={avatarUrl}
          profileId={profile.id}
          onAvatarUpdated={handleAvatarUpdated}
        />
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-slate-100">Meu Perfil</h2>
          <p className="text-xs text-slate-500">Informações pessoais e especializações</p>
          <p className="text-[11px] text-slate-600 mt-1">Clique na foto para alterar</p>
        </div>
      </div>

      {/* Informações Pessoais */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <User size={16} weight="duotone" className="text-accent-cyan" />
          Informações Pessoais
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
        {/* Nome completo */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-300">Nome completo</label>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => handleChange("full_name", e.target.value)}
            className="w-full h-9 px-3 rounded-lg bg-slate-800/60 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/40"
            placeholder="Seu nome completo"
          />
        </div>

        {/* Nome de exibição */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-300">Nome de exibição</label>
          <input
            type="text"
            value={form.display_name}
            onChange={(e) => handleChange("display_name", e.target.value)}
            className="w-full h-9 px-3 rounded-lg bg-slate-800/60 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/40"
            placeholder="Como quer ser chamado"
          />
        </div>

        {/* Telefone */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-300">Telefone (WhatsApp)</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            className="w-full h-9 px-3 rounded-lg bg-slate-800/60 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/40"
            placeholder="+5521999999999"
          />
        </div>

        {/* Role (read-only) */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-300">Cargo</label>
          <div className="flex items-center h-9 px-3 rounded-lg bg-slate-800/30 border border-slate-700/50 text-sm text-slate-400">
            {profile.role === "admin" ? "Administrador" : "Usuário"}
            {profile.is_admin && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-accent-cyan/20 text-accent-cyan">
                ADMIN
              </span>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Sobre Você (usado pelo Mike) */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-300">Sobre Você</h3>
        <p className="text-[11px] text-slate-500 -mt-2">O Mike usa essas informações para conhecer a equipe e direcionar tarefas.</p>

        {/* Bio */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-300">Bio / Descrição</label>
          <textarea
            value={form.bio}
            onChange={(e) => handleChange("bio", e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/40 resize-none"
            placeholder="Conte um pouco sobre você, suas habilidades e experiência."
          />
        </div>

        {/* Especializações */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Especializações</label>
          <div className="flex flex-wrap gap-2">
            {SPECIALIZATION_OPTIONS.map((spec) => {
              const isActive = form.specializations.includes(spec);
              return (
                <button
                  key={spec}
                  type="button"
                  onClick={() => toggleSpecialization(spec)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30"
                      : "bg-slate-800/60 text-slate-400 border border-slate-700 hover:border-slate-600 hover:text-slate-300"
                  }`}
                >
                  {spec}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Conta */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Key size={16} weight="duotone" className="text-accent-cyan" />
          Conta
        </h3>

        {/* Email (read-only) */}
        {email && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <EnvelopeSimple size={14} />
              Email
            </label>
            <div className="flex items-center h-9 px-3 rounded-lg bg-slate-800/30 border border-slate-700/50 text-sm text-slate-400">
              {email}
              <span className="ml-auto text-[10px] text-slate-600">Não editável</span>
            </div>
          </div>
        )}

        {/* Alterar Senha */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors"
          >
            <Key size={14} />
            Alterar senha
            <CaretDown
              size={14}
              className={`transition-transform ${showPasswordSection ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence>
            {showPasswordSection && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Nova senha</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full h-9 px-3 pr-10 rounded-lg bg-slate-800/60 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/40"
                        placeholder="Mínimo 8 caracteres"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Confirmar senha</label>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg bg-slate-800/60 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/40"
                      placeholder="Repita a nova senha"
                    />
                  </div>

                  <Button
                    onClick={handleChangePassword}
                    disabled={changingPassword}
                    size="sm"
                  >
                    {changingPassword ? (
                      <SpinnerGap size={14} className="animate-spin" />
                    ) : (
                      <Key size={14} />
                    )}
                    {changingPassword ? "Alterando..." : "Alterar senha"}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Salvar Perfil */}
      <div className="flex justify-end pt-2 border-t border-slate-800">
        <Button onClick={handleSave} disabled={saving} size="md">
          {saving ? (
            <SpinnerGap size={16} className="animate-spin" />
          ) : (
            <FloppyDisk size={16} weight="duotone" />
          )}
          {saving ? "Salvando..." : "Salvar perfil"}
        </Button>
      </div>
    </Card>
  );
}
