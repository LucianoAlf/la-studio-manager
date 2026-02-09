"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Robot, SpinnerGap, FloppyDisk, Plus, Trash } from "@phosphor-icons/react";
import type { MikeConfig } from "@/lib/types/settings";
import { updateMikeConfig } from "@/lib/queries/settings";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";

interface MikeSectionProps {
  config: MikeConfig;
  isAdmin: boolean;
  onConfigUpdated: (config: MikeConfig) => void;
}

const TONE_OPTIONS = [
  { value: "casual_profissional", label: "Casual Profissional" },
  { value: "formal", label: "Formal" },
  { value: "super_casual", label: "Super Casual" },
  { value: "tecnico", label: "Técnico" },
];

const EMOJI_LEVELS = [
  { value: "nenhum", label: "Nenhum" },
  { value: "pouco", label: "Pouco" },
  { value: "moderado", label: "Moderado" },
  { value: "muito", label: "Muito" },
];

export function MikeSection({ config, isAdmin, onConfigUpdated }: MikeSectionProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    enabled_groups: config.enabled_groups || {},
    agent_trigger_names: config.agent_trigger_names || [],
    group_session_timeout_minutes: config.group_session_timeout_minutes,
    group_memory_hours_back: config.group_memory_hours_back,
    group_memory_max_messages: config.group_memory_max_messages,
    group_memory_retention_days: config.group_memory_retention_days,
    personality_tone: config.personality_tone,
    personality_emoji_level: config.personality_emoji_level,
    default_ai_model: config.default_ai_model,
    fallback_ai_model: config.fallback_ai_model,
    max_output_tokens: config.max_output_tokens,
    bot_phone_number: config.bot_phone_number,
  });

  // Estado para novo grupo
  const [newGroupJid, setNewGroupJid] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  // Estado para novo trigger name
  const [newTriggerName, setNewTriggerName] = useState("");

  function addGroup() {
    if (!newGroupJid.trim() || !newGroupName.trim()) return;
    setForm((prev) => ({
      ...prev,
      enabled_groups: { ...prev.enabled_groups, [newGroupJid.trim()]: newGroupName.trim() },
    }));
    setNewGroupJid("");
    setNewGroupName("");
  }

  function removeGroup(jid: string) {
    setForm((prev) => {
      const updated = { ...prev.enabled_groups };
      delete updated[jid];
      return { ...prev, enabled_groups: updated };
    });
  }

  function addTriggerName() {
    if (!newTriggerName.trim()) return;
    const name = newTriggerName.trim().toLowerCase();
    if (form.agent_trigger_names.includes(name)) return;
    setForm((prev) => ({
      ...prev,
      agent_trigger_names: [...prev.agent_trigger_names, name],
    }));
    setNewTriggerName("");
  }

  function removeTriggerName(name: string) {
    setForm((prev) => ({
      ...prev,
      agent_trigger_names: prev.agent_trigger_names.filter((n) => n !== name),
    }));
  }

  async function handleSave() {
    try {
      setSaving(true);
      const updated = await updateMikeConfig(config.id, form);
      onConfigUpdated(updated);
      toast.success("Configurações do Mike salvas!");
    } catch (err) {
      toast.error("Erro ao salvar: " + (err instanceof Error ? err.message : "Erro desconhecido"));
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "h-9 px-3 rounded-lg bg-slate-800/60 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-accent-cyan/40 focus:border-accent-cyan/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  if (!isAdmin) {
    return (
      <Card variant="default" className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-violet-500/10">
            <Robot size={20} weight="duotone" className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Mike (WhatsApp)</h2>
            <p className="text-xs text-slate-500">Configurações do agente IA</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-slate-500">
            Apenas administradores podem editar as configurações do Mike.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="default" className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-violet-500/10">
          <Robot size={20} weight="duotone" className="text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Mike (WhatsApp)</h2>
          <p className="text-xs text-slate-500">Configurações globais do agente IA</p>
        </div>
      </div>

      {/* === GRUPOS HABILITADOS === */}
      <div className="space-y-3 pb-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-300">Grupos Habilitados</h3>
        <p className="text-xs text-slate-500">Grupos do WhatsApp onde o Mike pode operar</p>

        {Object.entries(form.enabled_groups).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(form.enabled_groups).map(([jid, name]) => (
              <div
                key={jid}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-800"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-slate-200 font-medium">{name}</span>
                  <span className="block text-[11px] text-slate-600 truncate">{jid}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeGroup(jid)}
                  className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  aria-label={`Remover grupo ${name}`}
                >
                  <Trash size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-600 italic">Nenhum grupo habilitado</p>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newGroupJid}
            onChange={(e) => setNewGroupJid(e.target.value)}
            placeholder="JID do grupo (ex: 120363...@g.us)"
            className={inputClass + " flex-1 min-w-0"}
          />
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Nome do grupo"
            className={inputClass + " w-40"}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={addGroup}
            disabled={!newGroupJid.trim() || !newGroupName.trim()}
          >
            <Plus size={14} />
          </Button>
        </div>
      </div>

      {/* === TRIGGER NAMES === */}
      <div className="space-y-3 pb-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-300">Nomes de Ativação</h3>
        <p className="text-xs text-slate-500">Palavras que ativam o Mike nos grupos</p>

        <div className="flex flex-wrap gap-2">
          {form.agent_trigger_names.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-300 text-xs font-medium border border-violet-500/20"
            >
              {name}
              <button
                type="button"
                onClick={() => removeTriggerName(name)}
                className="text-violet-400 hover:text-red-400 transition-colors"
                aria-label={`Remover ${name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newTriggerName}
            onChange={(e) => setNewTriggerName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTriggerName()}
            placeholder="Novo nome (ex: mike)"
            className={inputClass + " w-48"}
          />
          <Button variant="outline" size="sm" onClick={addTriggerName} disabled={!newTriggerName.trim()}>
            <Plus size={14} />
          </Button>
        </div>
      </div>

      {/* === PERSONALIDADE === */}
      <div className="space-y-3 pb-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-300">Personalidade</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Tom de voz</label>
            <Select
              value={form.personality_tone}
              onValueChange={(v) => setForm((prev) => ({ ...prev, personality_tone: v }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Nível de emojis</label>
            <Select
              value={form.personality_emoji_level}
              onValueChange={(v) => setForm((prev) => ({ ...prev, personality_emoji_level: v }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMOJI_LEVELS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* === SESSÃO DE GRUPO === */}
      <div className="space-y-3 pb-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-300">Sessão de Grupo</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Timeout (min)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={form.group_session_timeout_minutes}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  group_session_timeout_minutes: Number(e.target.value),
                }))
              }
              className={inputClass + " w-full"}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Contexto (horas)</label>
            <input
              type="number"
              min={1}
              max={24}
              value={form.group_memory_hours_back}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, group_memory_hours_back: Number(e.target.value) }))
              }
              className={inputClass + " w-full"}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Máx. mensagens</label>
            <input
              type="number"
              min={10}
              max={200}
              value={form.group_memory_max_messages}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  group_memory_max_messages: Number(e.target.value),
                }))
              }
              className={inputClass + " w-full"}
            />
          </div>
        </div>
      </div>

      {/* === MODELO IA === */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Modelo de IA</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Modelo principal</label>
            <input
              type="text"
              value={form.default_ai_model}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, default_ai_model: e.target.value }))
              }
              className={inputClass + " w-full"}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Modelo fallback</label>
            <input
              type="text"
              value={form.fallback_ai_model}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, fallback_ai_model: e.target.value }))
              }
              className={inputClass + " w-full"}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Max output tokens</label>
            <input
              type="number"
              min={1024}
              max={16384}
              step={512}
              value={form.max_output_tokens}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, max_output_tokens: Number(e.target.value) }))
              }
              className={inputClass + " w-full"}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400">Número do bot</label>
            <input
              type="text"
              value={form.bot_phone_number}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, bot_phone_number: e.target.value }))
              }
              className={inputClass + " w-full"}
            />
          </div>
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
          {saving ? "Salvando..." : "Salvar configurações do Mike"}
        </Button>
      </div>
    </Card>
  );
}
