"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bell, SpinnerGap, Plus, Trash, CalendarBlank,
  Clock, CheckCircle, PaperPlaneTilt, ArrowsClockwise,
  PencilSimple, FloppyDisk, X,
} from "@phosphor-icons/react";
import {
  getMyReminders,
  createDashboardReminder,
  cancelReminder,
  updateReminder,
  getNotificationHistory,
  type ScheduledReminder,
} from "@/lib/queries/settings";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";

interface RemindersSectionProps {
  profileId: string;
}

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  manual: { label: "Mike", color: "text-blue-400" },
  calendar_reminder: { label: "Calendário", color: "text-amber-400" },
  dashboard: { label: "Dashboard", color: "text-emerald-400" },
};

const RECURRENCE_OPTIONS = [
  { value: "none", label: "Único (sem repetição)" },
  { value: "daily", label: "Diariamente" },
  { value: "weekdays", label: "Dias úteis (Seg-Sex)" },
  { value: "weekly", label: "Semanalmente" },
  { value: "monthly", label: "Mensalmente" },
];

const RECURRENCE_LABELS: Record<string, string> = {
  daily: "Diário",
  weekdays: "Dias úteis",
  weekly: "Semanal",
  monthly: "Mensal",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day} às ${time}`;
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const target = new Date(iso).getTime();
  const diffMs = target - now;

  if (diffMs < 0) return "Enviado";

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `em ${diffMin}min`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `em ${diffH}h`;

  const diffD = Math.floor(diffH / 24);
  return `em ${diffD}d`;
}

export function RemindersSection({ profileId }: RemindersSectionProps) {
  const [reminders, setReminders] = useState<ScheduledReminder[]>([]);
  const [history, setHistory] = useState<ScheduledReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);

  // Form para novo lembrete
  const [newText, setNewText] = useState("");
  const [newDateTime, setNewDateTime] = useState("");
  const [newRecurrence, setNewRecurrence] = useState("none");
  const [creating, setCreating] = useState(false);

  const loadReminders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getMyReminders(profileId);
      setReminders(data);
    } catch (err) {
      console.error("Erro ao buscar lembretes:", err);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  async function loadHistory() {
    try {
      const data = await getNotificationHistory(profileId);
      setHistory(data);
      setShowHistory(true);
    } catch (err) {
      console.error("Erro ao buscar histórico:", err);
      toast.error("Erro ao carregar histórico");
    }
  }

  async function handleCreate() {
    if (!newText.trim() || !newDateTime) {
      toast.error("Preencha o texto e a data do lembrete");
      return;
    }

    try {
      setCreating(true);
      const scheduledFor = new Date(newDateTime).toISOString();

      if (new Date(scheduledFor) <= new Date()) {
        toast.error("A data do lembrete deve ser no futuro");
        return;
      }

      const recurrence = newRecurrence === "none" ? null : newRecurrence;

      await createDashboardReminder(profileId, {
        content: newText.trim(),
        scheduledFor,
        recurrence,
      });

      toast.success(recurrence ? "Lembrete recorrente criado!" : "Lembrete criado!");
      setNewText("");
      setNewDateTime("");
      setNewRecurrence("none");
      setShowNewForm(false);
      await loadReminders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar lembrete");
    } finally {
      setCreating(false);
    }
  }

  async function handleCancel(id: string) {
    try {
      await cancelReminder(id);
      toast.success("Lembrete cancelado");
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      toast.error("Erro ao cancelar lembrete");
    }
  }

  const pendingReminders = reminders.filter((r) => r.status === "pending");
  const sentReminders = reminders.filter((r) => r.status === "sent");

  const inputClass =
    "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-accent-cyan/50 focus:outline-none focus:ring-1 focus:ring-accent-cyan/30";

  return (
    <Card variant="default" className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-violet-500/10">
            <Clock size={20} weight="duotone" className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Meus Lembretes</h2>
            <p className="text-xs text-slate-500">
              Lembretes criados via Mike, calendário ou dashboard
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowNewForm(!showNewForm)}
          className="text-xs"
        >
          <Plus size={14} weight="bold" />
          Novo
        </Button>
      </div>

      {/* Formulário de novo lembrete */}
      {showNewForm && (
        <div className="space-y-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Ex: Revisar roteiro do vídeo da LA Kids"
            rows={2}
            className={inputClass + " resize-none"}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <DateTimePicker
              value={newDateTime}
              onChange={setNewDateTime}
              placeholder="Data e hora"
              className="w-52"
            />
            <div className="flex items-center gap-2">
              <ArrowsClockwise size={14} className="text-slate-400 flex-shrink-0" />
              <Select value={newRecurrence} onValueChange={setNewRecurrence}>
                <SelectTrigger className="w-48 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowNewForm(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={creating} className="text-xs">
              {creating ? (
                <SpinnerGap size={14} className="animate-spin" />
              ) : (
                <PaperPlaneTilt size={14} weight="duotone" />
              )}
              {creating ? "Criando..." : "Criar lembrete"}
            </Button>
          </div>
        </div>
      )}

      {/* Lista de lembretes pendentes */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <SpinnerGap size={24} className="animate-spin text-slate-500" />
        </div>
      ) : pendingReminders.length === 0 && sentReminders.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          <Bell size={32} weight="duotone" className="mx-auto mb-2 opacity-40" />
          <p>Nenhum lembrete ativo</p>
          <p className="text-xs mt-1">
            Crie lembretes aqui ou peça ao Mike via WhatsApp
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pendingReminders.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Pendentes ({pendingReminders.length})
              </h3>
              {pendingReminders.map((r) => (
                <ReminderItem
                  key={r.id}
                  reminder={r}
                  onCancel={() => handleCancel(r.id)}
                  onUpdate={loadReminders}
                />
              ))}
            </>
          )}

          {sentReminders.length > 0 && (
            <>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-4">
                Enviados recentes ({sentReminders.length})
              </h3>
              {sentReminders.slice(0, 5).map((r) => (
                <ReminderItem key={r.id} reminder={r} />
              ))}
            </>
          )}
        </div>
      )}

      {/* Botão de histórico */}
      <div className="flex justify-center pt-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={showHistory ? () => setShowHistory(false) : loadHistory}
          className="text-xs text-slate-500"
        >
          {showHistory ? "Ocultar histórico" : "Ver histórico de notificações"}
        </Button>
      </div>

      {/* Histórico */}
      {showHistory && history.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Histórico ({history.length})
          </h3>
          {history.map((r) => (
            <ReminderItem key={r.id} reminder={r} compact />
          ))}
        </div>
      )}

      {showHistory && history.length === 0 && (
        <p className="text-center text-xs text-slate-500 py-4">
          Nenhuma notificação enviada ainda
        </p>
      )}
    </Card>
  );
}

// ============================================
// COMPONENTE DE ITEM DE LEMBRETE
// ============================================

function ReminderItem({
  reminder,
  onCancel,
  onUpdate,
  compact = false,
}: {
  reminder: ScheduledReminder;
  onCancel?: () => void;
  onUpdate?: () => void;
  compact?: boolean;
}) {
  const isPending = reminder.status === "pending";
  const sourceInfo = SOURCE_LABELS[reminder.source] || {
    label: reminder.source,
    color: "text-slate-400",
  };

  // Estado de edição inline
  const [editing, setEditing] = useState(false);
  const [editDateTime, setEditDateTime] = useState("");
  const [editRecurrence, setEditRecurrence] = useState("none");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    // Converter ISO para formato do DateTimePicker (YYYY-MM-DDTHH:mm)
    const d = new Date(reminder.scheduled_for);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setEditDateTime(local);
    setEditRecurrence(reminder.recurrence || "none");
    setEditing(true);
  }

  async function handleSave() {
    if (!editDateTime) return;
    try {
      setSaving(true);
      const scheduledFor = new Date(editDateTime).toISOString();
      if (new Date(scheduledFor) <= new Date()) {
        toast.error("A data deve ser no futuro");
        return;
      }
      const recurrence = editRecurrence === "none" ? null : editRecurrence;
      await updateReminder(reminder.id, { scheduledFor, recurrence });
      toast.success("Lembrete atualizado!");
      setEditing(false);
      onUpdate?.();
    } catch (err) {
      toast.error("Erro ao atualizar lembrete");
    } finally {
      setSaving(false);
    }
  }

  // Extrair texto limpo (remover prefixo de emoji/bold do conteúdo)
  const cleanContent = reminder.content
    .replace(/^⏰\s*\*Lembrete!?\*\s*\n?\n?/, "")
    .replace(/^📅\s*\*Lembrete de evento\*\s*\n?\n?/, "")
    .slice(0, 120);

  const recurrenceLabel = reminder.recurrence
    ? RECURRENCE_LABELS[reminder.recurrence] || reminder.recurrence
    : null;

  return (
    <div
      className={`rounded-lg transition-colors ${
        isPending
          ? "bg-slate-800/40 hover:bg-slate-800/60"
          : "bg-slate-800/20"
      }`}
    >
      <div className="flex items-start gap-3 p-2.5">
        <div className="mt-0.5">
          {isPending ? (
            <Clock size={16} weight="duotone" className="text-amber-400" />
          ) : (
            <CheckCircle size={16} weight="duotone" className="text-emerald-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-snug ${isPending ? "text-slate-200" : "text-slate-400"}`}>
            {cleanContent}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] text-slate-500">
              {formatDateTime(reminder.scheduled_for)}
            </span>
            {isPending && (
              <span className="text-[10px] text-accent-cyan font-medium">
                {formatRelative(reminder.scheduled_for)}
              </span>
            )}
            {!compact && (
              <span className={`text-[10px] font-medium ${sourceInfo.color}`}>
                {sourceInfo.label}
              </span>
            )}
            {recurrenceLabel && (
              <span className="text-[10px] font-medium text-violet-400 flex items-center gap-0.5">
                <ArrowsClockwise size={10} />
                {recurrenceLabel}
              </span>
            )}
          </div>
        </div>

        {isPending && !editing && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={startEdit}
              className="p-1 rounded-md text-slate-500 hover:text-accent-cyan hover:bg-accent-cyan/10 transition-colors"
              title="Editar lembrete"
            >
              <PencilSimple size={14} />
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Cancelar lembrete"
              >
                <Trash size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Painel de edição inline */}
      {editing && (
        <div className="px-2.5 pb-2.5 pt-1 border-t border-slate-700/30 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <DateTimePicker
              value={editDateTime}
              onChange={setEditDateTime}
              placeholder="Data e hora"
              className="w-52"
            />
            <div className="flex items-center gap-1.5">
              <ArrowsClockwise size={12} className="text-slate-400 flex-shrink-0" />
              <Select value={editRecurrence} onValueChange={setEditRecurrence}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-1.5 justify-end">
            <button
              onClick={() => setEditing(false)}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors"
              title="Cancelar edição"
            >
              <X size={14} />
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1.5 rounded-md text-accent-cyan hover:bg-accent-cyan/10 transition-colors disabled:opacity-50"
              title="Salvar alterações"
            >
              {saving ? <SpinnerGap size={14} className="animate-spin" /> : <FloppyDisk size={14} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
