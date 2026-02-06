"use client";

import { useState, useMemo, useCallback } from "react";
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

// ============================================================
// DADOS MOCK — trocar por queries Supabase no futuro
// ============================================================

type StatusId =
  | "brainstorm"
  | "planning"
  | "todo"
  | "captando"
  | "editando"
  | "aprovacao"
  | "publicado";

type PrioridadeId = "urgente" | "alta" | "media" | "baixa";

interface Projeto {
  id: number;
  titulo: string;
  plataforma: "Instagram" | "YouTube" | "TikTok";
  marca: "School" | "Kids";
  responsavel: string;
  status: StatusId;
  prioridade: PrioridadeId;
  prazo: string; // ISO date
  progresso: number;
}

const MOCK_PROJETOS: Projeto[] = [
  { id: 1, titulo: "Post: Resultado Vestibular Musical", plataforma: "Instagram", marca: "School", responsavel: "Rayan", status: "publicado", prioridade: "alta", prazo: "2026-02-01", progresso: 100 },
  { id: 2, titulo: "Stories: Tour pela Escola", plataforma: "Instagram", marca: "School", responsavel: "Yuri", status: "publicado", prioridade: "media", prazo: "2026-02-02", progresso: 100 },
  { id: 3, titulo: "Post Aniversário - Maria Silva", plataforma: "Instagram", marca: "Kids", responsavel: "Rayan", status: "aprovacao", prioridade: "media", prazo: "2026-02-04", progresso: 90 },
  { id: 4, titulo: "Cobertura: Festival de Verão", plataforma: "Instagram", marca: "School", responsavel: "John", status: "captando", prioridade: "urgente", prazo: "2026-02-04", progresso: 60 },
  { id: 5, titulo: "Reels: Bastidores Show Rock", plataforma: "Instagram", marca: "School", responsavel: "John", status: "captando", prioridade: "urgente", prazo: "2026-02-05", progresso: 40 },
  { id: 6, titulo: "Carrossel: Dicas de Guitarra", plataforma: "Instagram", marca: "School", responsavel: "John", status: "editando", prioridade: "alta", prazo: "2026-02-06", progresso: 75 },
  { id: 7, titulo: "Newsletter Semanal #6", plataforma: "Instagram", marca: "School", responsavel: "Yuri", status: "todo", prioridade: "media", prazo: "2026-02-07", progresso: 15 },
  { id: 8, titulo: "Vídeo: Depoimento Aluno Piano", plataforma: "YouTube", marca: "School", responsavel: "John", status: "todo", prioridade: "media", prazo: "2026-02-09", progresso: 10 },
  { id: 9, titulo: "Clipe Aluno: Banda Velvet", plataforma: "YouTube", marca: "School", responsavel: "John", status: "editando", prioridade: "alta", prazo: "2026-02-11", progresso: 55 },
  { id: 10, titulo: "Campanha Matrícula Março", plataforma: "Instagram", marca: "School", responsavel: "Rayan", status: "planning", prioridade: "alta", prazo: "2026-02-14", progresso: 20 },
  { id: 11, titulo: "TikTok: Challenge Musical Kids", plataforma: "TikTok", marca: "Kids", responsavel: "Yuri", status: "brainstorm", prioridade: "baixa", prazo: "2026-02-19", progresso: 5 },
  { id: 12, titulo: "Arte: Promoção Dia das Mães", plataforma: "Instagram", marca: "School", responsavel: "Rayan", status: "brainstorm", prioridade: "media", prazo: "2026-02-28", progresso: 0 },
];

