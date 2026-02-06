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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/shadcn/alert-dialog";
import { Textarea } from "@/components/ui/shadcn/textarea";
import { FormField } from "@/components/ui/form-field";
import { PlatformCheckboxes } from "@/components/ui/platform-checkboxes";
import { DatePicker } from "@/components/ui/date-time-picker";
import { toast } from "sonner";

import type { KanbanCard, KanbanColumn, UserProfile } from "@/lib/types/database";
import { createKanbanCard, updateKanbanCard, deleteKanbanCard } from "@/lib/queries/kanban";
import { getCurrentUserProfile, getAllUsers } from "@/lib/queries/users";

const INPUT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const PRIORITIES = [
  { value: "urgent", label: "🔴 Urgente" },
  { value: "high", label: "🟠 Alta" },
  { value: "medium", label: "🟡 Média" },
  { value: "low", label: "⚪ Baixa" },
];

const CONTENT_TYPES = [
  { value: "video", label: "🎬 Vídeo" },
  { value: "carousel", label: "🎠 Carrossel" },
  { value: "image", label: "📸 Imagem" },
  { value: "reels", label: "🎥 Reels" },
  { value: "story", label: "📱 Story" },
  { value: "newsletter", label: "📰 Newsletter" },
];

const BRANDS = [
  { value: "la_music_school", label: "LA Music School" },
  { value: "la_music_kids", label: "LA Music Kids" },
];

interface KanbanCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  card?: KanbanCard | null;
  defaultColumnId?: string;
  columns: KanbanColumn[];
  onSaved: () => void;
}

export function KanbanCardModal({
  open,
  onOpenChange,
  card,
  defaultColumnId,
  columns,
  onSaved,
}: KanbanCardModalProps) {
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColumnId, setSelectedColumnId] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("medium");
  const [selectedUser, setSelectedUser] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [contentType, setContentType] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("la_music_school");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState("");

  // UI state
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Carregar users e current user
  useEffect(() => {
    if (!open) return;
    getAllUsers().then(setUsers).catch(console.error);
    getCurrentUserProfile().then((u) => {
      if (u) setCurrentUserId(u.userId);
    }).catch(console.error);
  }, [open]);

  // Pré-popular campos ao editar ou resetar ao criar
  useEffect(() => {
    if (!open) return;
    if (card) {
      setTitle(card.title);
      setDescription(card.description || "");
      setSelectedColumnId(card.column_id);
      setSelectedPriority(card.priority || "medium");
      setSelectedUser(card.responsible_user_id || "");
      setDueDate(card.due_date ? card.due_date.split("T")[0] : "");
      setContentType(card.content_type || "");
      setSelectedBrand((card.metadata?.brand as string) || "la_music_school");
      setSelectedPlatforms(card.platforms || []);
      setTagsInput((card.tags || []).join(", "));
    } else {
      resetForm();
      if (defaultColumnId) setSelectedColumnId(defaultColumnId);
      else if (columns.length > 0) setSelectedColumnId(columns[0].id);
    }
    setFormErrors({});
  }, [card, defaultColumnId, open, columns]);

  function resetForm() {
    setTitle("");
    setDescription("");
    setSelectedColumnId(columns[0]?.id || "");
    setSelectedPriority("medium");
    setSelectedUser("");
    setDueDate("");
    setContentType("");
    setSelectedBrand("la_music_school");
    setSelectedPlatforms([]);
    setTagsInput("");
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!title.trim()) errors.title = "Título é obrigatório";
    if (!selectedColumnId) errors.column = "Coluna é obrigatória";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const tagsArray = tagsInput
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter((t) => t.length > 0);

      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description || null,
        column_id: selectedColumnId,
        responsible_user_id: selectedUser && selectedUser !== "none" ? selectedUser : null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        priority: selectedPriority || null,
        content_type: contentType || null,
        platforms: selectedPlatforms,
        tags: tagsArray,
        metadata: { brand: selectedBrand },
      };

      if (card) {
        await updateKanbanCard(card.id, payload as Partial<KanbanCard>);
      } else {
        payload.created_by = currentUserId;
        payload.position_in_column = 999;
        await createKanbanCard(payload as Partial<KanbanCard>);
      }

      onSaved();
      onOpenChange(false);
      toast.success(card ? "Card atualizado!" : "Card criado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar card");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!card) return;
    try {
      await deleteKanbanCard(card.id);
      onSaved();
      onOpenChange(false);
      toast.success("Card excluído");
    } catch {
      toast.error("Erro ao excluir");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-50">
            {card ? `Editar: ${card.title}` : "Novo Card"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[65vh] overflow-y-auto pr-1">
          {/* Linha 1 — Título */}
          <FormField label="Título" icon="📝" required error={formErrors.title}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Carrossel 5 Dicas de Guitarra"
              className={`${INPUT_CLASS} ${formErrors.title ? "border-destructive" : ""}`}
            />
          </FormField>

          {/* Linha 2 — Coluna + Prioridade */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Coluna" icon="📋" required error={formErrors.column}>
              <Select value={selectedColumnId} onValueChange={setSelectedColumnId}>
                <SelectTrigger className={`bg-transparent border-input ${formErrors.column ? "border-destructive" : ""}`}>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>{col.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Prioridade" icon="⚡">
              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                <SelectTrigger className="bg-transparent border-input">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {/* Linha 3 — Responsável + Prazo */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Responsável" icon="👤">
              <Select value={selectedUser || "none"} onValueChange={(v) => setSelectedUser(v === "none" ? "" : v)}>
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

            <FormField label="Prazo" icon="📅">
              <DatePicker
                value={dueDate}
                onChange={setDueDate}
                placeholder="Selecione o prazo"
              />
            </FormField>
          </div>

          {/* Linha 4 — Tipo de Conteúdo + Marca */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Tipo de Conteúdo" icon="🎬">
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

            <FormField label="Marca" icon="🏢">
              <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                <SelectTrigger className="bg-transparent border-input">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {BRANDS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {/* Linha 5 — Plataformas */}
          <FormField label="Plataformas" icon="📱">
            <PlatformCheckboxes selected={selectedPlatforms} onChange={setSelectedPlatforms} />
          </FormField>

          {/* Linha 6 — Tags */}
          <FormField label="Tags" icon="🏷️">
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="#campanha, #matrícula"
              className={INPUT_CLASS}
            />
          </FormField>

          {/* Linha 7 — Descrição */}
          <FormField label="Descrição" icon="📝">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes do card..."
              rows={3}
              className="bg-transparent border-input resize-none"
            />
          </FormField>
        </div>

        <DialogFooter className="flex items-center gap-2 sm:justify-between">
          <div>
            {card && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    className="px-3 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                  >
                    Excluir
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-slate-900 border-slate-700">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-slate-100">Confirmar exclusão</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-400">
                      Tem certeza que deseja excluir &ldquo;{card.title}&rdquo;? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700">
                      Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-red-600 text-white hover:bg-red-700"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
              {saving ? "Salvando..." : card ? "Salvar" : "Criar"}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
