"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/shadcn/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";
import { Textarea } from "@/components/ui/shadcn/textarea";
import { FormField } from "@/components/ui/form-field";
import { PlatformCheckboxes } from "@/components/ui/platform-checkboxes";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Trash, Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";

import type { CalendarItem, UserProfile } from "@/lib/types/database";
import { createCalendarItem, updateCalendarItem, deleteCalendarItem } from "@/lib/queries/calendar";
import { getCurrentUserProfile, getAllUsers } from "@/lib/queries/users";
import { createClient } from "@/lib/supabase/client";

// === Helpers ===

/**
 * Converte uma string datetime local (formato: "YYYY-MM-DDTHH:mm")
 * para ISO string em UTC, preservando a data civil corretamente.
 * 
 * Para evitar problemas de timezone (ex: 20/02 22:00 BRT virar 21/02 01:00 UTC),
 * esta função garante que a data civil seja mantida:
 * - Extrai ano/mês/dia/hora/minuto da string local
 * - Cria timestamp em UTC que represente o mesmo instante civil
 */
function localToUTCISO(localDateTime: string): string {
  if (!localDateTime) return '';
  
  // Parse da string local: "2026-02-20T22:00"
  const [datePart, timePart] = localDateTime.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart ? timePart.split(':').map(Number) : [0, 0];
  
  // Criar data em UTC com os valores locais
  // Assim 20/02 22:00 no Brasil vira 20/02 22:00 UTC (não converte timezone)
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));
  
  return utcDate.toISOString();
}

function formatDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  // Usar UTC para evitar problemas de timezone
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

const INPUT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const TYPES = [
  { value: "event", label: "🎸 Evento" },
  { value: "delivery", label: "🔴 Entrega" },
  { value: "creation", label: "📹 Criação" },
  { value: "task", label: "✅ Tarefa" },
  { value: "meeting", label: "🧠 Reunião" },
];

const STATUSES = [
  { value: "pending", label: "Pendente" },
  { value: "in_progress", label: "Em Progresso" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
];

const PRIORITIES = [
  { value: "urgent", label: "Urgente",  color: "#EF4444" },
  { value: "high",   label: "Alta",     color: "#F97316" },
  { value: "medium", label: "Média",    color: "#F59E0B" },
  { value: "low",    label: "Baixa",    color: "#6B7280" },
];

const CONTENT_TYPES = [
  { value: "video", label: "🎬 Vídeo" },
  { value: "carousel", label: "🎠 Carrossel" },
  { value: "image", label: "📸 Imagem" },
  { value: "reels", label: "🎥 Reels" },
  { value: "story", label: "📱 Story" },
  { value: "newsletter", label: "📰 Newsletter" },
];

// === Props ===

interface CalendarItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: CalendarItem | null;
  defaultDate?: Date;
  onSaved: () => void;
}