const STATUS_CONFIG: Record<StatusId, { label: string; emoji: string; color: string; bgClass: string }> = {
  brainstorm: { label: "Brainstorm", emoji: "🔮", color: "#8B5CF6", bgClass: "bg-[#8B5CF6]/15 text-[#A78BFA]" },
  planning: { label: "Planning", emoji: "📋", color: "#3B82F6", bgClass: "bg-[#3B82F6]/15 text-[#60A5FA]" },
  todo: { label: "To Do", emoji: "📌", color: "#10B981", bgClass: "bg-[#10B981]/15 text-[#34D399]" },
  captando: { label: "Captando", emoji: "🎬", color: "#F59E0B", bgClass: "bg-[#F59E0B]/15 text-[#FBBF24]" },
  editando: { label: "Editando", emoji: "✂️", color: "#F97316", bgClass: "bg-[#F97316]/15 text-[#FB923C]" },
  aprovacao: { label: "Aprovação", emoji: "✅", color: "#22C55E", bgClass: "bg-[#22C55E]/15 text-[#4ADE80]" },
  publicado: { label: "Publicado", emoji: "🚀", color: "#6366F1", bgClass: "bg-[#6366F1]/15 text-[#818CF8]" },
};

const PRIORIDADE_CONFIG: Record<PrioridadeId, { label: string; color: string; bgClass: string }> = {
  urgente: { label: "Urgente", color: "#EF4444", bgClass: "bg-[#EF4444]/15 text-[#F87171]" },
  alta: { label: "Alta", color: "#F97316", bgClass: "bg-[#F97316]/15 text-[#FB923C]" },
  media: { label: "Média", color: "#3B82F6", bgClass: "bg-[#3B82F6]/15 text-[#60A5FA]" },
  baixa: { label: "Baixa", color: "#22C55E", bgClass: "bg-[#22C55E]/15 text-[#4ADE80]" },
};

const PLATAFORMA_COLORS: Record<string, string> = {
  Instagram: "#E1306C",
  YouTube: "#FF0000",
  TikTok: "#00BCD4",
};

const MEMBER_CONFIG: Record<string, { inicial: string; cor: string; role: string }> = {
  Yuri: { inicial: "Y", cor: "bg-teal-500", role: "Líder Marketing" },
  John: { inicial: "J", cor: "bg-orange-500", role: "Produção" },
  Rayan: { inicial: "R", cor: "bg-green-500", role: "Tráfego" },
};

const PIPELINE_ORDER: StatusId[] = ["brainstorm", "planning", "todo", "captando", "editando", "aprovacao", "publicado"];

// Tags para os cards do Kanban
const CARD_TAGS: Record<number, string[]> = {
  1: ["#vestibular", "#resultado"],
  2: ["#tour", "#escola"],
  3: ["#aniversário", "#automação"],
  4: ["#evento", "#cobertura"],
  5: ["#reels", "#bastidores"],
  6: ["#carrossel", "#guitarra"],
  7: ["#newsletter", "#semanal"],
  8: ["#vídeo", "#depoimento"],
  9: ["#clipe", "#aluno"],
  10: ["#matrícula", "#campanha"],
  11: ["#tiktok", "#kids"],
  12: ["#promoção", "#sazonal"],
};

// Eventos mock para o Calendário (semana 1-7 fev 2026)
const MOCK_CALENDAR_EVENTS = [
  { id: 1, projetoId: 1, titulo: "Post: Resultado Vestib...", dia: 1, hora: 10, cor: "#F97316" },
  { id: 2, projetoId: 2, titulo: "Stories: Tour pela Esc...", dia: 2, hora: 10, cor: "#10B981" },
  { id: 3, projetoId: 3, titulo: "Post Aniversário - Mar...", dia: 4, hora: 10, cor: "#22C55E" },
  { id: 4, projetoId: 4, titulo: "Cobertura: Festival de...", dia: 4, hora: 10.5, cor: "#F59E0B" },
  { id: 5, projetoId: 5, titulo: "Reels: Bastidores Show...", dia: 5, hora: 10, cor: "#EF4444" },
  { id: 6, projetoId: 6, titulo: "Carrossel: Dicas de Gu...", dia: 6, hora: 10, cor: "#EC4899" },
  { id: 7, projetoId: 7, titulo: "Newsletter Semanal #6", dia: 7, hora: 10, cor: "#3B82F6" },
];

