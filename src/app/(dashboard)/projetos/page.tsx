"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getKanbanColumns, getKanbanCards, moveKanbanCard } from "@/lib/queries/kanban";
import { getCalendarItems } from "@/lib/queries/calendar";
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
import type { KanbanColumn as KanbanColumnType, KanbanCard as KanbanCardType, CalendarItem, UserProfile } from "@/lib/types/database";

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
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Carregar calendar items quando tab Calendário é selecionada
  useEffect(() => {
    if (activeTab === "calendario") {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      getCalendarItems(start, end).then(setCalendarItems).catch(console.error);
    }
  }, [activeTab]);

  // Handler para mover card (optimistic update)
  const handleMoveCard = useCallback(async (cardId: string, newColumnId: string, newPosition: number) => {
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
      const freshCards = await getKanbanCards();
      setCards(freshCards);
    }
  }, [columns]);

  return (
    <>
      <Header title="Projetos" subtitle={`${cards.length} itens`}>
        <Button variant="primary" size="md">
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
            {activeTab === "dashboard" && <DashboardTab cards={cards} columns={columns} users={users} />}
            {activeTab === "lista" && <ListaTab cards={cards} columns={columns} />}
            {activeTab === "kanban" && <KanbanTab cards={cards} columns={columns} setCards={setCards} onMoveCard={handleMoveCard} />}
            {activeTab === "calendario" && <CalendarioTab calendarItems={calendarItems} />}
            {activeTab === "timeline" && <TimelineTab cards={cards} columns={columns} />}
            {activeTab === "por-pessoa" && <PorPessoaTab cards={cards} columns={columns} />}
            {activeTab === "configuracoes" && <ConfiguracoesTab columns={columns} users={users} />}
          </>
        )}
      </div>
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