export function CalendarItemModal({
  open,
  onOpenChange,
  item,
  defaultDate,
  onSaved,
}: CalendarItemModalProps) {
  // Form state
  const [title, setTitle] = useState("");
  const [selectedType, setSelectedType] = useState<string>("task");
  const [selectedStatus, setSelectedStatus] = useState<string>("pending");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("medium");
  const [contentType, setContentType] = useState("");
  const [location, setLocation] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [description, setDescription] = useState("");

  // UI state
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Card vinculado (kanban_card_id)
  const [linkedCardDueDate, setLinkedCardDueDate] = useState<string | null>(null);
  const [linkedCardTitle, setLinkedCardTitle] = useState<string | null>(null);

  // Carregar users e current user
  useEffect(() => {
    if (!open) return;
    getAllUsers().then(setUsers).catch(console.error);
    getCurrentUserProfile().then((u) => {
      if (u) setCurrentUserId(u.userId);
    }).catch(console.error);
  }, [open]);

  // Carregar card vinculado quando tem kanban_card_id
  useEffect(() => {
    if (!open || !item?.kanban_card_id) {
      setLinkedCardDueDate(null);
      setLinkedCardTitle(null);
      return;
    }
    async function fetchLinkedCard() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("kanban_cards")
          .select("title, due_date, start_date")
          .eq("id", item!.kanban_card_id!)
          .single();
        if (data) {
          const row = data as Record<string, unknown>;
          setLinkedCardDueDate(row.due_date as string | null);
          setLinkedCardTitle(row.title as string | null);
        }
      } catch (err) {
        console.error("Erro ao carregar card vinculado:", err);
      }
    }
    fetchLinkedCard();
  }, [open, item?.kanban_card_id]);

  // Pré-popular campos ao editar ou resetar ao criar
  useEffect(() => {
    if (!open) return;
    if (item) {
      setTitle(item.title);
      setSelectedType(item.type);
      setSelectedStatus(item.status);
      setStartTime(formatDateTimeLocal(item.start_time));
      setEndTime(item.end_time ? formatDateTimeLocal(item.end_time) : "");
      setSelectedUser(item.responsible_user_id || "");
      setContentType(item.content_type || "");
      setSelectedPlatforms(item.platforms || []);
      setLocation(item.location || "");
      setDescription(item.description || "");
      setSelectedPriority((item.metadata?.priority as string) || "medium");
    } else {
      resetForm();
      if (defaultDate) {
        setStartTime(formatDateTimeLocal(defaultDate.toISOString()));
      }
    }
    setFormErrors({});
    setConfirmingDelete(false);
  }, [item, defaultDate, open]);

  function resetForm() {
    setTitle("");
    setSelectedType("task");
    setSelectedStatus("pending");
    setStartTime("");
    setEndTime("");
    setSelectedUser("");
    setSelectedPriority("medium");
    setContentType("");
    setLocation("");
    setSelectedPlatforms([]);
    setDescription("");
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = "Título é obrigatório";
    if (!selectedType) errors.type = "Tipo é obrigatório";
    if (!startTime) errors.startTime = "Data/hora início é obrigatória";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        type: selectedType,
        status: selectedStatus,
        start_time: localToUTCISO(startTime),
        end_time: endTime ? localToUTCISO(endTime) : null,
        responsible_user_id: selectedUser || null,
        content_type: contentType || null,
        platforms: selectedPlatforms,
        location: location || null,
        description: description || null,
        metadata: { priority: selectedPriority },
      };

      if (item) {
        await updateCalendarItem(item.id, payload as Partial<CalendarItem>);
      } else {
        payload.created_by = currentUserId;
        await createCalendarItem(payload as Partial<CalendarItem>);
      }

      onSaved();
      onOpenChange(false);
      toast.success(item ? "Item atualizado!" : "Item criado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar item");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    setDeleting(true);
    try {
      await deleteCalendarItem(item.id);
      toast.success("Item excluído");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error('[Calendar] Delete failed:', err);
      toast.error("Erro ao excluir");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-50">
            {item ? `Editar: ${item.title}` : "Novo Item"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto px-1">
          {/* Linha 1 — Título */}
          <FormField label="Título" required error={formErrors.title}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Gravação Tour pela Escola"
              className={`${INPUT_CLASS} ${formErrors.title ? "border-destructive" : ""}`}
            />
          </FormField>

          {/* Linha 2 — Tipo + Status */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tipo" required error={formErrors.type}>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="bg-transparent border-input">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Status">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="bg-transparent border-input">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {/* Linha 3 — Data/Hora Início + Fim */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Data/Hora Início" required error={formErrors.startTime}>
              <DateTimePicker
                value={startTime}
                onChange={setStartTime}
                placeholder="Selecione data e hora"
                error={!!formErrors.startTime}
              />
            </FormField>

            <FormField label="Data/Hora Fim">
              <DateTimePicker
                value={endTime}
                onChange={setEndTime}
                placeholder="Selecione data e hora"
              />
            </FormField>
          </div>

          {/* Card vinculado — data de entrega (read-only) */}
          {linkedCardDueDate && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-blue-300">📦 Data de Entrega (card vinculado)</p>
                  {linkedCardTitle && (
                    <p className="mt-0.5 text-[10px] text-slate-400">Card: {linkedCardTitle}</p>
                  )}
                </div>
                <span className="text-sm font-semibold text-blue-200">
                  {new Date(linkedCardDueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </span>
              </div>
            </div>
          )}

          {/* Linha 4 — Responsável + Prioridade */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Responsável">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="bg-transparent border-input">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="none">Nenhum</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.display_name || u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Prioridade">
              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                <SelectTrigger className="bg-transparent border-input">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {/* Linha 5 — Tipo de Conteúdo + Localização */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tipo de Conteúdo">
              <Select value={contentType || "none"} onValueChange={(v) => setContentType(v === "none" ? "" : v)}>
                <SelectTrigger className="bg-transparent border-input">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="none">Nenhum</SelectItem>
                  {CONTENT_TYPES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Localização">
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: LA Music — Estúdio A"
                className={INPUT_CLASS}
              />
            </FormField>
          </div>

          {/* Linha 6 — Plataformas */}
          <FormField label="Plataformas">
            <PlatformCheckboxes selected={selectedPlatforms} onChange={setSelectedPlatforms} />
          </FormField>

          {/* Linha 7 — Descrição */}
          <FormField label="Descrição">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes do item..."
              rows={3}
              className="bg-transparent border-input resize-none"
            />
          </FormField>
        </div>

        <DialogFooter className="flex items-center gap-2 sm:justify-between">
          <div>
            {item && !confirmingDelete && (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
              >
                <Trash size={14} weight="bold" /> Excluir
              </button>
            )}
            {item && confirmingDelete && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Tem certeza?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Excluindo...' : 'Sim, excluir'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded-md transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50"
            >
              {saving ? <><Spinner size={14} className="animate-spin" /> Salvando...</> : item ? "Salvar" : "Criar"}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