// Datas de início para o Gantt (mês=1 = fevereiro, mês=0 = janeiro)
const GANTT_DATES: Record<number, { inicioMes: number; inicioDia: number; fimMes: number; fimDia: number }> = {
  1:  { inicioMes: 0, inicioDia: 31, fimMes: 1, fimDia: 1 },
  2:  { inicioMes: 1, inicioDia: 1,  fimMes: 1, fimDia: 2 },
  3:  { inicioMes: 1, inicioDia: 2,  fimMes: 1, fimDia: 4 },
  4:  { inicioMes: 1, inicioDia: 3,  fimMes: 1, fimDia: 4 },
  5:  { inicioMes: 1, inicioDia: 3,  fimMes: 1, fimDia: 5 },
  6:  { inicioMes: 1, inicioDia: 4,  fimMes: 1, fimDia: 6 },
  7:  { inicioMes: 1, inicioDia: 5,  fimMes: 1, fimDia: 7 },
  8:  { inicioMes: 1, inicioDia: 7,  fimMes: 1, fimDia: 9 },
  9:  { inicioMes: 1, inicioDia: 9,  fimMes: 1, fimDia: 11 },
  10: { inicioMes: 1, inicioDia: 12, fimMes: 1, fimDia: 14 },
  11: { inicioMes: 1, inicioDia: 17, fimMes: 1, fimDia: 19 },
  12: { inicioMes: 1, inicioDia: 25, fimMes: 1, fimDia: 28 },
};

// Ordem dos projetos por pessoa
const PROJETOS_POR_PESSOA: Record<string, number[]> = {
  Yuri:  [11, 7, 2],
  John:  [6, 5, 8, 4, 9],
  Rayan: [3, 10, 12, 1],
};

// Membros para a seção Configurações
const CONFIG_MEMBERS = [
  { nome: "Yuri",  role: "Admin",     badgeCor: "bg-teal-500/20 text-teal-400" },
  { nome: "John",  role: "Editor",    badgeCor: "bg-orange-500/20 text-orange-400" },
  { nome: "Rayan", role: "Editor",    badgeCor: "bg-green-500/20 text-green-400" },
  { nome: "Alf",   role: "Developer", badgeCor: "bg-violet-500/20 text-violet-400" },
  { nome: "Hugo",  role: "Developer", badgeCor: "bg-violet-500/20 text-violet-400" },
];

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

  return (
    <>
      <Header title="Projetos" subtitle={`${MOCK_PROJETOS.length} itens`}>
        <button className="flex h-[34px] items-center gap-2 rounded-md bg-accent-cyan px-3 text-body-md font-medium text-slate-950 transition-colors hover:bg-accent-cyan/90">
          <Plus size={16} weight="bold" />
          Novo Projeto
        </button>
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
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "lista" && <ListaTab />}
        {activeTab === "kanban" && <KanbanTab />}
        {activeTab === "calendario" && <CalendarioTab />}
        {activeTab === "timeline" && <TimelineTab />}
        {activeTab === "por-pessoa" && <PorPessoaTab />}
        {activeTab === "configuracoes" && <ConfiguracoesTab />}
      </div>
    </>
  );
}

// ============================================================
// TAB: DASHBOARD
// ============================================================