function ListaTab({ cards, columns }: { cards: KanbanCardType[]; columns: KanbanColumnType[] }) {
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
                className={cn(
                  "border-b border-slate-800/50 transition-colors hover:bg-slate-800/40",
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

function KanbanTab({ cards, columns, setCards, onMoveCard }: { cards: KanbanCardType[]; columns: KanbanColumnType[]; setCards: React.Dispatch<React.SetStateAction<KanbanCardType[]>>; onMoveCard: (cardId: string, newColumnId: string, newPosition: number) => Promise<void> }) {
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
    if (!over) return;

    const overId = String(over.id);
    // Se soltou sobre uma coluna
    const targetColumn = columns.find((c) => c.id === overId);
    // Se soltou sobre um card, pegar a coluna do card
    const targetCard = cards.find((c) => c.id === overId);
    const newColumnId = targetColumn?.id || targetCard?.column_id;

    const currentCard = cards.find((c) => c.id === active.id);
    if (newColumnId && currentCard && newColumnId !== currentCard.column_id) {
      const targetCards = grouped.get(newColumnId) ?? [];
      onMoveCard(currentCard.id, newColumnId, targetCards.length);
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
            <div
              key={col.id}
              className="w-[280px] flex-shrink-0 rounded-[14px] border border-slate-800 bg-slate-950/50 p-3"
            >
              {/* Column Header */}
              <div className="mb-3 flex items-center gap-2">
                <Dot color={status.color} size="lg" />
                <span className="text-sm font-semibold text-slate-200">{status.label}</span>
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
                <div className="space-y-2">
                  {colCards.map((card) => (
                    <KanbanCardItem
                      key={card.id}
                      card={card}
                      color={status.color}
                      totalColumns={columns.length}
                    />
                  ))}
                </div>
              </SortableContext>

              {/* Adicionar */}
              <button className="mt-2 flex w-full items-center justify-center gap-1 rounded-[10px] border border-dashed border-slate-700/50 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-800/30 hover:text-slate-400">
                <Plus size={14} /> Adicionar
              </button>
            </div>
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

function KanbanCardItem({
  card,
  color,
  totalColumns,
}: {
  card: KanbanCardType;
  color: string;
  totalColumns: number;
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
      className="cursor-grab rounded-[12px] border border-slate-800 bg-slate-900/80 p-4 transition-colors hover:bg-slate-800/60"
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
// TAB: CALENDÁRIO
// ============================================================

const HORAS = Array.from({ length: 11 }, (_, i) => i + 8); // 8:00 a 18:00
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_NOME = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function CalendarioTab({ calendarItems }: { calendarItems: CalendarItem[] }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<"dia" | "semana" | "mes">("semana");

  const now = new Date();
  const baseStart = new Date(now.getFullYear(), now.getMonth(), 1);
  // Ajustar para domingo da semana
  baseStart.setDate(baseStart.getDate() - baseStart.getDay());
  const weekStart = new Date(baseStart);
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const mesNome = MESES_NOME[weekStart.getMonth()];
  const ano = weekStart.getFullYear();

  const hoje = now.getDate();
  const hojeMes = now.getMonth();
  const hojeAno = now.getFullYear();

  // Filtrar eventos da semana atual
  const weekEvents = useMemo(() => {
    const wStart = weekDays[0];
    const wEnd = weekDays[6];
    if (!wStart || !wEnd) return [];
    return calendarItems.filter((item) => {
      const d = new Date(item.start_time);
      return d >= wStart && d <= new Date(wEnd.getTime() + 86400000);
    });
  }, [calendarItems, weekDays]);

  if (view !== "semana") {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-[14px] border border-dashed border-slate-800 bg-slate-900/50">
        <h2 className="text-h3 font-bold text-slate-50">
          Visualização {view === "dia" ? "Diária" : "Mensal"}
        </h2>
        <p className="mt-2 text-body text-slate-400">Em breve</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header: navegação + toggle view */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconButton size="sm" variant="outline" onClick={() => setWeekOffset((w) => w - 1)}>
            <CaretLeft size={16} weight="bold" />
          </IconButton>
          <h3 className="text-lg font-bold text-slate-50">
            {mesNome} de {ano}
          </h3>
          <IconButton size="sm" variant="outline" onClick={() => setWeekOffset((w) => w + 1)}>
            <CaretRight size={16} weight="bold" />
          </IconButton>
        </div>

        <div className="flex rounded-lg border border-slate-700 overflow-hidden">
          {(["dia", "semana", "mes"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
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

      {/* Calendar Grid */}
      <Card variant="default" className="overflow-hidden !p-0">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-800">
          <div /> {/* spacer para coluna de horas */}
          {weekDays.map((d, i) => {
            const dayNum = d.getDate();
            const isToday =
              dayNum === hoje && d.getMonth() === hojeMes && d.getFullYear() === hojeAno;
            return (
              <div key={i} className="flex flex-col items-center py-3 border-l border-slate-800/50">
                <span className="text-xs text-slate-500">{DIAS_SEMANA[i]}</span>
                <span
                  className={cn(
                    "mt-1 flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold",
                    isToday
                      ? "bg-accent-cyan text-slate-950"
                      : "text-slate-200"
                  )}
                >
                  {dayNum}
                </span>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div className="relative">
          {HORAS.map((hora) => (
            <div key={hora} className="grid grid-cols-[60px_repeat(7,1fr)] h-[50px] border-b border-slate-800/30">
              <div className="flex items-start justify-end pr-2 pt-1 text-xs text-slate-600">
                {hora.toString().padStart(2, "0")}:00
              </div>
              {weekDays.map((wd, di) => (
                <div key={di} className="border-l border-slate-800/30 relative">
                  {/* Render events */}
                  {weekEvents
                    .filter((item) => {
                      const d = new Date(item.start_time);
                      return d.getDate() === wd.getDate() && d.getMonth() === wd.getMonth() && d.getHours() === hora;
                    })
                    .map((item) => {
                      const d = new Date(item.start_time);
                      const topOffset = (d.getMinutes() / 60) * 50;
                      const typeColors: Record<string, string> = {
                        event: "#F97316", delivery: "#EF4444", creation: "#1AA8BF", task: "#10B981", meeting: "#8B5CF6",
                      };
                      const cor = typeColors[item.type] ?? "#6B7280";
                      return (
                        <div
                          key={item.id}
                          className="absolute inset-x-1 rounded-[8px] p-2 text-xs font-medium text-slate-100 transition-colors cursor-pointer z-10"
                          style={{
                            top: `${topOffset}px`,
                            height: "24px",
                            backgroundColor: `${cor}30`,
                            borderLeft: `3px solid ${cor}`,
                          }}
                          title={item.title}
                        >
                          <span className="block truncate leading-none">{item.title}</span>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>
    </div>
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
  editor: "bg-orange-500/20 text-orange-400",
  viewer: "bg-blue-500/20 text-blue-400",
  developer: "bg-violet-500/20 text-violet-400",
};

function ConfiguracoesTab({ columns, users }: { columns: KanbanColumnType[]; users: UserProfile[] }) {
  const [notifs, setNotifs] = useState({
    novasTarefas: true,
    lembretePrazo: true,
    aprovacaoPendente: true,
    tarefaAtrasada: false,
  });

  function toggleNotif(key: keyof typeof notifs) {
    setNotifs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

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

      {/* Seção 2 — Notificações WhatsApp */}
      <Card variant="default">
        <h3 className="mb-4 text-lg font-semibold text-slate-50">Notificações WhatsApp</h3>
        <div className="space-y-0 divide-y divide-slate-800/40">
          {([
            { key: "novasTarefas" as const, label: "Notificar novas tarefas" },
            { key: "lembretePrazo" as const, label: "Lembrete de prazo (24h antes)" },
            { key: "aprovacaoPendente" as const, label: "Aprovação pendente" },
            { key: "tarefaAtrasada" as const, label: "Tarefa atrasada" },
          ]).map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between py-3">
              <span className="text-sm text-slate-300">{label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={notifs[key]}
                onClick={() => toggleNotif(key)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
                  notifs[key] ? "bg-accent-cyan" : "bg-slate-700"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform",
                    notifs[key] ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Seção 3 — Colunas Kanban */}
      <Card variant="default">
        <h3 className="mb-4 text-lg font-semibold text-slate-50">Colunas Kanban</h3>
        <div className="divide-y divide-slate-800/30">
          {columns.map((col) => {
            const status = getStatusFromColumn(col);
            return (
              <div key={col.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Dot color={status.color} size="lg" />
                  <span className="text-sm text-slate-300">{status.label}</span>
                  <span className="text-xs text-slate-600">({col.slug})</span>
                </div>
                <span className="text-base">{status.emoji}</span>
              </div>
            );
          })}
        </div>
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
