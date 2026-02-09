"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Header } from "@/components/layout/header";
import {
  SquaresFour,
  List,
  Kanban,
  CalendarDots,
  ChartLine,
  Users,
  Gear,
  Plus,
  Flag,
  Play,
  CheckCircle,
  Warning,
  Lightning,
  CaretUp,
  CaretDown,
  CaretLeft,
  CaretRight,
  DotsThreeVertical,
  PencilSimple,
  Trash,
  Check,
  DotsSixVertical,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button, Badge, Avatar, Card, IconButton, Dot, ProgressBar } from "@/components/ui";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getKanbanColumns, getKanbanCards, moveKanbanCard, createKanbanColumn, updateKanbanColumn, deleteKanbanColumn, reorderKanbanColumns } from "@/lib/queries/kanban";
import { getAllUsers } from "@/lib/queries/users";
import { getUserDisplay } from "@/lib/utils/calendar-helpers";
import {
  getProgressFromColumn,
  getStatusFromColumn,
  getPriorityDisplay,
  groupCardsByColumn,
  groupCardsByUser,
  getCardBrand,
  PLATFORM_COLORS,
  formatDateShort as formatDateHelper,
  isOverdue as isOverdueHelper,
} from "@/lib/utils/kanban-helpers";
import type { KanbanColumn as KanbanColumnType, KanbanCard as KanbanCardType, UserProfile } from "@/lib/types/database";
import type { KanbanFilters } from "@/types/filters";
import { KanbanCardModal } from "@/components/kanban/KanbanCardModal";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Select, SelectContent, SelectItem as ShadSelectItem, SelectTrigger, SelectValue } from "@/components/ui/shadcn/select";
import { Funnel, X, MagnifyingGlass } from "@phosphor-icons/react";

// ============================================================
// TABS
// ============================================================

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: SquaresFour },
  { id: "lista", label: "Lista", icon: List },
  { id: "kanban", label: "Kanban", icon: Kanban },
  { id: "calendario", label: "Calendário", icon: CalendarDots },
  { id: "timeline", label: "Timeline", icon: ChartLine },
  { id: "por-pessoa", label: "Por Pessoa", icon: Users },
  { id: "configuracoes", label: "Configurações", icon: Gear },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ============================================================
// PAGE
// ============================================================