function DashboardTab() {
  const totalProjetos = MOCK_PROJETOS.length;
  const emProgresso = MOCK_PROJETOS.filter((p) =>
    ["captando", "editando", "todo", "planning", "brainstorm", "aprovacao"].includes(p.status)
  ).length;
  const publicados = MOCK_PROJETOS.filter((p) => p.status === "publicado").length;
  const urgentes = MOCK_PROJETOS.filter((p) => p.prioridade === "urgente").length;

  const pipelineCounts = useMemo(() => {
    const counts: Record<StatusId, number> = {
      brainstorm: 0, planning: 0, todo: 0, captando: 0, editando: 0, aprovacao: 0, publicado: 0,
    };
    MOCK_PROJETOS.forEach((p) => counts[p.status]++);
    return counts;
  }, []);

  const maxPipeline = Math.max(...Object.values(pipelineCounts), 1);

  const proximas24h = MOCK_PROJETOS
    .filter((p) => p.prioridade === "urgente" || p.prioridade === "media")
    .filter((p) => p.status !== "publicado")
    .slice(0, 4);

  const cargaTime = useMemo(() => {
    const carga: Record<string, number> = {};
    MOCK_PROJETOS.forEach((p) => {
      if (p.status !== "publicado") {
        carga[p.responsavel] = (carga[p.responsavel] || 0) + 1;
      }
    });
    return carga;
  }, []);

  return (
    <div className="space-y-6">
      {/* Seção 1 — Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="TOTAL PROJETOS"
          value={totalProjetos}
          change="↑ 12% vs semana passada"
          changePositive
          icon={<Flag size={20} weight="duotone" className="text-accent-cyan" />}
          barColor="bg-accent-cyan"
        />
        <StatCard
          label="EM PROGRESSO"
          value={emProgresso}
          change="↓ 5% vs semana passada"
          changePositive={false}
          icon={<Play size={20} weight="duotone" className="text-orange-400" />}
          barColor="bg-orange-400"
        />
        <StatCard
          label="PUBLICADOS"
          value={publicados}
          change="↑ 25% vs semana passada"
          changePositive
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
        <div className="col-span-2 rounded-[14px] border border-slate-800 bg-slate-900/60 p-6">
          <h3 className="mb-5 text-lg font-semibold text-slate-50">Pipeline Status</h3>
          <div className="space-y-3">
            {PIPELINE_ORDER.map((statusId) => {
              const cfg = STATUS_CONFIG[statusId];
              const count = pipelineCounts[statusId];
              const pct = (count / maxPipeline) * 100;
              return (
                <div key={statusId} className="flex items-center gap-3">
                  <span className="w-5 text-center text-sm">{cfg.emoji}</span>
                  <span className="w-24 text-sm text-slate-300">{cfg.label}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: cfg.color }}
                    />
                  </div>
                  <span className="w-6 text-right text-sm font-semibold text-slate-300">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Próximas 24h (1/3) */}
        <div className="rounded-[14px] border border-slate-800 bg-slate-900/60 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Lightning size={18} weight="duotone" className="text-accent-yellow" />
            <h3 className="text-lg font-semibold text-slate-50">Próximas 24h</h3>
          </div>
          <div className="space-y-3">
            {proximas24h.map((p) => {
              const isUrgente = p.prioridade === "urgente";
              const borderColor = isUrgente ? "#F97316" : "#3B82F6";
              return (
                <div
                  key={p.id}
                  className="rounded-lg bg-slate-800/50 p-3"
                  style={{ borderLeft: `3px solid ${borderColor}` }}
                >
                  <p className="text-sm font-semibold text-slate-100">{p.titulo}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: PLATAFORMA_COLORS[p.plataforma] }}
                      />
                      {p.plataforma} • {p.responsavel}
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                        isUrgente
                          ? "bg-red-500/20 text-red-400"
                          : "bg-blue-500/20 text-blue-400"
                      )}
                    >
                      {isUrgente ? "Urgente" : "Média"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Seção 3 — Carga do Time */}
      <div className="rounded-[14px] border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="mb-5 text-lg font-semibold text-slate-50">Carga do Time</h3>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(MEMBER_CONFIG).map(([nome, cfg]) => (
            <div
              key={nome}
              className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-800/40 p-4"
            >
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white",
                  cfg.cor
                )}
              >
                {cfg.inicial}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-100">{nome}</p>
                <p className="text-xs text-slate-400">{cfg.role}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-slate-100">{cargaTime[nome] || 0}</p>
                <p className="text-xs text-slate-500">ativas</p>
              </div>
            </div>
          ))}
        </div>
      </div>
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
    <div className="rounded-[14px] border border-slate-800 bg-slate-900/60 p-6">
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
    </div>
  );
}

// ============================================================
// TAB: LISTA
// ============================================================

