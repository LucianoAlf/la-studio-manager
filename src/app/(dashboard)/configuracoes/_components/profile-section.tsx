"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SpinnerGap, User, FloppyDisk } from "@phosphor-icons/react";
import type { UserProfileExtended } from "@/lib/types/settings";
import { updateMyProfile } from "@/lib/queries/settings";
import { toast } from "sonner";

interface ProfileSectionProps {
  profile: UserProfileExtended;
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

export function ProfileSection({ profile, onProfileUpdated }: ProfileSectionProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: profile.full_name || "",
    display_name: profile.display_name || "",
    phone: profile.phone || "",
    bio: profile.bio || "",
    specializations: profile.specializations || [],
  });

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
        phone: form.phone || null,
        bio: form.bio || null,
        specializations: form.specializations,
      });
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

  return (
    <Card variant="default" className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-accent-cyan/10">
          <User size={20} weight="duotone" className="text-accent-cyan" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Meu Perfil</h2>
          <p className="text-xs text-slate-500">Informações pessoais e especializações</p>
        </div>
      </div>

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
            {profile.role === "admin" ? "Administrador" : profile.role === "editor" ? "Editor" : profile.role === "developer" ? "Desenvolvedor" : "Visualizador"}
            {profile.is_admin && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-accent-cyan/20 text-accent-cyan">
                ADMIN
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bio */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-300">Bio / Sobre você</label>
        <textarea
          value={form.bio}
          onChange={(e) => handleChange("bio", e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/40 resize-none"
          placeholder="Conte um pouco sobre você, suas habilidades e experiência. O Mike usará isso para te conhecer melhor."
        />
        <p className="text-[11px] text-slate-600">
          Essa informação alimenta o conhecimento do Mike sobre a equipe.
        </p>
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

      {/* Salvar */}
      <div className="flex justify-end pt-2">
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