export default function ProjetosPage() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [columns, setColumns] = useState<KanbanColumnType[]>([]);
  const [cards, setCards] = useState<KanbanCardType[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // === Filtros Kanban ===
  const [kanbanFilters, setKanbanFilters] = useState<KanbanFilters>({});
  const [showKanbanFilters, setShowKanbanFilters] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // === Estado do modal CRUD ===
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<KanbanCardType | null>(null);
  const [createDefaultColumnId, setCreateDefaultColumnId] = useState<string | undefined>();

  // Carregar dados do Kanban
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cols, cardsData, usersData] = await Promise.all([
        getKanbanColumns(),
        getKanbanCards(),
        getAllUsers(),
      ]);
      setColumns(cols);
      setCards(cardsData);
      setUsers(usersData);
    } catch (err) {
      console.error("Erro ao carregar projetos:", err);
      setError("Erro ao carregar dados dos projetos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // === Realtime Subscriptions ===
  // Nota: Realtime para kanban_cards foi removido intencionalmente.
  // Ele causava race condition com o optimistic update do drag & drop,
  // revertendo o card para a coluna anterior. O re-fetch dos cards
  // acontece via loadData() ao salvar/criar/deletar pelo modal.

  useRealtimeSubscription({
    table: 'kanban_columns',
    onChange: useCallback(async () => {
      const data = await getKanbanColumns();
      setColumns(data);
    }, []),
  });

  // === Filtros Kanban: contagem e handlers ===
  const activeKanbanFilterCount = useMemo(() => {
    return [
      kanbanFilters.priorities?.length,
      kanbanFilters.responsibleId,
      kanbanFilters.platforms?.length,
      kanbanFilters.brand,
      kanbanFilters.search,
    ].filter(Boolean).length;
  }, [kanbanFilters]);

  const handleKanbanFilterChange = useCallback((key: keyof KanbanFilters, value: unknown) => {
    setKanbanFilters((prev) => ({ ...prev, [key]: value || undefined }));
  }, []);

  const handleClearKanbanFilters = useCallback(() => {
    setKanbanFilters({});
    setSearchInput("");
  }, []);

  // Debounce para busca por título
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setKanbanFilters((prev) => ({ ...prev, search: value || undefined }));
    }, 300);
  }, []);

  // Cards filtrados client-side (filtros server-side são aplicados no re-fetch)
  const filteredCards = useMemo(() => {
    let result = cards;
    if (kanbanFilters.priorities?.length) {
      result = result.filter((c) => c.priority && kanbanFilters.priorities!.includes(c.priority));
    }
    if (kanbanFilters.responsibleId) {
      result = result.filter((c) => c.responsible_user_id === kanbanFilters.responsibleId);
    }
    if (kanbanFilters.platforms?.length) {
      result = result.filter((c) => c.platforms?.some((p: string) => kanbanFilters.platforms!.includes(p)));
    }
    if (kanbanFilters.brand) {
      result = result.filter((c) => getCardBrand(c) === kanbanFilters.brand);
    }
    if (kanbanFilters.search) {
      const q = kanbanFilters.search.toLowerCase();
      result = result.filter((c) => c.title.toLowerCase().includes(q));
    }
    return result;
  }, [cards, kanbanFilters]);


  // Handler para mover card (optimistic update + persistência no banco)
  const handleMoveCard = useCallback(async (cardId: string, newColumnId: string, newPosition: number) => {
    // Optimistic update — atualiza UI imediatamente
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, column_id: newColumnId, position_in_column: newPosition, column: columns.find((col) => col.id === newColumnId) }
          : c
      )
    );
    try {
      await moveKanbanCard(cardId, newColumnId, newPosition);
    } catch (err) {
      console.error("Erro ao mover card:", err);
      // Rollback: re-fetch do banco em caso de erro
      const freshCards = await getKanbanCards();
      setCards(freshCards);
    }
  }, [columns]);

  return (
    <>
      <Header title="Projetos" subtitle={`${filteredCards.length} itens`}>
        <Button variant="outline" size="sm" onClick={() => setShowKanbanFilters((v) => !v)} className={cn("mr-2", showKanbanFilters && "border-accent-cyan text-accent-cyan")}>
          <Funnel size={14} weight="bold" />
          Filtros
          {activeKanbanFilterCount > 0 && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent-cyan text-[10px] font-bold text-slate-950">
              {activeKanbanFilterCount}
            </span>
          )}
        </Button>
        <Button variant="primary" size="md" onClick={() => {
          setEditingCard(null);
          setCreateDefaultColumnId(undefined);
          setCardModalOpen(true);
        }}>
          <Plus size={16} weight="bold" />
          Novo Projeto
        </Button>
      </Header>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 px-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-3 py-3 text-body-md font-medium transition-colors",
                isActive
                  ? "border-accent-cyan text-accent-cyan"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              )}
            >
              <Icon size={16} weight="duotone" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Painel de filtros Kanban */}
      {showKanbanFilters && (activeTab === "kanban" || activeTab === "lista" || activeTab === "dashboard") && (
        <div className="flex flex-shrink-0 items-end gap-3 flex-wrap border-b border-slate-800 bg-slate-950/80 px-6 py-3">
          {/* Busca */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Busca</span>
            <div className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 h-8">
              <MagnifyingGlass size={14} className="text-slate-500" />
              <input
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar por título..."
                className="bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600 w-[140px]"
              />
            </div>
          </div>

          {/* Prioridade */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Prioridade</span>
            <Select
              value={kanbanFilters.priorities?.[0] || "__all__"}
              onValueChange={(val) => handleKanbanFilterChange('priorities', val === "__all__" ? undefined : [val])}
            >
              <SelectTrigger className="w-[130px] h-8 text-xs bg-slate-900 border-slate-700">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <ShadSelectItem value="__all__">Todas</ShadSelectItem>
                <ShadSelectItem value="urgent">Urgente</ShadSelectItem>
                <ShadSelectItem value="high">Alta</ShadSelectItem>
                <ShadSelectItem value="medium">Média</ShadSelectItem>
                <ShadSelectItem value="low">Baixa</ShadSelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Responsável */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Responsável</span>
            <Select
              value={kanbanFilters.responsibleId || "__all__"}
              onValueChange={(val) => handleKanbanFilterChange('responsibleId', val === "__all__" ? undefined : val)}
            >
              <SelectTrigger className="w-[150px] h-8 text-xs bg-slate-900 border-slate-700">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <ShadSelectItem value="__all__">Todos</ShadSelectItem>
                {users.map((u) => (
                  <ShadSelectItem key={u.user_id} value={u.user_id}>{u.full_name}</ShadSelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Plataforma */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Plataforma</span>
            <Select
              value={kanbanFilters.platforms?.[0] || "__all__"}
              onValueChange={(val) => handleKanbanFilterChange('platforms', val === "__all__" ? undefined : [val])}
            >
              <SelectTrigger className="w-[130px] h-8 text-xs bg-slate-900 border-slate-700">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <ShadSelectItem value="__all__">Todas</ShadSelectItem>
                <ShadSelectItem value="instagram">Instagram</ShadSelectItem>
                <ShadSelectItem value="youtube">YouTube</ShadSelectItem>
                <ShadSelectItem value="tiktok">TikTok</ShadSelectItem>
                <ShadSelectItem value="facebook">Facebook</ShadSelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Marca */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Marca</span>
            <Select
              value={kanbanFilters.brand || "__all__"}
              onValueChange={(val) => handleKanbanFilterChange('brand', val === "__all__" ? undefined : val)}
            >
              <SelectTrigger className="w-[130px] h-8 text-xs bg-slate-900 border-slate-700">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <ShadSelectItem value="__all__">Todas</ShadSelectItem>
                <ShadSelectItem value="la_music">LA Music</ShadSelectItem>
                <ShadSelectItem value="la_kids">LA Kids</ShadSelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Limpar */}
          {activeKanbanFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearKanbanFilters}
              className="h-8 px-2 text-xs text-slate-400 hover:text-slate-200"
            >
              <X size={14} className="mr-1" />
              Limpar
            </Button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex-1 flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-slate-400">Carregando projetos...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <p className="text-sm text-red-400 mb-2">{error}</p>
              <button onClick={loadData} className="text-sm text-accent-cyan hover:underline">Tentar novamente</button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "dashboard" && <DashboardTab cards={filteredCards} columns={columns} users={users} />}
            {activeTab === "lista" && <ListaTab cards={filteredCards} columns={columns} onEditCard={(card) => { setEditingCard(card); setCardModalOpen(true); }} />}
            {activeTab === "kanban" && <KanbanTab cards={filteredCards} columns={columns} setCards={setCards} onMoveCard={handleMoveCard} onEditCard={(card) => { setEditingCard(card); setCardModalOpen(true); }} onAddCard={(colId) => { setEditingCard(null); setCreateDefaultColumnId(colId); setCardModalOpen(true); }} />}
            {activeTab === "calendario" && <CalendarioTab cards={filteredCards} columns={columns} onEditCard={(card) => { setEditingCard(card); setCardModalOpen(true); }} />}
            {activeTab === "timeline" && <TimelineTab cards={filteredCards} columns={columns} />}
            {activeTab === "por-pessoa" && <PorPessoaTab cards={filteredCards} columns={columns} />}
            {activeTab === "configuracoes" && <ConfiguracoesTab columns={columns} setColumns={setColumns} cards={cards} users={users} />}
          </>
        )}
      </div>

      {/* Modal CRUD Kanban */}
      <KanbanCardModal
        open={cardModalOpen}
        onOpenChange={setCardModalOpen}
        card={editingCard}
        defaultColumnId={createDefaultColumnId}
        columns={columns}
        onSaved={loadData}
      />
    </>
  );
}

// ============================================================
// TAB: DASHBOARD
// ============================================================

function DashboardTab({ cards, columns, users }: { cards: KanbanCardType[]; columns: KanbanColumnType[]; users: UserProfile[] }) {
  const totalProjetos = cards.length;
  const publishedSlugs = ["published", "archived"];
  const inProgressSlugs = ["capturing", "editing", "todo", "planning", "brainstorming", "awaiting_approval", "approved"];
  const emProgresso = cards.filter((c) => inProgressSlugs.includes(c.column?.slug ?? "")).length;
  const publicados = cards.filter((c) => publishedSlugs.includes(c.column?.slug ?? "")).length;
  const urgentes = cards.filter((c) => c.priority === "urgent").length;

  const pipelineCounts = useMemo(() => {
    const counts = new Map<string, number>();
    columns.forEach((col) => counts.set(col.id, 0));
    cards.forEach((c) => counts.set(c.column_id, (counts.get(c.column_id) ?? 0) + 1));
    return counts;
  }, [cards, columns]);

  const maxPipeline = Math.max(...pipelineCounts.values(), 1);

  const proximas24h = useMemo(() =>
    cards
      .filter((c) => c.priority === "urgent" || c.priority === "high")
      .filter((c) => !publishedSlugs.includes(c.column?.slug ?? ""))
      .slice(0, 4),
  [cards]);

  const teamLoad = useMemo(() => groupCardsByUser(
    cards.filter((c) => !publishedSlugs.includes(c.column?.slug ?? ""))
  ), [cards]);

  return (
    <div className="space-y-6">
      {/* Seção 1 — Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="TOTAL PROJETOS"
          value={totalProjetos}
          icon={<Flag size={20} weight="duotone" className="text-accent-cyan" />}
          barColor="bg-accent-cyan"
        />
        <StatCard
          label="EM PROGRESSO"
          value={emProgresso}
          icon={<Play size={20} weight="duotone" className="text-orange-400" />}
          barColor="bg-orange-400"
        />
        <StatCard
          label="PUBLICADOS"
          value={publicados}
          icon={<CheckCircle size={20} weight="duotone" className="text-green-400" />}
          barColor="bg-green-400"
        />
        <StatCard
          label="URGENTES"
          value={urgentes}
          icon={<Warning size={20} weight="duotone" className="text-accent-pink" />}
          barColor="bg-accent-pink"
        />
      </div>

      {/* Seção 2 — Pipeline + Próximas 24h */}
      <div className="grid grid-cols-3 gap-4">
        {/* Pipeline Status (2/3) */}
        <Card variant="default" className="col-span-2">
          <h3 className="mb-5 text-lg font-semibold text-slate-50">Pipeline Status</h3>
          <div className="space-y-3">
            {columns.map((col) => {
              const status = getStatusFromColumn(col);
              const count = pipelineCounts.get(col.id) ?? 0;
              const pct = (count / maxPipeline) * 100;
              return (
                <div key={col.id} className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm">{status.emoji}</span>
                  <span className="w-24 text-sm text-slate-300">{status.label}</span>
                  <ProgressBar value={pct} color={status.color} size="thick" className="flex-1" />
                  <span className="w-6 text-right text-sm font-semibold text-slate-300">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Próximas 24h (1/3) */}
        <Card variant="default">
          <div className="mb-4 flex items-center gap-2">
            <Lightning size={18} weight="duotone" className="text-accent-yellow" />
            <h3 className="text-lg font-semibold text-slate-50">Próximas 24h</h3>
          </div>
          <div className="space-y-3">
            {proximas24h.map((p) => {
              const isUrgent = p.priority === "urgent";
              const borderColor = isUrgent ? "#F97316" : "#3B82F6";
              const display = getUserDisplay(p.responsible);
              const platform = p.platforms?.[0] ?? "";
              return (
                <div
                  key={p.id}
                  className="rounded-lg bg-slate-800/50 p-3"
                  style={{ borderLeft: `3px solid ${borderColor}` }}
                >
                  <p className="text-sm font-semibold text-slate-100">{p.title}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      {platform && <Dot color={PLATFORM_COLORS[platform] ?? "#6B7280"} />}
                      {platform || "—"} • {display.name}
                    </div>
                    <Badge variant="type" size="sm" color={isUrgent ? "#EF4444" : "#3B82F6"}>
                      {isUrgent ? "Urgente" : getPriorityDisplay(p.priority)?.label ?? "—"}
                    </Badge>
                  </div>
                </div>
              );
            })}
            {proximas24h.length === 0 && (
              <p className="text-sm text-slate-500">Nenhum item urgente no momento</p>
            )}
          </div>
        </Card>
      </div>

      {/* Seção 3 — Carga do Time */}
      <Card variant="default">
        <h3 className="mb-5 text-lg font-semibold text-slate-50">Carga do Time</h3>
        <div className="grid grid-cols-3 gap-4">
          {Array.from(teamLoad.entries()).map(([userId, { name, role, cards: userCards }]) => {
            const display = getUserDisplay(userCards[0]?.responsible);
            return (
              <div
                key={userId}
                className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-800/40 p-4"
              >
                <Avatar initial={display.initial} color={display.color} size="lg" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-100">{name}</p>
                  <p className="text-xs text-slate-400">{role}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-slate-100">{userCards.length}</p>
                  <p className="text-xs text-slate-500">ativas</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  change,
  changePositive,
  icon,
  barColor,
}: {
  label: string;
  value: number;
  change?: string;
  changePositive?: boolean;
  icon: React.ReactNode;
  barColor: string;
}) {
  return (
    <Card variant="default">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        {icon}
      </div>
      <p className="mt-2 text-4xl font-bold text-slate-50">{value}</p>
      {change && (
        <p
          className={cn(
            "mt-1 text-xs font-medium",
            changePositive ? "text-green-400" : "text-red-400"
          )}
        >
          {change}
        </p>
      )}
      <div className={cn("mt-4 h-1 w-full rounded-full", barColor)} />
    </Card>
  );
}

// ============================================================
// TAB: LISTA
// ============================================================

function ListaTab({ cards, columns, onEditCard }: { cards: KanbanCardType[]; columns: KanbanColumnType[]; onEditCard?: (card: KanbanCardType) => void }) {
  const [sortAsc, setSortAsc] = useState(true);

  const sortedCards = useMemo(() => {
    return [...cards].sort((a, b) => {
      const aTime = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bTime = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      return sortAsc ? aTime - bTime : bTime - aTime;
    });
  }, [cards, sortAsc]);

  return (
    <Card variant="default" className="overflow-hidden !p-0">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-800">
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
              Projeto
            </th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
              Responsável
            </th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
              Status
            </th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
              Prioridade
            </th>
            <th
              className="cursor-pointer select-none px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
              onClick={() => setSortAsc(!sortAsc)}
            >
              <span className="flex items-center gap-1">
                Prazo
                {sortAsc ? (
                  <CaretDown size={12} weight="bold" />
                ) : (
                  <CaretUp size={12} weight="bold" />
                )}
              </span>
            </th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
              Progresso
            </th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {sortedCards.map((card, i) => {
            const status = getStatusFromColumn(card.column);
            const prio = getPriorityDisplay(card.priority);
            const display = getUserDisplay(card.responsible);
            const progress = getProgressFromColumn(card.column, columns.length);
            const platform = card.platforms?.[0] ?? "";
            const brand = getCardBrand(card);
            const overdue = card.due_date && isOverdueHelper(card.due_date) && card.column?.slug !== "published";
            const progressColor =
              progress === 100
                ? "bg-green-400"
                : progress >= 50
                ? "bg-accent-cyan"
                : "bg-slate-500";

            return (
              <tr
                key={card.id}
                onClick={() => onEditCard?.(card)}
                className={cn(
                  "border-b border-slate-800/50 transition-colors hover:bg-slate-800/40 cursor-pointer",
                  i % 2 === 0 ? "bg-slate-900/30" : "bg-transparent"
                )}
              >
                {/* PROJETO */}
                <td className="px-5 py-3.5">
                  <p className="text-sm font-semibold text-slate-100">{card.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    {platform && <Dot color={PLATFORM_COLORS[platform] ?? "#6B7280"} />}
                    <span className="text-xs text-slate-400">{platform || "—"}</span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        brand === "la_kids"
                          ? "bg-orange-500/20 text-orange-400"
                          : "bg-teal-500/20 text-teal-400"
                      )}
                    >
                      {brand === "la_kids" ? "Kids" : "School"}
                    </span>
                  </div>
                </td>

                {/* RESPONSÁVEL */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <Avatar initial={display.initial} color={display.color} size="md" className="!h-7 !w-7 !text-xs" />
                    <span className="text-sm text-slate-300">{display.name}</span>
                  </div>
                </td>

                {/* STATUS */}
                <td className="px-5 py-3.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                      status.bgClass
                    )}
                  >
                    {status.emoji} {status.label}
                  </span>
                </td>

                {/* PRIORIDADE */}
                <td className="px-5 py-3.5">
                  {prio ? (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                        prio.bgClass
                      )}
                    >
                      {prio.label}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">—</span>
                  )}
                </td>

                {/* PRAZO */}
                <td className="px-5 py-3.5">
                  <span
                    className={cn(
                      "text-sm",
                      overdue ? "font-semibold text-red-400" : "text-slate-300"
                    )}
                  >
                    {card.due_date ? formatDateHelper(card.due_date) : "—"}
                  </span>
                </td>

                {/* PROGRESSO */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={progress} colorClass={progressColor} size="thin" className="w-20 !bg-slate-700" />
                    <span className="text-xs font-medium text-slate-400">{progress}%</span>
                  </div>
                </td>

                {/* AÇÕES */}
                <td className="px-2 py-3.5">
                  <button className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300">
                    <DotsThreeVertical size={16} weight="bold" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

// ============================================================
// TAB: KANBAN
// ============================================================

function KanbanTab({ cards, columns, setCards, onMoveCard, onEditCard, onAddCard }: { cards: KanbanCardType[]; columns: KanbanColumnType[]; setCards: React.Dispatch<React.SetStateAction<KanbanCardType[]>>; onMoveCard: (cardId: string, newColumnId: string, newPosition: number) => Promise<void>; onEditCard: (card: KanbanCardType) => void; onAddCard: (columnId: string) => void }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const grouped = useMemo(() => groupCardsByColumn(cards, columns), [cards, columns]);

  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activeCardId = String(active.id);
    const overId = String(over.id);

    const currentCard = cards.find((c) => c.id === activeCardId);
    if (!currentCard) return;

    // Determinar coluna destino: pode ser uma coluna (droppable com prefixo) ou um card (sortable)
    const columnPrefix = 'column-';
    const isOverColumn = overId.startsWith(columnPrefix);
    const overCard = !isOverColumn ? cards.find((c) => c.id === overId) : null;

    let newColumnId: string;
    let newPosition: number;

    if (isOverColumn) {
      // Soltou sobre a área vazia da coluna (ID com prefixo column-)
      newColumnId = overId.replace(columnPrefix, '');
      const targetCards = grouped.get(newColumnId) ?? [];
      newPosition = targetCards.length;
    } else if (overCard) {
      // Soltou sobre outro card — mover para a coluna desse card
      newColumnId = overCard.column_id;
      const targetCards = grouped.get(newColumnId) ?? [];
      const overIndex = targetCards.findIndex((c) => c.id === overId);
      newPosition = overIndex >= 0 ? overIndex : targetCards.length;
    } else {
      return;
    }

    // Só chamar onMoveCard se realmente mudou algo
    if (newColumnId !== currentCard.column_id || newPosition !== currentCard.position_in_column) {
      onMoveCard(currentCard.id, newColumnId, newPosition);
    }
  }, [cards, columns, grouped, onMoveCard]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const status = getStatusFromColumn(col);
          const colCards = grouped.get(col.id) ?? [];
          return (
            <DroppableColumn key={col.id} columnId={col.id}>
              {/* Column Header */}
              <div className="mb-3 flex items-center gap-2">
                <Dot color={status.color} size="lg" />
                <span className="text-sm font-semibold text-slate-200">{status.label}</span>
                <span className="text-sm">{status.emoji}</span>
                <Badge variant="neutral" size="md" className="ml-auto">
                  {colCards.length}
                </Badge>
              </div>

              {/* Cards */}
              <SortableContext
                id={col.id}
                items={colCards.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 min-h-[40px]">
                  {colCards.map((card) => (
                    <KanbanCardItem
                      key={card.id}
                      card={card}
                      color={status.color}
                      totalColumns={columns.length}
                      onClick={() => onEditCard(card)}
                    />
                  ))}
                </div>
              </SortableContext>

              {/* Adicionar */}
              <button
                onClick={() => onAddCard(col.id)}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-[10px] border border-dashed border-slate-700/50 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-800/30 hover:text-slate-400"
              >
                <Plus size={14} /> Adicionar
              </button>
            </DroppableColumn>
          );
        })}
      </div>

      <DragOverlay>
        {activeCard ? (
          <div
            className="w-[256px] rounded-[12px] border border-slate-700 bg-slate-900 p-4 shadow-xl"
            style={{ borderLeft: `3px solid ${getStatusFromColumn(activeCard.column).color}` }}
          >
            <p className="text-sm font-medium text-slate-100">{activeCard.title}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Coluna droppable — registra como drop target para o DndContext
function DroppableColumn({ columnId, children }: { columnId: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${columnId}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-[280px] flex-shrink-0 rounded-[14px] border bg-slate-950/50 p-3 transition-colors",
        isOver ? "border-accent-cyan/50 bg-accent-cyan/[0.03]" : "border-slate-800"
      )}
    >
      {children}
    </div>
  );
}

function KanbanCardItem({
  card,
  color,
  totalColumns,
  onClick,
}: {
  card: KanbanCardType;
  color: string;
  totalColumns: number;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeft: `3px solid ${color}`,
    opacity: isDragging ? 0.4 : 1,
  };

  const display = getUserDisplay(card.responsible);
  const tags = card.tags ?? [];
  const progress = getProgressFromColumn(card.column, totalColumns);
  const overdue = card.due_date && isOverdueHelper(card.due_date) && card.column?.slug !== "published";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-[12px] border border-slate-800 bg-slate-900/80 p-4 transition-colors hover:bg-slate-800/60",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      onContextMenu={(e) => {
        e.preventDefault();
        if (onClick) onClick();
      }}
    >
      <p className="text-sm font-medium text-slate-100">{card.title}</p>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <ProgressBar value={progress} color={color} size="thin" className="mt-3" />

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Avatar initial={display.initial} color={display.color} size="sm" />
          <span className="text-xs text-slate-500">{display.name}</span>
        </div>
        <span className={cn("text-xs", overdue ? "font-semibold text-red-400" : "text-slate-500")}>
          {card.due_date ? formatDateHelper(card.due_date) : "—"}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// TAB: CALENDÁRIO (Prazos dos Projetos — kanban_cards.due_date)
// ============================================================

const CAL_DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const CAL_DIAS_SEMANA_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const CAL_MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function isSameDayUtil(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

interface CalendarioTabProps {
  cards: KanbanCardType[];
  columns: KanbanColumnType[];
  onEditCard: (card: KanbanCardType) => void;
}

function CalendarioTab({ cards, columns, onEditCard }: CalendarioTabProps) {
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<"dia" | "semana" | "mes">("semana");

  const now = useMemo(() => new Date(), []);

  // Cards com due_date (únicos que fazem sentido no calendário de prazos)
  const cardsWithDue = useMemo(() => cards.filter((c) => c.due_date), [cards]);

  // Navegação
  const currentDate = useMemo(() => {
    const d = new Date(now);
    if (view === "dia") d.setDate(d.getDate() + offset);
    else if (view === "semana") d.setDate(d.getDate() + offset * 7);
    else d.setMonth(d.getMonth() + offset);
    return d;
  }, [now, offset, view]);

  // Reset offset ao trocar view
  const handleViewChange = useCallback((v: "dia" | "semana" | "mes") => {
    setView(v);
    setOffset(0);
  }, []);

  // Título do header
  const headerTitle = useMemo(() => {
    if (view === "dia") {
      return `${CAL_DIAS_SEMANA_FULL[currentDate.getDay()]}, ${currentDate.getDate()} de ${CAL_MESES[currentDate.getMonth()]}`;
    }
    if (view === "semana") {
      const weekStart = new Date(currentDate);
      const day = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - day);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekStart.getMonth() === weekEnd.getMonth()) {
        return `${weekStart.getDate()} — ${weekEnd.getDate()} de ${CAL_MESES[weekStart.getMonth()]} ${weekStart.getFullYear()}`;
      }
      return `${weekStart.getDate()} ${CAL_MESES[weekStart.getMonth()].slice(0, 3)} — ${weekEnd.getDate()} ${CAL_MESES[weekEnd.getMonth()].slice(0, 3)} ${weekEnd.getFullYear()}`;
    }
    return `${CAL_MESES[currentDate.getMonth()]} de ${currentDate.getFullYear()}`;
  }, [currentDate, view]);

  // Contagem de cards sem prazo
  const noDueCount = cards.length - cardsWithDue.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconButton size="sm" variant="outline" onClick={() => setOffset((o) => o - 1)}>
            <CaretLeft size={16} weight="bold" />
          </IconButton>
          <h3 className="text-lg font-bold text-slate-50">{headerTitle}</h3>
          <IconButton size="sm" variant="outline" onClick={() => setOffset((o) => o + 1)}>
            <CaretRight size={16} weight="bold" />
          </IconButton>
          {offset !== 0 && (
            <button onClick={() => setOffset(0)} className="ml-1 rounded-md bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors">
              Hoje
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {noDueCount > 0 && (
            <span className="text-xs text-slate-500">{noDueCount} sem prazo</span>
          )}
          <div className="flex rounded-lg border border-slate-700 overflow-hidden">
            {(["dia", "semana", "mes"] as const).map((v) => (
              <button
                key={v}
                onClick={() => handleViewChange(v)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  view === v
                    ? "bg-accent-cyan text-slate-950"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
              >
                {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Views */}
      {view === "dia" && (
        <CalDiaView date={currentDate} cards={cardsWithDue} columns={columns} onEditCard={onEditCard} now={now} />
      )}
      {view === "semana" && (
        <CalSemanaView date={currentDate} cards={cardsWithDue} columns={columns} onEditCard={onEditCard} now={now} />
      )}
      {view === "mes" && (
        <CalMesView date={currentDate} cards={cardsWithDue} columns={columns} onEditCard={onEditCard} now={now} />
      )}
    </div>
  );
}

// --- Card chip reutilizável ---
function CalCardChip({ card, columns, onClick }: { card: KanbanCardType; columns: KanbanColumnType[]; onClick: () => void }) {
  const status = getStatusFromColumn(card.column ?? columns.find((c) => c.id === card.column_id));
  const priority = getPriorityDisplay(card.priority);
  const overdue = card.due_date ? isOverdueHelper(card.due_date) : false;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full text-left rounded-lg p-2.5 transition-all hover:brightness-125 cursor-pointer",
        overdue ? "bg-red-500/10 border border-red-500/20" : "bg-slate-800/60 border border-slate-700/40 hover:border-slate-600/60"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-200 truncate">{card.title}</p>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", status.bgClass)}>{status.label}</span>
            {priority && (
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", priority.bgClass)}>{priority.label}</span>
            )}
            {card.platforms?.slice(0, 2).map((p) => (
              <Dot key={p} size="xs" color={PLATFORM_COLORS[p] ?? "#6B7280"} />
            ))}
          </div>
        </div>
        {overdue && <span className="text-[10px] font-semibold text-red-400 shrink-0">Atrasado</span>}
      </div>
    </button>
  );
}

// --- VIEW: DIA ---
function CalDiaView({ date, cards, columns, onEditCard, now }: { date: Date; cards: KanbanCardType[]; columns: KanbanColumnType[]; onEditCard: (c: KanbanCardType) => void; now: Date }) {
  const dayCards = useMemo(() =>
    cards.filter((c) => {
      const d = new Date(c.due_date!);
      return isSameDayUtil(d, date);
    }).sort((a, b) => {
      const pa = { urgent: 0, high: 1, medium: 2, low: 3 }[a.priority ?? "low"] ?? 3;
      const pb = { urgent: 0, high: 1, medium: 2, low: 3 }[b.priority ?? "low"] ?? 3;
      return pa - pb;
    }),
  [cards, date]);

  const isToday = isSameDayUtil(date, now);

  return (
    <Card variant="default" className="!p-0 overflow-hidden">
      <div className={cn("px-5 py-3 border-b", isToday ? "border-accent-cyan/30 bg-accent-cyan/5" : "border-slate-800")}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-200">
            {isToday && <span className="text-accent-cyan mr-2">●</span>}
            Prazos do dia
          </span>
          <Badge variant="neutral" size="sm">{dayCards.length} {dayCards.length === 1 ? "projeto" : "projetos"}</Badge>
        </div>
      </div>
      <div className="p-4">
        {dayCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarDots size={32} weight="duotone" className="text-slate-600 mb-2" />
            <p className="text-sm text-slate-500">Nenhum prazo neste dia</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dayCards.map((card) => (
              <CalCardChip key={card.id} card={card} columns={columns} onClick={() => onEditCard(card)} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// --- VIEW: SEMANA ---
function CalSemanaView({ date, cards, columns, onEditCard, now }: { date: Date; cards: KanbanCardType[]; columns: KanbanColumnType[]; onEditCard: (c: KanbanCardType) => void; now: Date }) {
  const weekStart = useMemo(() => {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [date]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
  [weekStart]);

  // Agrupar cards por dia da semana
  const cardsByDay = useMemo(() => {
    const map = new Map<number, KanbanCardType[]>();
    weekDays.forEach((_, i) => map.set(i, []));
    cards.forEach((card) => {
      const d = new Date(card.due_date!);
      const idx = weekDays.findIndex((wd) => isSameDayUtil(wd, d));
      if (idx >= 0) map.get(idx)!.push(card);
    });
    // Ordenar por prioridade dentro de cada dia
    map.forEach((dayCards) => {
      dayCards.sort((a, b) => {
        const pa = { urgent: 0, high: 1, medium: 2, low: 3 }[a.priority ?? "low"] ?? 3;
        const pb = { urgent: 0, high: 1, medium: 2, low: 3 }[b.priority ?? "low"] ?? 3;
        return pa - pb;
      });
    });
    return map;
  }, [cards, weekDays]);

  return (
    <Card variant="default" className="overflow-hidden !p-0">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-800">
        {weekDays.map((d, i) => {
          const isToday = isSameDayUtil(d, now);
          const count = cardsByDay.get(i)?.length ?? 0;
          return (
            <div key={i} className={cn("flex flex-col items-center py-3", i > 0 && "border-l border-slate-800/50")}>
              <span className="text-[10px] font-medium text-slate-500 uppercase">{CAL_DIAS_SEMANA[i]}</span>
              <span
                className={cn(
                  "mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                  isToday ? "bg-accent-cyan text-slate-950" : "text-slate-200"
                )}
              >
                {d.getDate()}
              </span>
              {count > 0 && (
                <span className="mt-1 text-[10px] font-medium text-slate-400">{count} {count === 1 ? "prazo" : "prazos"}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-7 min-h-[320px]">
        {weekDays.map((wd, i) => {
          const dayCards = cardsByDay.get(i) ?? [];
          const isToday = isSameDayUtil(wd, now);
          return (
            <div
              key={i}
              className={cn(
                "p-2 space-y-1.5",
                i > 0 && "border-l border-slate-800/30",
                isToday && "bg-accent-cyan/[0.03]"
              )}
            >
              {dayCards.map((card) => (
                <CalCardChip key={card.id} card={card} columns={columns} onClick={() => onEditCard(card)} />
              ))}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// --- VIEW: MÊS ---
function CalMesView({ date, cards, columns, onEditCard, now }: { date: Date; cards: KanbanCardType[]; columns: KanbanColumnType[]; onEditCard: (c: KanbanCardType) => void; now: Date }) {
  const { weeks, monthStart } = useMemo(() => {
    const ms = new Date(date.getFullYear(), date.getMonth(), 1);
    const me = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    // Começar no domingo da semana do dia 1
    const calStart = new Date(ms);
    calStart.setDate(calStart.getDate() - calStart.getDay());
    // Terminar no sábado da semana do último dia
    const calEnd = new Date(me);
    calEnd.setDate(calEnd.getDate() + (6 - calEnd.getDay()));

    const wks: Date[][] = [];
    const cursor = new Date(calStart);
    while (cursor <= calEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      wks.push(week);
    }
    return { weeks: wks, monthStart: ms };
  }, [date]);

  // Agrupar cards por dia (chave: YYYY-MM-DD)
  const cardsByDate = useMemo(() => {
    const map = new Map<string, KanbanCardType[]>();
    cards.forEach((card) => {
      const d = new Date(card.due_date!);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    });
    return map;
  }, [cards]);

  return (
    <Card variant="default" className="overflow-hidden !p-0">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-slate-800">
        {CAL_DIAS_SEMANA.map((d, i) => (
          <div key={i} className={cn("py-2 text-center text-[10px] font-semibold uppercase text-slate-500", i > 0 && "border-l border-slate-800/50")}>
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className={cn("grid grid-cols-7", wi > 0 && "border-t border-slate-800/40")}>
          {week.map((day, di) => {
            const isCurrentMonth = day.getMonth() === monthStart.getMonth();
            const isToday = isSameDayUtil(day, now);
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const dayCards = cardsByDate.get(key) ?? [];
            const overdue = dayCards.some((c) => c.due_date && isOverdueHelper(c.due_date));

            return (
              <div
                key={di}
                className={cn(
                  "min-h-[90px] p-1.5",
                  di > 0 && "border-l border-slate-800/30",
                  !isCurrentMonth && "opacity-40",
                  isToday && "bg-accent-cyan/[0.04]"
                )}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isToday ? "bg-accent-cyan text-slate-950" : "text-slate-400"
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {dayCards.length > 0 && (
                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", overdue ? "bg-red-500/15 text-red-400" : "bg-slate-700/50 text-slate-400")}>
                      {dayCards.length}
                    </span>
                  )}
                </div>

                {/* Card chips (max 3, then "+N") */}
                <div className="space-y-0.5">
                  {dayCards.slice(0, 3).map((card) => {
                    const status = getStatusFromColumn(card.column ?? columns.find((c) => c.id === card.column_id));
                    const cardOverdue = card.due_date ? isOverdueHelper(card.due_date) : false;
                    return (
                      <button
                        key={card.id}
                        onClick={() => onEditCard(card)}
                        className={cn(
                          "w-full text-left rounded px-1.5 py-0.5 text-[10px] font-medium truncate transition-colors hover:brightness-125 cursor-pointer",
                          cardOverdue ? "bg-red-500/15 text-red-300" : "text-slate-300"
                        )}
                        style={{ backgroundColor: cardOverdue ? undefined : `${status.color}20`, borderLeft: `2px solid ${status.color}` }}
                        title={card.title}
                      >
                        {card.title}
                      </button>
                    );
                  })}
                  {dayCards.length > 3 && (
                    <span className="block text-[9px] text-slate-500 pl-1">+{dayCards.length - 3} mais</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </Card>
  );
}

// ============================================================
// TAB: TIMELINE / GANTT
// ============================================================

const GANTT_COL_W = 36; // largura de cada coluna de dia em px
const GANTT_ROW_H = 48;

function TimelineTab({ cards, columns }: { cards: KanbanCardType[]; columns: KanbanColumnType[] }) {
  // Gerar dias: 30 dias a partir do início do mês atual
  const days = useMemo(() => {
    const result: { date: Date; label: string; dayOfWeek: string }[] = [];
    const diasSemana = ["D", "S", "T", "Q", "Q", "S", "S"];
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      result.push({
        date: d,
        label: d.getDate().toString().padStart(2, "0"),
        dayOfWeek: diasSemana[d.getDay()],
      });
    }
    return result;
  }, []);

  const now = new Date();
  const todayIdx = days.findIndex(
    (d) => d.date.getDate() === now.getDate() && d.date.getMonth() === now.getMonth() && d.date.getFullYear() === now.getFullYear()
  );

  // Cards com due_date para barras Gantt
  const timelineCards = useMemo(() =>
    cards
      .filter((c) => c.due_date)
      .map((card) => ({
        ...card,
        startDate: new Date(card.created_at),
        endDate: new Date(card.due_date!),
        progress: getProgressFromColumn(card.column, columns.length),
        statusColor: getStatusFromColumn(card.column).color,
        display: getUserDisplay(card.responsible),
      }))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
  [cards, columns]);

  // Calcular posição de uma barra
  function getBarPos(startDate: Date, endDate: Date) {
    const origin = days[0]?.date;
    if (!origin) return null;
    const startCol = Math.round((startDate.getTime() - origin.getTime()) / 86400000);
    const span = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
    if (startCol + span < 0 || startCol >= days.length) return null;
    return { startCol: Math.max(0, startCol), span: Math.min(span, days.length - Math.max(0, startCol)) };
  }

  return (
    <Card variant="default" className="overflow-hidden !p-0">
      <div className="flex">
        {/* Coluna fixa esquerda */}
        <div className="w-[280px] flex-shrink-0 border-r border-slate-800">
          {/* Header */}
          <div
            className="flex items-center px-4 border-b border-slate-800"
            style={{ height: GANTT_ROW_H }}
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Projeto
            </span>
          </div>
          {/* Linhas */}
          {timelineCards.map((card, i) => (
            <div
              key={card.id}
              className={cn(
                "flex items-center gap-3 px-4 border-b border-slate-800/40",
                i % 2 === 0 ? "bg-slate-900/40" : "bg-transparent"
              )}
              style={{ height: GANTT_ROW_H }}
            >
              <Avatar initial={card.display.initial} color={card.display.color} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-200">{card.title}</p>
                <p className="text-[10px] text-slate-500">{card.display.name}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Grid scrollável */}
        <div className="flex-1 overflow-x-auto">
          <div style={{ minWidth: days.length * GANTT_COL_W }}>
            {/* Header dias */}
            <div className="flex border-b border-slate-800" style={{ height: GANTT_ROW_H }}>
              {days.map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col items-center justify-center border-r border-slate-800/20",
                    i === todayIdx && "bg-accent-cyan/5"
                  )}
                  style={{ width: GANTT_COL_W }}
                >
                  <span className={cn("text-[10px] font-bold", i === todayIdx ? "text-accent-cyan" : "text-slate-300")}>
                    {d.label}
                  </span>
                  <span className="text-[9px] text-slate-600">{d.dayOfWeek}</span>
                </div>
              ))}
            </div>

            {/* Linhas com barras */}
            {timelineCards.map((card, i) => {
              const bar = getBarPos(card.startDate, card.endDate);
              return (
                <div
                  key={card.id}
                  className={cn(
                    "relative flex items-center border-b border-slate-800/20",
                    i % 2 === 0 ? "bg-slate-900/40" : "bg-transparent"
                  )}
                  style={{ height: GANTT_ROW_H }}
                >
                  {/* Coluna de hoje */}
                  {todayIdx >= 0 && (
                    <div
                      className="absolute top-0 bottom-0 bg-accent-cyan/5"
                      style={{ left: todayIdx * GANTT_COL_W, width: GANTT_COL_W }}
                    />
                  )}
                  {/* Grid lines */}
                  {days.map((_, di) => (
                    <div
                      key={di}
                      className="absolute top-0 bottom-0 border-r border-slate-800/10"
                      style={{ left: di * GANTT_COL_W, width: GANTT_COL_W }}
                    />
                  ))}
                  {/* Barra */}
                  {bar && (
                    <div
                      className="absolute flex items-center rounded-[6px] overflow-hidden"
                      style={{
                        left: bar.startCol * GANTT_COL_W + 2,
                        width: bar.span * GANTT_COL_W - 4,
                        height: 28,
                        top: (GANTT_ROW_H - 28) / 2,
                      }}
                    >
                      {/* Parte preenchida */}
                      <div
                        className="h-full flex items-center justify-center"
                        style={{
                          width: `${card.progress}%`,
                          backgroundColor: card.statusColor,
                        }}
                      >
                        {bar.span * GANTT_COL_W > 50 && (
                          <span className="text-[10px] font-bold text-white/90 drop-shadow-sm">
                            {card.progress}%
                          </span>
                        )}
                      </div>
                      {/* Parte restante */}
                      <div
                        className="h-full flex-1"
                        style={{ backgroundColor: `${card.statusColor}40` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// TAB: POR PESSOA
// ============================================================

function PorPessoaTab({ cards, columns }: { cards: KanbanCardType[]; columns: KanbanColumnType[] }) {
  const byUser = useMemo(() => groupCardsByUser(cards), [cards]);
  const publishedSlugs = ["published", "archived"];

  return (
    <div className="space-y-8">
      {Array.from(byUser.entries()).map(([userId, { name, role, cards: userCards }]) => {
        const display = getUserDisplay(userCards[0]?.responsible);
        const ativas = userCards.filter((c) => !publishedSlugs.includes(c.column?.slug ?? "")).length;
        const total = userCards.length;
        const publicados = userCards.filter((c) => publishedSlugs.includes(c.column?.slug ?? "")).length;

        return (
          <div key={userId} className="space-y-3">
            {/* Header da pessoa */}
            <Card variant="default" className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar initial={display.initial} color={display.color} size="lg" />
                <div>
                  <p className="text-xl font-bold text-slate-50">{name}</p>
                  <p className="text-sm text-slate-400">{role}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-400">{ativas}</p>
                  <p className="text-xs text-slate-500">Ativas</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-slate-100">{total}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-400">{publicados}</p>
                  <p className="text-xs text-slate-500">Publicados</p>
                </div>
              </div>
            </Card>

            {/* Cards de projetos */}
            {userCards.map((card) => {
              const status = getStatusFromColumn(card.column);
              const progress = getProgressFromColumn(card.column, columns.length);
              const platform = card.platforms?.[0] ?? "";
              const overdue = card.due_date && isOverdueHelper(card.due_date) && card.column?.slug !== "published";
              const progressColor =
                progress === 100
                  ? "bg-green-400"
                  : progress >= 50
                  ? "bg-accent-cyan"
                  : "bg-slate-500";

              return (
                <div
                  key={card.id}
                  className="rounded-[10px] border border-slate-800/60 bg-slate-900/40 p-4"
                  style={{ borderLeft: `3px solid ${status.color}` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-100">{card.title}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        {platform && <Dot color={PLATFORM_COLORS[platform] ?? "#6B7280"} />}
                        <span className="text-xs text-slate-400">{platform || "—"}</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            status.bgClass
                          )}
                        >
                          {status.emoji} {status.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pl-4">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={progress} colorClass={progressColor} size="thin" className="w-16 !bg-slate-700" />
                        <span className="text-xs font-medium text-slate-400 w-8 text-right">
                          {progress}%
                        </span>
                      </div>
                      <span
                        className={cn(
                          "text-xs whitespace-nowrap",
                          overdue ? "font-semibold text-red-400" : "text-slate-500"
                        )}
                      >
                        {card.due_date ? formatDateHelper(card.due_date) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// TAB: CONFIGURAÇÕES
// ============================================================

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-teal-500/20 text-teal-400",
  usuario: "bg-orange-500/20 text-orange-400",
};

// Paleta de cores disponíveis para colunas
const COLUMN_COLOR_OPTIONS = [
  "#8B5CF6", "#3B82F6", "#10B981", "#22C55E", "#F59E0B",
  "#F97316", "#EF4444", "#EC4899", "#6366F1", "#38C8DB",
  "#14B8A6", "#A78BFA", "#5A7A82", "#1AA8BF",
];

// Emojis sugeridos para colunas
const COLUMN_EMOJI_OPTIONS = [
  "🔮", "📋", "📌", "🎬", "✂️", "✅", "👍", "🚀", "📦",
  "💡", "🎯", "🔥", "⭐", "🎨", "📸", "🎵", "📱", "💬",
  "🏷️", "📊", "⏳", "🔄", "🎉", "🛠️",
];

function ConfiguracoesTab({ columns, setColumns, cards, users }: {
  columns: KanbanColumnType[];
  setColumns: React.Dispatch<React.SetStateAction<KanbanColumnType[]>>;
  cards: KanbanCardType[];
  users: UserProfile[];
}) {
  // Estado de edição de coluna
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", slug: "", color: "", emoji: "" });
  const [savingColumnId, setSavingColumnId] = useState<string | null>(null);
  const [columnError, setColumnError] = useState<string | null>(null);

  // Estado de criação de nova coluna
  const [showNewColumn, setShowNewColumn] = useState(false);
  const [newColumnForm, setNewColumnForm] = useState({ name: "", slug: "", color: "#3B82F6", emoji: "📄" });
  const [creatingColumn, setCreatingColumn] = useState(false);

  // Estado de confirmação de exclusão
  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);

  // Gerar slug a partir do nome
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  // Iniciar edição de coluna
  function startEdit(col: KanbanColumnType) {
    setEditingColumnId(col.id);
    setEditForm({
      name: col.name,
      slug: col.slug,
      color: col.color ?? "#6B7280",
      emoji: col.emoji ?? getStatusFromColumn(col).emoji,
    });
    setColumnError(null);
  }

  // Cancelar edição
  function cancelEdit() {
    setEditingColumnId(null);
    setColumnError(null);
  }

  // Salvar edição
  async function saveEdit(colId: string) {
    if (!editForm.name.trim()) {
      setColumnError("Nome é obrigatório");
      return;
    }
    setSavingColumnId(colId);
    setColumnError(null);
    try {
      const updated = await updateKanbanColumn(colId, {
        name: editForm.name.trim(),
        slug: editForm.slug.trim() || generateSlug(editForm.name),
        color: editForm.color,
        emoji: editForm.emoji,
      });
      setColumns((prev) => prev.map((c) => (c.id === colId ? updated : c)));
      setEditingColumnId(null);
    } catch (err) {
      setColumnError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSavingColumnId(null);
    }
  }

  // Criar nova coluna
  async function handleCreateColumn() {
    if (!newColumnForm.name.trim()) {
      setColumnError("Nome é obrigatório");
      return;
    }
    setCreatingColumn(true);
    setColumnError(null);
    try {
      const slug = newColumnForm.slug.trim() || generateSlug(newColumnForm.name);
      const created = await createKanbanColumn({
        name: newColumnForm.name.trim(),
        slug,
        color: newColumnForm.color,
        emoji: newColumnForm.emoji,
        position: columns.length + 1,
      });
      setColumns((prev) => [...prev, created]);
      setShowNewColumn(false);
      setNewColumnForm({ name: "", slug: "", color: "#3B82F6", emoji: "📄" });
    } catch (err) {
      setColumnError(err instanceof Error ? err.message : "Erro ao criar coluna");
    } finally {
      setCreatingColumn(false);
    }
  }

  // Excluir coluna
  async function handleDeleteColumn(colId: string) {
    const cardsInColumn = cards.filter((c) => c.column_id === colId);
    if (cardsInColumn.length > 0) {
      setColumnError(`Não é possível excluir: existem ${cardsInColumn.length} card(s) nesta coluna. Mova-os antes.`);
      setDeletingColumnId(null);
      return;
    }
    setSavingColumnId(colId);
    setColumnError(null);
    try {
      await deleteKanbanColumn(colId);
      setColumns((prev) => prev.filter((c) => c.id !== colId));
      setDeletingColumnId(null);
    } catch (err) {
      setColumnError(err instanceof Error ? err.message : "Erro ao excluir");
    } finally {
      setSavingColumnId(null);
    }
  }

  // Drag & drop para reordenar colunas
  const columnSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleColumnDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIdx = columns.findIndex((c) => c.id === active.id);
    const newIdx = columns.findIndex((c) => c.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;

    // Optimistic update
    const reordered = [...columns];
    const [moved] = reordered.splice(oldIdx, 1);
    reordered.splice(newIdx, 0, moved);
    setColumns(reordered);

    try {
      await reorderKanbanColumns(reordered.map((c) => c.id));
    } catch {
      setColumns(columns);
      setColumnError("Erro ao reordenar");
    }
  }, [columns, setColumns]);

  return (
    <div className="mx-auto max-w-[800px] space-y-6">
      {/* Seção 1 — Geral */}
      <Card variant="default">
        <h3 className="mb-4 text-lg font-semibold text-slate-50">Geral</h3>
        <div className="space-y-0 divide-y divide-slate-800/40">
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-slate-300">Nome do Projeto</span>
            <span className="text-sm text-slate-500">Marketing LA Music 2026</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-slate-300">Descrição</span>
            <span className="text-sm text-slate-500 text-right max-w-[300px] truncate">
              Hub centralizado de marketing para LA Music ...
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-slate-300">Marca Padrão</span>
            <span className="rounded-full bg-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-400">
              LA Music School
            </span>
          </div>
        </div>
      </Card>

      {/* Seção 2 — Notificações WhatsApp (migrado para /configuracoes) */}
      <Card variant="default">
        <h3 className="mb-3 text-lg font-semibold text-slate-50">Notificações WhatsApp</h3>
        <p className="text-sm text-slate-400 mb-4">
          As preferências de notificação agora ficam centralizadas na página de Configurações.
        </p>
        <a
          href="/configuracoes"
          className="inline-flex items-center gap-2 rounded-lg bg-accent-cyan/10 px-4 py-2 text-sm font-medium text-accent-cyan hover:bg-accent-cyan/20 transition-colors"
        >
          Gerenciar notificações →
        </a>
      </Card>

      {/* Seção 3 — Colunas Kanban (CRUD completo) */}
      <Card variant="default">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-50">Colunas Kanban</h3>
          <span className="text-xs text-slate-500">{columns.length} colunas</span>
        </div>

        {/* Mensagem de erro */}
        {columnError && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {columnError}
            <button onClick={() => setColumnError(null)} className="ml-2 text-red-300 hover:text-red-200">✕</button>
          </div>
        )}

        <DndContext
          sensors={columnSensors}
          collisionDetection={closestCorners}
          onDragEnd={handleColumnDragEnd}
        >
          <SortableContext
            items={columns.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="divide-y divide-slate-800/30">
              {columns.map((col) => (
                <SortableColumnRow
                  key={col.id}
                  col={col}
                  cards={cards}
                  editingColumnId={editingColumnId}
                  deletingColumnId={deletingColumnId}
                  savingColumnId={savingColumnId}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onSaveEdit={saveEdit}
                  onStartDelete={(id) => { setDeletingColumnId(id); setColumnError(null); }}
                  onCancelDelete={() => setDeletingColumnId(null)}
                  onConfirmDelete={handleDeleteColumn}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Formulário de nova coluna */}
        {showNewColumn ? (
          <div className="mt-3 space-y-3 rounded-xl border border-dashed border-accent-cyan/30 bg-accent-cyan/[0.03] p-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500">Nome</label>
                <input
                  type="text"
                  value={newColumnForm.name}
                  onChange={(e) => {
                    setNewColumnForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                      slug: generateSlug(e.target.value),
                    }));
                  }}
                  placeholder="Ex: Revisão Final"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-accent-cyan/50"
                  autoFocus
                />
              </div>
              <div className="w-[160px]">
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500">Slug</label>
                <input
                  type="text"
                  value={newColumnForm.slug}
                  onChange={(e) => setNewColumnForm((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="revisao_final"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-400 outline-none placeholder:text-slate-600 focus:border-accent-cyan/50"
                />
              </div>
            </div>

            {/* Cor */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-500">Cor</label>
              <div className="flex flex-wrap gap-2">
                {COLUMN_COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColumnForm((prev) => ({ ...prev, color: c }))}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-all",
                      newColumnForm.color === c ? "border-white scale-110" : "border-transparent hover:border-slate-500"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Emoji */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-500">Emoji</label>
              <div className="flex flex-wrap gap-1.5">
                {COLUMN_EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setNewColumnForm((prev) => ({ ...prev, emoji: e }))}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg text-base transition-all",
                      newColumnForm.emoji === e
                        ? "bg-accent-cyan/20 ring-1 ring-accent-cyan scale-110"
                        : "bg-slate-800/60 hover:bg-slate-700/60"
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="primary" size="sm" onClick={handleCreateColumn} disabled={creatingColumn}>
                <Check size={14} weight="bold" />
                {creatingColumn ? "Criando..." : "Criar Coluna"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowNewColumn(false); setColumnError(null); }}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setShowNewColumn(true); setColumnError(null); }}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-slate-700/50 py-2.5 text-sm text-slate-400 transition-colors hover:border-accent-cyan/30 hover:bg-slate-800/30 hover:text-slate-300"
          >
            <Plus size={14} /> Adicionar Coluna
          </button>
        )}
      </Card>

      {/* Seção 4 — Membros do Time */}
      <Card variant="default">
        <h3 className="mb-4 text-lg font-semibold text-slate-50">Membros do Time</h3>
        <div className="divide-y divide-slate-800/30">
          {users.map((user) => {
            const display = getUserDisplay(user);
            const badgeClass = ROLE_BADGE[user.role] ?? "bg-slate-500/20 text-slate-400";
            return (
              <div key={user.id} className="flex items-center gap-3 py-3">
                <Avatar initial={display.initial} color={display.color} size="md" className="!h-9 !w-9 !text-sm" />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-slate-200">{display.name}</span>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", badgeClass)}>
                  {user.role}
                </span>
                <Dot color={user.is_active ? "#22C55E" : "#6B7280"} size="lg" />
              </div>
            );
          })}
        </div>
        <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-slate-700/50 py-2.5 text-sm text-slate-400 transition-colors hover:bg-slate-800/30 hover:text-slate-300">
          <Plus size={14} /> Convidar Membro
        </button>
      </Card>
    </div>
  );
}

// Linha sortable de coluna Kanban (usada na aba Configurações)
function SortableColumnRow({
  col,
  cards,
  editingColumnId,
  deletingColumnId,
  savingColumnId,
  editForm,
  setEditForm,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  col: KanbanColumnType;
  cards: KanbanCardType[];
  editingColumnId: string | null;
  deletingColumnId: string | null;
  savingColumnId: string | null;
  editForm: { name: string; slug: string; color: string; emoji: string };
  setEditForm: React.Dispatch<React.SetStateAction<{ name: string; slug: string; color: string; emoji: string }>>;
  onStartEdit: (col: KanbanColumnType) => void;
  onCancelEdit: () => void;
  onSaveEdit: (colId: string) => void;
  onStartDelete: (colId: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (colId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: col.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const status = getStatusFromColumn(col);
  const isEditing = editingColumnId === col.id;
  const isDeleting = deletingColumnId === col.id;
  const isSaving = savingColumnId === col.id;
  const cardCount = cards.filter((c) => c.column_id === col.id).length;

  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  }

  // Modo de edição
  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="space-y-3 py-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500">Nome</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => {
                setEditForm((prev) => ({
                  ...prev,
                  name: e.target.value,
                  slug: generateSlug(e.target.value),
                }));
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-accent-cyan/50"
              autoFocus
            />
          </div>
          <div className="w-[160px]">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500">Slug</label>
            <input
              type="text"
              value={editForm.slug}
              onChange={(e) => setEditForm((prev) => ({ ...prev, slug: e.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-400 outline-none focus:border-accent-cyan/50"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-500">Cor</label>
          <div className="flex flex-wrap gap-2">
            {COLUMN_COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setEditForm((prev) => ({ ...prev, color: c }))}
                className={cn(
                  "h-7 w-7 rounded-full border-2 transition-all",
                  editForm.color === c ? "border-white scale-110" : "border-transparent hover:border-slate-500"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-500">Emoji</label>
          <div className="flex flex-wrap gap-1.5">
            {COLUMN_EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEditForm((prev) => ({ ...prev, emoji: e }))}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-base transition-all",
                  editForm.emoji === e
                    ? "bg-accent-cyan/20 ring-1 ring-accent-cyan scale-110"
                    : "bg-slate-800/60 hover:bg-slate-700/60"
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="primary" size="sm" onClick={() => onSaveEdit(col.id)} disabled={isSaving}>
            <Check size={14} weight="bold" />
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancelEdit}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  // Modo de confirmação de exclusão
  if (isDeleting) {
    return (
      <div ref={setNodeRef} style={style} className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3">
          <Dot color={status.color} size="lg" />
          <span className="text-sm text-red-400">
            Excluir &quot;{col.name}&quot;?
            {cardCount > 0 && (
              <span className="ml-1 text-xs text-red-300">({cardCount} cards — mova-os antes)</span>
            )}
          </span>
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="danger"
            size="sm"
            onClick={() => onConfirmDelete(col.id)}
            disabled={isSaving || cardCount > 0}
          >
            {isSaving ? "Excluindo..." : "Confirmar"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancelDelete}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  // Modo de visualização — drag handle à esquerda, lápis + lixeira à direita
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-3 py-3"
    >
      {/* Drag handle (pontinhos) */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          "cursor-grab rounded p-0.5 text-slate-600 transition-colors hover:text-slate-400 active:cursor-grabbing",
          isDragging && "cursor-grabbing"
        )}
        title="Arrastar para reordenar"
      >
        <DotsSixVertical size={18} weight="bold" />
      </button>

      {/* Conteúdo da coluna */}
      <Dot color={status.color} size="lg" />
      <span className="text-sm font-medium text-slate-200">{status.label}</span>
      <span className="text-xs text-slate-600">({col.slug})</span>
      {cardCount > 0 && (
        <Badge variant="neutral" size="sm">{cardCount}</Badge>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Emoji */}
      <span className="text-base">{status.emoji}</span>

      {/* Editar */}
      <button
        onClick={() => onStartEdit(col)}
        className="rounded p-1 text-slate-500 opacity-0 transition-colors hover:bg-slate-800 hover:text-accent-cyan group-hover:opacity-100"
        title="Editar coluna"
      >
        <PencilSimple size={14} />
      </button>

      {/* Excluir */}
      <button
        onClick={() => onStartDelete(col.id)}
        className="rounded p-1 text-slate-500 opacity-0 transition-colors hover:bg-slate-800 hover:text-red-400 group-hover:opacity-100"
        title="Excluir coluna"
      >
        <Trash size={14} />
      </button>
    </div>
  );
}