function ListaTab() {
  const [sortAsc, setSortAsc] = useState(true);

  const sortedProjetos = useMemo(() => {
    return [...MOCK_PROJETOS].sort((a, b) => {
      const diff = new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
      return sortAsc ? diff : -diff;
    });
  }, [sortAsc]);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  function formatDate(iso: string) {
    const d = new Date(iso + "T00:00:00");
    const dia = d.getDate().toString().padStart(2, "0");
    const meses = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
    return `${dia} de ${meses[d.getMonth()]}`;
  }

  function isOverdue(iso: string) {
    return new Date(iso + "T00:00:00") < hoje;
  }

  return (
    <div className="rounded-[14px] border border-slate-800 bg-slate-900/60 overflow-hidden">
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
          {sortedProjetos.map((p, i) => {
            const statusCfg = STATUS_CONFIG[p.status];
            const prioCfg = PRIORIDADE_CONFIG[p.prioridade];
            const memberCfg = MEMBER_CONFIG[p.responsavel];
            const overdue = isOverdue(p.prazo) && p.status !== "publicado";
            const progressColor =
              p.progresso === 100
                ? "bg-green-400"
                : p.progresso >= 50
                ? "bg-accent-cyan"
                : "bg-slate-500";

            return (
              <tr
                key={p.id}
                className={cn(
                  "border-b border-slate-800/50 transition-colors hover:bg-slate-800/40",
                  i % 2 === 0 ? "bg-slate-900/30" : "bg-transparent"
                )}
              >
                {/* PROJETO */}
                <td className="px-5 py-3.5">
                  <p className="text-sm font-semibold text-slate-100">{p.titulo}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: PLATAFORMA_COLORS[p.plataforma] }}
                    />
                    <span className="text-xs text-slate-400">{p.plataforma}</span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                        p.marca === "School"
                          ? "bg-teal-500/20 text-teal-400"
                          : "bg-orange-500/20 text-orange-400"
                      )}
                    >
                      {p.marca}
                    </span>
                  </div>
                </td>

                {/* RESPONSÁVEL */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white",
                        memberCfg?.cor || "bg-slate-600"
                      )}
                    >
                      {memberCfg?.inicial || "?"}
                    </div>
                    <span className="text-sm text-slate-300">{p.responsavel}</span>
                  </div>
                </td>

                {/* STATUS */}
                <td className="px-5 py-3.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                      statusCfg.bgClass
                    )}
                  >
                    {statusCfg.emoji} {statusCfg.label}
                  </span>
                </td>

                {/* PRIORIDADE */}
                <td className="px-5 py-3.5">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                      prioCfg.bgClass
                    )}
                  >
                    {prioCfg.label}
                  </span>
                </td>

                {/* PRAZO */}
                <td className="px-5 py-3.5">
                  <span
                    className={cn(
                      "text-sm",
                      overdue ? "font-semibold text-red-400" : "text-slate-300"
                    )}
                  >
                    {formatDate(p.prazo)}
                  </span>
                </td>

                {/* PROGRESSO */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-20 rounded-full bg-slate-700">
                      <div
                        className={cn("h-full rounded-full transition-all", progressColor)}
                        style={{ width: `${p.progresso}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-400">{p.progresso}%</span>
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
    </div>
  );
}

// ============================================================
// TAB: KANBAN
// ============================================================

function KanbanTab() {
  const [projetos, setProjetos] = useState<Projeto[]>([...MOCK_PROJETOS]);
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const columnCards = useMemo(() => {
    const map: Record<StatusId, Projeto[]> = {
      brainstorm: [], planning: [], todo: [], captando: [], editando: [], aprovacao: [], publicado: [],
    };
    projetos.forEach((p) => map[p.status].push(p));
    return map;
  }, [projetos]);

  const activeCard = activeId ? projetos.find((p) => p.id === activeId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const overId = String(over.id);
    // Se soltou sobre uma coluna
    const targetColumn = PIPELINE_ORDER.find((s) => s === overId);
    // Se soltou sobre um card, pegar a coluna do card
    const targetCard = projetos.find((p) => p.id === Number(overId));
    const newStatus = targetColumn || targetCard?.status;

    if (newStatus && newStatus !== projetos.find((p) => p.id === active.id)?.status) {
      setProjetos((prev) =>
        prev.map((p) => (p.id === active.id ? { ...p, status: newStatus } : p))
      );
    }
  }, [projetos]);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  function formatDateShort(iso: string) {
    const d = new Date(iso + "T00:00:00");
    const dia = d.getDate().toString().padStart(2, "0");
    const meses = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
    return `${dia} de ${meses[d.getMonth()]}`;
  }

  function isOverdue(iso: string) {
    return new Date(iso + "T00:00:00") < hoje;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {PIPELINE_ORDER.map((statusId) => {
          const cfg = STATUS_CONFIG[statusId];
          const cards = columnCards[statusId];
          return (
            <div
              key={statusId}
              className="w-[280px] flex-shrink-0 rounded-[14px] border border-slate-800 bg-slate-950/50 p-3"
            >
              {/* Column Header */}
              <div className="mb-3 flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: cfg.color }}
                />
                <span className="text-sm font-semibold text-slate-200">{cfg.label}</span>
                <span className="ml-auto rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">
                  {cards.length}
                </span>
              </div>

              {/* Cards */}
              <SortableContext
                id={statusId}
                items={cards.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {cards.map((card) => (
                    <KanbanCard
                      key={card.id}
                      card={card}
                      color={cfg.color}
                      formatDate={formatDateShort}
                      isOverdue={isOverdue}
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
            style={{ borderLeft: `3px solid ${STATUS_CONFIG[activeCard.status].color}` }}
          >
            <p className="text-sm font-medium text-slate-100">{activeCard.titulo}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanCard({
  card,
  color,
  formatDate,
  isOverdue,
}: {
  card: Projeto;
  color: string;
  formatDate: (iso: string) => string;
  isOverdue: (iso: string) => boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeft: `3px solid ${color}`,
    opacity: isDragging ? 0.4 : 1,
  };

  const memberCfg = MEMBER_CONFIG[card.responsavel];
  const tags = CARD_TAGS[card.id] || [];
  const overdue = isOverdue(card.prazo) && card.status !== "publicado";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-[12px] border border-slate-800 bg-slate-900/80 p-4 transition-colors hover:bg-slate-800/60"
    >
      <p className="text-sm font-medium text-slate-100">{card.titulo}</p>

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
      <div className="mt-3 h-[3px] w-full rounded-full bg-slate-800">
        <div
          className="h-full rounded-full"
          style={{ width: `${card.progresso}%`, backgroundColor: color }}
        />
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white",
              memberCfg?.cor || "bg-slate-600"
            )}
          >
            {memberCfg?.inicial || "?"}
          </div>
          <span className="text-xs text-slate-500">{card.responsavel}</span>
        </div>
        <span className={cn("text-xs", overdue ? "font-semibold text-red-400" : "text-slate-500")}>
          {formatDate(card.prazo)}
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

function CalendarioTab() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<"dia" | "semana" | "mes">("semana");

  // Semana base: 1-7 fev 2026 (Dom-Sáb)
  const baseStart = new Date(2026, 1, 1); // 1 fev 2026 = Domingo
  const weekStart = new Date(baseStart);
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const mesNome = MESES_NOME[weekStart.getMonth()];
  const ano = weekStart.getFullYear();

  // Dia de hoje (6 fev 2026 para mock)
  const hoje = 6;
  const hojeMes = 1; // fevereiro (0-indexed)
  const hojeAno = 2026;

  // Filtrar eventos da semana atual
  const weekEvents = useMemo(() => {
    return MOCK_CALENDAR_EVENTS.filter((ev) => {
      return weekDays.some((d) => d.getDate() === ev.dia && d.getMonth() === 1 && d.getFullYear() === 2026);
    });
  }, [weekDays]);

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
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <CaretLeft size={16} weight="bold" />
          </button>
          <h3 className="text-lg font-bold text-slate-50">
            {mesNome} de {ano}
          </h3>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <CaretRight size={16} weight="bold" />
          </button>
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
      <div className="rounded-[14px] border border-slate-800 bg-slate-900/60 overflow-hidden">
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
              {weekDays.map((_, di) => (
                <div key={di} className="border-l border-slate-800/30 relative">
                  {/* Render events */}
                  {weekEvents
                    .filter((ev) => {
                      const dayMatch = weekDays[di]?.getDate() === ev.dia;
                      const horaMatch = Math.floor(ev.hora) === hora;
                      return dayMatch && horaMatch;
                    })
                    .map((ev) => {
                      const topOffset = (ev.hora - hora) * 50;
                      return (
                        <div
                          key={ev.id}
                          className="absolute inset-x-1 rounded-[8px] p-2 text-xs font-medium text-slate-100 transition-colors cursor-pointer z-10"
                          style={{
                            top: `${topOffset}px`,
                            height: "24px",
                            backgroundColor: `${ev.cor}30`,
                            borderLeft: `3px solid ${ev.cor}`,
                          }}
                          title={ev.titulo}
                        >
                          <span className="block truncate leading-none">{ev.titulo}</span>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB: TIMELINE / GANTT
// ============================================================

const GANTT_COL_W = 36; // largura de cada coluna de dia em px
const GANTT_ROW_H = 48;

function TimelineTab() {
  // Gerar dias: 31 jan a 1 mar (31 dias de fev + 31jan + 1mar = 31 colunas)
  const days = useMemo(() => {
    const result: { date: Date; label: string; dayOfWeek: string }[] = [];
    const diasSemana = ["D", "S", "T", "Q", "Q", "S", "S"];
    // 31 jan
    const start = new Date(2026, 0, 31);
    // até 1 mar = 29 dias (31jan, 1-28fev, 1mar)
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

  const todayIdx = days.findIndex(
    (d) => d.date.getDate() === 6 && d.date.getMonth() === 1 && d.date.getFullYear() === 2026
  );

  // Calcular posição de uma barra
  function getBarPos(projetoId: number) {
    const g = GANTT_DATES[projetoId];
    if (!g) return null;
    const startDate = new Date(2026, g.inicioMes, g.inicioDia);
    const endDate = new Date(2026, g.fimMes, g.fimDia);
    const origin = new Date(2026, 0, 31); // dia 0 do grid
    const startCol = Math.round((startDate.getTime() - origin.getTime()) / 86400000);
    const span = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    return { startCol, span };
  }

  return (
    <div className="rounded-[14px] border border-slate-800 bg-slate-900/60 overflow-hidden">
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
          {MOCK_PROJETOS.map((p, i) => {
            const memberCfg = MEMBER_CONFIG[p.responsavel];
            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-3 px-4 border-b border-slate-800/40",
                  i % 2 === 0 ? "bg-slate-900/40" : "bg-transparent"
                )}
                style={{ height: GANTT_ROW_H }}
              >
                <div
                  className={cn(
                    "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white",
                    memberCfg?.cor || "bg-slate-600"
                  )}
                >
                  {memberCfg?.inicial || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">{p.titulo}</p>
                  <p className="text-[10px] text-slate-500">{p.responsavel}</p>
                </div>
              </div>
            );
          })}
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
            {MOCK_PROJETOS.map((p, i) => {
              const bar = getBarPos(p.id);
              const statusColor = STATUS_CONFIG[p.status]?.color || "#64748b";
              return (
                <div
                  key={p.id}
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
                          width: `${p.progresso}%`,
                          backgroundColor: statusColor,
                        }}
                      >
                        {bar.span * GANTT_COL_W > 50 && (
                          <span className="text-[10px] font-bold text-white/90 drop-shadow-sm">
                            {p.progresso}%
                          </span>
                        )}
                      </div>
                      {/* Parte restante */}
                      <div
                        className="h-full flex-1"
                        style={{ backgroundColor: `${statusColor}40` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TAB: POR PESSOA
// ============================================================

function PorPessoaTab() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  function formatDateShort(iso: string) {
    const d = new Date(iso + "T00:00:00");
    const dia = d.getDate().toString().padStart(2, "0");
    const meses = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
    return `${dia} de ${meses[d.getMonth()]}`;
  }

  function isOverdue(iso: string) {
    return new Date(iso + "T00:00:00") < hoje;
  }

  return (
    <div className="space-y-8">
      {Object.entries(PROJETOS_POR_PESSOA).map(([nome, ids]) => {
        const memberCfg = MEMBER_CONFIG[nome];
        const projetosDaPessoa = ids.map((id) => MOCK_PROJETOS.find((p) => p.id === id)!).filter(Boolean);
        const ativas = projetosDaPessoa.filter((p) => p.status !== "publicado").length;
        const total = projetosDaPessoa.length;
        const publicados = projetosDaPessoa.filter((p) => p.status === "publicado").length;

        return (
          <div key={nome} className="space-y-3">
            {/* Header da pessoa */}
            <div className="flex items-center justify-between rounded-[14px] border border-slate-800 bg-slate-900/60 p-6">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white",
                    memberCfg?.cor || "bg-slate-600"
                  )}
                >
                  {memberCfg?.inicial || "?"}
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-50">{nome}</p>
                  <p className="text-sm text-slate-400">{memberCfg?.role}</p>
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
            </div>

            {/* Cards de projetos */}
            {projetosDaPessoa.map((p) => {
              const statusCfg = STATUS_CONFIG[p.status];
              const overdue = isOverdue(p.prazo) && p.status !== "publicado";
              const progressColor =
                p.progresso === 100
                  ? "bg-green-400"
                  : p.progresso >= 50
                  ? "bg-accent-cyan"
                  : "bg-slate-500";

              return (
                <div
                  key={p.id}
                  className="rounded-[10px] border border-slate-800/60 bg-slate-900/40 p-4"
                  style={{ borderLeft: `3px solid ${statusCfg.color}` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-100">{p.titulo}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: PLATAFORMA_COLORS[p.plataforma] }}
                        />
                        <span className="text-xs text-slate-400">{p.plataforma}</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            statusCfg.bgClass
                          )}
                        >
                          {statusCfg.emoji} {statusCfg.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pl-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-16 rounded-full bg-slate-700">
                          <div
                            className={cn("h-full rounded-full", progressColor)}
                            style={{ width: `${p.progresso}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-400 w-8 text-right">
                          {p.progresso}%
                        </span>
                      </div>
                      <span
                        className={cn(
                          "text-xs whitespace-nowrap",
                          overdue ? "font-semibold text-red-400" : "text-slate-500"
                        )}
                      >
                        {formatDateShort(p.prazo)}
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

function ConfiguracoesTab() {
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
      <div className="rounded-[14px] border border-slate-800 bg-slate-900/60 p-6">
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
      </div>

      {/* Seção 2 — Notificações WhatsApp */}
      <div className="rounded-[14px] border border-slate-800 bg-slate-900/60 p-6">
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
      </div>

      {/* Seção 3 — Colunas Kanban */}
      <div className="rounded-[14px] border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-50">Colunas Kanban</h3>
        <div className="divide-y divide-slate-800/30">
          {PIPELINE_ORDER.map((statusId) => {
            const cfg = STATUS_CONFIG[statusId];
            return (
              <div key={statusId} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span className="text-sm text-slate-300">{cfg.label}</span>
                </div>
                <span className="text-base">{cfg.emoji}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Seção 4 — Membros do Time */}
      <div className="rounded-[14px] border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-50">Membros do Time</h3>
        <div className="divide-y divide-slate-800/30">
          {CONFIG_MEMBERS.map((m) => {
            const memberCfg = MEMBER_CONFIG[m.nome];
            return (
              <div key={m.nome} className="flex items-center gap-3 py-3">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white",
                    memberCfg?.cor || "bg-violet-500"
                  )}
                >
                  {m.nome[0]}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-semibold text-slate-200">{m.nome}</span>
                </div>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", m.badgeCor)}>
                  {m.role}
                </span>
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" title="Online" />
              </div>
            );
          })}
        </div>
        <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-slate-700/50 py-2.5 text-sm text-slate-400 transition-colors hover:bg-slate-800/30 hover:text-slate-300">
          <Plus size={14} /> Convidar Membro
        </button>
      </div>
    </div>
  );
}
