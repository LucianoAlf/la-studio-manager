"use client";

import { useState, useMemo, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { CaretLeft, CaretRight, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ============================================================
// TIPOS
// ============================================================

type ItemType = "event" | "delivery" | "creation" | "task" | "meeting";
type ViewMode = "dia" | "semana" | "mes";

interface CalendarItem {
  id: string;
  title: string;
  description?: string;
  type: ItemType;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  start_time: string;
  end_time?: string;
  all_day?: boolean;
  responsible: { name: string; initial: string; color: string };
  content_type?: string;
  platforms?: string[];
  location?: string;
  priority?: "urgent" | "high" | "medium" | "low";
}

// ============================================================
// CONFIGURAÇÕES
// ============================================================

const TYPE_CONFIG: Record<ItemType, { color: string; emoji: string; label: string }> = {
  event:    { color: "#F97316", emoji: "🎸", label: "Evento" },
  delivery: { color: "#EF4444", emoji: "🔴", label: "Entrega" },
  creation: { color: "#3B9CC2", emoji: "📹", label: "Criação" },
  task:     { color: "#22C55E", emoji: "✅", label: "Tarefa" },
  meeting:  { color: "#8B5CF6", emoji: "🧠", label: "Reunião" },
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  youtube: "#FF0000",
  tiktok: "#25F4EE",
};

const RESPONSAVEIS = {
  Yuri:  { name: "Yuri",  initial: "Y", color: "#3B9CC2" },
  John:  { name: "John",  initial: "J", color: "#F97316" },
  Rayan: { name: "Rayan", initial: "R", color: "#22C55E" },
};

// ============================================================
// DADOS MOCK
// ============================================================

const MOCK_CALENDAR_ITEMS: CalendarItem[] = [
  { id: "1",  title: "Gravação: Tour pela Escola", type: "creation", status: "in_progress", start_time: "2026-02-03T09:30", end_time: "2026-02-03T11:00", responsible: RESPONSAVEIS.John, platforms: ["youtube"], location: "LA Music — Unidade Barra" },
  { id: "2",  title: "Entrega: Carrossel Dicas de Guitarra", type: "delivery", status: "pending", start_time: "2026-02-03T14:00", responsible: RESPONSAVEIS.John, platforms: ["instagram"], priority: "high" },
  { id: "3",  title: "Brainstorm Semanal", type: "meeting", status: "pending", start_time: "2026-02-04T10:00", end_time: "2026-02-04T11:00", responsible: RESPONSAVEIS.Yuri, description: "Alinhamento de pauta semanal com todo o time" },
  { id: "4",  title: "Post Aniversário — Maria Silva", type: "task", status: "pending", start_time: "2026-02-04T14:00", responsible: RESPONSAVEIS.Rayan, platforms: ["instagram"], content_type: "image" },
  { id: "5",  title: "Gravação: Depoimento Aluno Piano", type: "creation", status: "pending", start_time: "2026-02-04T15:00", end_time: "2026-02-04T16:30", responsible: RESPONSAVEIS.John, platforms: ["youtube", "instagram"] },
  { id: "6",  title: "Editar: Reels Bastidores Show Rock", type: "creation", status: "in_progress", start_time: "2026-02-05T08:00", end_time: "2026-02-05T10:00", responsible: RESPONSAVEIS.John, platforms: ["instagram"], content_type: "reels" },
  { id: "7",  title: "Newsletter Semanal #6 — rascunho", type: "task", status: "pending", start_time: "2026-02-05T14:00", responsible: RESPONSAVEIS.Yuri, platforms: ["instagram"] },
  { id: "8",  title: "Show Alunos — Unidade Barra", type: "event", status: "pending", start_time: "2026-02-06T09:00", end_time: "2026-02-06T11:00", responsible: RESPONSAVEIS.John, platforms: ["instagram", "youtube"], location: "LA Music — Unidade Barra", description: "Cobertura completa do show semestral. Gravar depoimentos dos alunos, backstage e performance no palco." },
  { id: "9",  title: "Entrega: Cobertura Festival de Verão", type: "delivery", status: "pending", start_time: "2026-02-06T14:00", responsible: RESPONSAVEIS.John, platforms: ["instagram"], priority: "urgent" },
  { id: "10", title: "Review Campanha Matrícula Março", type: "meeting", status: "pending", start_time: "2026-02-06T16:00", end_time: "2026-02-06T17:00", responsible: RESPONSAVEIS.Yuri },
  { id: "11", title: "Gravar: Clipe Banda Velvet", type: "creation", status: "pending", start_time: "2026-02-07T09:00", end_time: "2026-02-07T12:00", responsible: RESPONSAVEIS.John, platforms: ["youtube"], content_type: "video" },
  { id: "12", title: "TikTok Challenge Musical Kids — ideia", type: "task", status: "pending", start_time: "2026-02-07T14:00", responsible: RESPONSAVEIS.Yuri, platforms: ["tiktok"] },
  { id: "13", title: "Festival de Verão LA Music", type: "event", status: "pending", start_time: "2026-02-08T10:00", end_time: "2026-02-08T14:00", responsible: RESPONSAVEIS.Yuri, platforms: ["instagram", "youtube", "tiktok"], location: "LA Music — Sede Principal" },
  { id: "14", title: "Planejamento de Março", type: "meeting", status: "pending", start_time: "2026-02-24T10:00", end_time: "2026-02-24T11:30", responsible: RESPONSAVEIS.Yuri },
  { id: "15", title: "Arte: Promoção Dia das Mães", type: "task", status: "pending", start_time: "2026-02-28T10:00", responsible: RESPONSAVEIS.Rayan, platforms: ["instagram"] },
  // Extras para mês
  { id: "16", title: "Post: Resultado Vestibular", type: "delivery", status: "completed", start_time: "2026-02-01T10:00", responsible: RESPONSAVEIS.Rayan, platforms: ["instagram"] },
  { id: "17", title: "Stories: Tour pela Escola", type: "creation", status: "completed", start_time: "2026-02-02T09:00", end_time: "2026-02-02T10:00", responsible: RESPONSAVEIS.Yuri, platforms: ["instagram"] },
  { id: "18", title: "Clipe Banda Velvet — edição", type: "creation", status: "pending", start_time: "2026-02-11T10:00", end_time: "2026-02-11T12:00", responsible: RESPONSAVEIS.John, platforms: ["youtube"] },
  { id: "19", title: "Dia dos Namorados 💝", type: "event", status: "pending", start_time: "2026-02-14T10:00", responsible: RESPONSAVEIS.Rayan, platforms: ["instagram"] },
  { id: "20", title: "Campanha Matrícula", type: "task", status: "pending", start_time: "2026-02-14T14:00", responsible: RESPONSAVEIS.Rayan, platforms: ["instagram"] },
  { id: "21", title: "TikTok Kids", type: "task", status: "pending", start_time: "2026-02-19T10:00", responsible: RESPONSAVEIS.Yuri, platforms: ["tiktok"] },
  { id: "22", title: "Gravar Março", type: "creation", status: "pending", start_time: "2026-02-26T10:00", responsible: RESPONSAVEIS.John, platforms: ["youtube"] },
];

const CONNECTED_ITEMS = [
  { title: "Editar: Reels Bastidores", day: "Qua 5", type: "Criação" as const },
  { title: "Publicar: Stories Tour", day: "Sex 7", type: "Entrega" as const },
];

const MOCK_COMMENTS = [
  { author: RESPONSAVEIS.Yuri, time: "Ontem, 18:30", text: "John, não esquece de levar o estabilizador pra gravar os depoimentos." },
  { author: RESPONSAVEIS.John, time: "Ontem, 19:15", text: "Beleza! Vou levar gimbal + GoPro pro backstage. 🎬" },
];

// ============================================================
// HELPERS
// ============================================================

const HOUR_H = 64;
const START_HOUR = 7;
const END_HOUR = 18;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

function parseTime(iso: string) {
  const d = new Date(iso);
  return { date: d, hour: d.getHours(), minute: d.getMinutes(), day: d.getDate(), month: d.getMonth(), year: d.getFullYear(), dayOfWeek: d.getDay() };
}

function formatHour(h: number, m: number = 0) {
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // segunda como início
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const DIAS_SEMANA_CURTO = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const DIAS_SEMANA_FULL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function CalendarioPage() {
  const TODAY = useMemo(() => new Date(2026, 1, 6, 10, 22), []);
  const [view, setView] = useState<ViewMode>("semana");
  const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 6));
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(
    MOCK_CALENDAR_ITEMS.find((i) => i.id === "8") || null
  );
  const [filters, setFilters] = useState<Record<ItemType, boolean>>({
    event: true, delivery: true, creation: true, task: true, meeting: true,
  });

  const toggleFilter = useCallback((type: ItemType) => {
    setFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  }, []);

  const filteredItems = useMemo(
    () => MOCK_CALENDAR_ITEMS.filter((item) => filters[item.type]),
    [filters]
  );

  // Navegação
  function goToday() { setCurrentDate(new Date(2026, 1, 6)); }
  function goPrev() {
    const d = new Date(currentDate);
    if (view === "dia") d.setDate(d.getDate() - 1);
    else if (view === "semana") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  }
  function goNext() {
    const d = new Date(currentDate);
    if (view === "dia") d.setDate(d.getDate() + 1);
    else if (view === "semana") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  }

  // Texto da toolbar
  const toolbarText = useMemo(() => {
    if (view === "dia") {
      const dow = DIAS_SEMANA_FULL[currentDate.getDay()];
      return `${dow}, ${currentDate.getDate()} de ${MESES[currentDate.getMonth()]} de ${currentDate.getFullYear()}`;
    }
    if (view === "semana") {
      const ws = getWeekStart(currentDate);
      const we = addDays(ws, 6);
      return `${ws.getDate()} — ${we.getDate()} de ${MESES[ws.getMonth()]}, ${ws.getFullYear()}`;
    }
    return `${MESES[currentDate.getMonth()]} de ${currentDate.getFullYear()}`;
  }, [view, currentDate]);

  return (
    <>
      <Header title="Calendário" subtitle="Super Calendário">
        <button className="flex h-10 items-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-orange-600">
          <Plus size={16} weight="bold" /> Novo Item
        </button>
      </Header>

      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-2.5">
        <div className="flex items-center gap-3">
          <button onClick={goPrev} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
            <CaretLeft size={14} weight="bold" />
          </button>
          <button onClick={goNext} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
            <CaretRight size={14} weight="bold" />
          </button>
          <span className="text-sm font-semibold text-slate-100 ml-1">{toolbarText}</span>
          <button onClick={goToday} className="ml-2 rounded-lg border border-slate-700 px-3 py-1 text-xs font-medium text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
            Hoje
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter chips */}
          {(Object.keys(TYPE_CONFIG) as ItemType[]).map((type) => {
            const cfg = TYPE_CONFIG[type];
            return (
              <button
                key={type}
                onClick={() => toggleFilter(type)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1 text-xs font-medium transition-all",
                  filters[type] ? "text-slate-200 bg-slate-800/50" : "opacity-40 text-slate-500"
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                {cfg.label}
              </button>
            );
          })}

          {/* View toggle */}
          <div className="ml-2 flex rounded-lg border border-slate-700 overflow-hidden">
            {(["dia", "semana", "mes"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold transition-colors",
                  view === v ? "bg-accent-cyan text-white" : "text-slate-400 hover:text-white"
                )}
              >
                {v === "dia" ? "Dia" : v === "semana" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Grid area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {view === "semana" && <WeekView currentDate={currentDate} today={TODAY} items={filteredItems} onSelectItem={setSelectedItem} />}
          {view === "dia" && <DayView currentDate={currentDate} today={TODAY} items={filteredItems} onSelectItem={setSelectedItem} />}
          {view === "mes" && <MonthView currentDate={currentDate} today={TODAY} items={filteredItems} onSelectItem={setSelectedItem} />}
        </div>

        {/* Painel lateral */}
        <SidePanel today={TODAY} currentDate={currentDate} setCurrentDate={setCurrentDate} items={filteredItems} selectedItem={selectedItem} onSelectItem={setSelectedItem} />
      </div>
    </>
  );
}

// ============================================================
// VIEW: SEMANA
// ============================================================

function WeekView({ currentDate, today, items, onSelectItem }: { currentDate: Date; today: Date; items: CalendarItem[]; onSelectItem: (i: CalendarItem) => void }) {
  const weekStart = getWeekStart(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="flex flex-shrink-0 border-b border-slate-800">
        <div className="w-[60px] flex-shrink-0" />
        {weekDays.map((d, i) => {
          const isToday = isSameDay(d, today);
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <div key={i} className="flex-1 flex flex-col items-center py-3 border-l border-slate-800/30">
              <span className={cn("text-[11px] font-semibold uppercase tracking-wider", isWeekend ? "text-slate-600" : "text-slate-500")}>
                {DIAS_SEMANA_CURTO[i]}
              </span>
              <span className={cn(
                "mt-1 flex items-center justify-center text-lg font-bold",
                isToday ? "h-[38px] w-[38px] rounded-full bg-accent-cyan text-white" : isWeekend ? "text-slate-600" : "text-slate-200"
              )}>
                {d.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="flex" style={{ minHeight: HOURS.length * HOUR_H }}>
          {/* Time labels */}
          <div className="w-[60px] flex-shrink-0 relative">
            {HOURS.map((h) => (
              <div key={h} className="absolute right-3 -translate-y-1/2 text-[11px] text-slate-600" style={{ top: (h - START_HOUR) * HOUR_H }}>
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((d, dayIdx) => {
            const isToday = isSameDay(d, today);
            const dayItems = items.filter((item) => {
              const s = new Date(item.start_time);
              return isSameDay(s, d);
            });

            return (
              <div key={dayIdx} className={cn("flex-1 relative border-l border-slate-800/30", isToday && "bg-accent-cyan/[0.03]")}>
                {/* Hour lines */}
                {HOURS.map((h) => (
                  <div key={h} className="absolute left-0 right-0 border-t border-slate-800/20" style={{ top: (h - START_HOUR) * HOUR_H }} />
                ))}

                {/* Event blocks */}
                {dayItems.map((item) => {
                  const s = parseTime(item.start_time);
                  const e = item.end_time ? parseTime(item.end_time) : null;
                  const startMin = (s.hour - START_HOUR) * 60 + s.minute;
                  const duration = e ? ((e.hour - s.hour) * 60 + (e.minute - s.minute)) : 45;
                  const top = (startMin / 60) * HOUR_H;
                  const height = Math.max((duration / 60) * HOUR_H, 28);
                  const cfg = TYPE_CONFIG[item.type];

                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectItem(item)}
                      className="absolute left-1 right-1 rounded-[6px] p-1 px-2 text-left transition-all hover:-translate-y-px hover:shadow-lg cursor-pointer overflow-hidden"
                      style={{
                        top,
                        height,
                        borderLeft: `3px solid ${cfg.color}`,
                        backgroundColor: `${cfg.color}1F`,
                      }}
                    >
                      <p className="text-[11px] font-semibold text-slate-100 truncate">{item.title}</p>
                      {height > 30 && (
                        <p className="text-[10px] text-slate-500">{formatHour(s.hour, s.minute)}{e ? ` — ${formatHour(e.hour, e.minute)}` : ""}</p>
                      )}
                      {height > 50 && (
                        <div className="mt-1 flex items-center gap-1">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ backgroundColor: item.responsible.color }}>
                            {item.responsible.initial}
                          </span>
                          {item.platforms?.map((p) => (
                            <span key={p} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[p] }} />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Now line */}
                {isToday && (() => {
                  const nowMin = (today.getHours() - START_HOUR) * 60 + today.getMinutes();
                  const nowTop = (nowMin / 60) * HOUR_H;
                  if (nowTop < 0 || nowTop > HOURS.length * HOUR_H) return null;
                  return (
                    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowTop }}>
                      <div className="flex items-center">
                        <div className="h-2.5 w-2.5 rounded-full bg-orange-500 -ml-1" />
                        <div className="flex-1 h-[2px] bg-orange-500" />
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// VIEW: DIA
// ============================================================

function DayView({ currentDate, today, items, onSelectItem }: { currentDate: Date; today: Date; items: CalendarItem[]; onSelectItem: (i: CalendarItem) => void }) {
  const isToday = isSameDay(currentDate, today);
  const dayItems = items.filter((item) => isSameDay(new Date(item.start_time), currentDate));
  const urgentCount = dayItems.filter((i) => i.priority === "urgent").length;

  return (
    <div className="flex flex-col h-full">
      {/* Day header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-center gap-5">
          <div className={cn(
            "flex h-[68px] w-[68px] items-center justify-center rounded-[16px] text-3xl font-bold",
            isToday ? "bg-accent-cyan text-white" : "bg-slate-800 text-slate-200"
          )}>
            {currentDate.getDate()}
          </div>
          <div>
            <p className="text-lg font-bold text-slate-100">{DIAS_SEMANA_FULL[currentDate.getDay()]}</p>
            <p className="text-[13px] text-slate-500">{currentDate.getDate()} de {MESES[currentDate.getMonth()]} de {currentDate.getFullYear()}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-lg font-bold text-slate-200">{dayItems.length}</p>
            <p className="text-[11px] text-slate-500">Eventos</p>
          </div>
          {urgentCount > 0 && (
            <div className="text-right">
              <p className="text-lg font-bold text-red-400">{urgentCount}</p>
              <p className="text-[11px] text-slate-500">Urgente</p>
            </div>
          )}
        </div>
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="flex" style={{ minHeight: HOURS.length * HOUR_H }}>
          {/* Time labels */}
          <div className="w-[60px] flex-shrink-0 relative">
            {HOURS.map((h) => (
              <div key={h} className="absolute right-3 -translate-y-1/2 text-[11px] text-slate-600" style={{ top: (h - START_HOUR) * HOUR_H }}>
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Single column */}
          <div className="flex-1 relative">
            {HOURS.map((h) => (
              <div key={h} className="absolute left-0 right-0 border-t border-slate-800/20" style={{ top: (h - START_HOUR) * HOUR_H }} />
            ))}

            {dayItems.map((item) => {
              const s = parseTime(item.start_time);
              const e = item.end_time ? parseTime(item.end_time) : null;
              const startMin = (s.hour - START_HOUR) * 60 + s.minute;
              const duration = e ? ((e.hour - s.hour) * 60 + (e.minute - s.minute)) : 45;
              const top = (startMin / 60) * HOUR_H;
              const height = Math.max((duration / 60) * HOUR_H, 36);
              const cfg = TYPE_CONFIG[item.type];

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className="absolute left-2 right-[60px] rounded-[6px] p-2 px-3 text-left transition-all hover:-translate-y-px hover:shadow-lg cursor-pointer overflow-hidden"
                  style={{
                    top,
                    height,
                    borderLeft: `3px solid ${cfg.color}`,
                    backgroundColor: `${cfg.color}1F`,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-100 truncate">{item.title}</p>
                      <p className="text-[12px] text-slate-500">{formatHour(s.hour, s.minute)}{e ? ` — ${formatHour(e.hour, e.minute)}` : ""} · {cfg.label}</p>
                    </div>
                    {height > 40 && (
                      <div className="flex items-center gap-1 ml-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: item.responsible.color }}>
                          {item.responsible.initial}
                        </span>
                      </div>
                    )}
                  </div>
                  {height > 55 && item.platforms && (
                    <div className="mt-1 flex items-center gap-1.5">
                      {item.platforms.map((p) => (
                        <span key={p} className="flex items-center gap-1 text-[10px] text-slate-400">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[p] }} />
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}

            {/* Now line */}
            {isToday && (() => {
              const nowMin = (today.getHours() - START_HOUR) * 60 + today.getMinutes();
              const nowTop = (nowMin / 60) * HOUR_H;
              if (nowTop < 0 || nowTop > HOURS.length * HOUR_H) return null;
              return (
                <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowTop }}>
                  <div className="flex items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-orange-500 -ml-1" />
                    <div className="flex-1 h-[2px] bg-orange-500" />
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// VIEW: MÊS
// ============================================================

function MonthView({ currentDate, today, items, onSelectItem }: { currentDate: Date; today: Date; items: CalendarItem[]; onSelectItem: (i: CalendarItem) => void }) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Ajustar para começar na segunda
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;
    const gridStart = addDays(firstDay, -startOffset);
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
    return Array.from({ length: totalCells }, (_, i) => addDays(gridStart, i));
  }, [year, month]);

  const WEEKDAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

  return (
    <div className="flex flex-col h-full">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-slate-800 sticky top-0 z-10 bg-slate-950">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            {d}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-7">
          {calendarDays.map((d, i) => {
            const isCurrentMonth = d.getMonth() === month;
            const isToday = isSameDay(d, today);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const dayItems = items.filter((item) => isSameDay(new Date(item.start_time), d));
            const visibleItems = dayItems.slice(0, 3);
            const moreCount = dayItems.length - 3;

            return (
              <div
                key={i}
                className={cn(
                  "min-h-[110px] border-r border-b border-slate-800/30 p-2 transition-colors hover:bg-accent-cyan/[0.04]",
                  !isCurrentMonth && "opacity-30",
                  isToday && "bg-accent-cyan/[0.06]"
                )}
              >
                <span className={cn(
                  "inline-flex items-center justify-center text-sm font-semibold mb-1",
                  isToday ? "h-7 w-7 rounded-full bg-accent-cyan text-white" : isWeekend ? "text-slate-600" : "text-slate-300"
                )}>
                  {d.getDate()}
                </span>
                <div className="space-y-[2px]">
                  {visibleItems.map((item) => {
                    const cfg = TYPE_CONFIG[item.type];
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelectItem(item)}
                        className="w-full text-left rounded-[4px] text-[10px] font-medium p-[2px_6px] truncate transition-colors hover:brightness-125"
                        style={{
                          borderLeft: `3px solid ${cfg.color}`,
                          backgroundColor: `${cfg.color}1F`,
                          color: "#e2e8f0",
                        }}
                      >
                        {cfg.emoji} {item.title}
                      </button>
                    );
                  })}
                  {moreCount > 0 && (
                    <p className="text-[10px] font-medium text-accent-cyan pl-1">+{moreCount} mais</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PAINEL LATERAL
// ============================================================

function SidePanel({ today, currentDate, setCurrentDate, items, selectedItem, onSelectItem }: {
  today: Date;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  items: CalendarItem[];
  selectedItem: CalendarItem | null;
  onSelectItem: (i: CalendarItem) => void;
}) {
  const [miniMonth, setMiniMonth] = useState(today.getMonth());
  const [miniYear, setMiniYear] = useState(today.getFullYear());

  const todayItems = items.filter((item) => isSameDay(new Date(item.start_time), today));

  // Mini calendar
  const miniDays = useMemo(() => {
    const firstDay = new Date(miniYear, miniMonth, 1);
    const lastDay = new Date(miniYear, miniMonth + 1, 0);
    let startOffset = firstDay.getDay() - 1;
    if (startOffset < 0) startOffset = 6;
    const gridStart = addDays(firstDay, -startOffset);
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
    return Array.from({ length: totalCells }, (_, i) => addDays(gridStart, i));
  }, [miniMonth, miniYear]);

  const daysWithEvents = useMemo(() => {
    const set = new Set<string>();
    MOCK_CALENDAR_ITEMS.forEach((item) => {
      const d = new Date(item.start_time);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });
    return set;
  }, []);

  return (
    <div className="w-[340px] flex-shrink-0 min-h-0 border-l border-slate-800 bg-slate-950/80 overflow-y-auto">
      <div className="p-4 space-y-5">
        {/* 1. Mini Calendário */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-slate-200 italic">{MESES[miniMonth]} {miniYear}</span>
            <div className="flex gap-1">
              <button onClick={() => { if (miniMonth === 0) { setMiniMonth(11); setMiniYear(miniYear - 1); } else setMiniMonth(miniMonth - 1); }} className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:text-white transition-colors">
                <CaretLeft size={12} weight="bold" />
              </button>
              <button onClick={() => { if (miniMonth === 11) { setMiniMonth(0); setMiniYear(miniYear + 1); } else setMiniMonth(miniMonth + 1); }} className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:text-white transition-colors">
                <CaretRight size={12} weight="bold" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-medium text-slate-600">{d}</div>
            ))}
            {miniDays.map((d, i) => {
              const isCurrentMonth = d.getMonth() === miniMonth;
              const isToday = isSameDay(d, today);
              const hasEvent = daysWithEvents.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <button
                  key={i}
                  onClick={() => setCurrentDate(new Date(d))}
                  className={cn(
                    "flex flex-col items-center justify-center h-8 rounded-full text-[11px] transition-colors",
                    !isCurrentMonth && "opacity-40",
                    isToday ? "bg-accent-cyan text-white font-bold" : isWeekend ? "text-slate-600 hover:bg-slate-800" : "text-slate-400 hover:bg-slate-800"
                  )}
                >
                  {d.getDate()}
                  {hasEvent && !isToday && <span className="h-1 w-1 rounded-full bg-orange-500 -mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Agenda do Dia */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
            ⚡ Agenda de Hoje — {today.getDate()} {MESES[today.getMonth()].slice(0, 3).toUpperCase()}
          </p>
          <div className="space-y-2">
            {todayItems.map((item) => {
              const s = parseTime(item.start_time);
              const e = item.end_time ? parseTime(item.end_time) : null;
              const duration = e ? ((e.hour - s.hour) * 60 + (e.minute - s.minute)) : 0;
              const durationLabel = duration >= 60 ? `${Math.floor(duration / 60)}h` : `${duration}min`;
              const cfg = TYPE_CONFIG[item.type];
              const isUrgent = item.priority === "urgent";

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className={cn(
                    "w-full text-left rounded-[10px] border bg-slate-900/60 p-3 transition-colors hover:bg-slate-800/60",
                    isUrgent ? "border-red-500/60" : "border-slate-800/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 text-right w-10">
                      <p className={cn("text-xs font-bold", isUrgent ? "text-red-400" : "text-slate-200")}>
                        {formatHour(s.hour, s.minute)}
                      </p>
                      {duration > 0 && <p className="text-[10px] text-slate-600">{durationLabel}</p>}
                      <span className="inline-block mt-1 h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-slate-100 truncate">{item.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ backgroundColor: `${cfg.color}30`, color: cfg.color }}>
                          {cfg.label}
                        </span>
                        {isUrgent && (
                          <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-red-400">Urgente</span>
                        )}
                        {item.content_type && (
                          <span className="text-[9px] text-slate-500">{item.content_type}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex -space-x-1 flex-shrink-0">
                      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[9px] font-bold text-white border-2 border-slate-900" style={{ backgroundColor: item.responsible.color }}>
                        {item.responsible.initial}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Detalhes do Item Selecionado */}
        {selectedItem && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">📋 Detalhes do Item</p>
            <div className="rounded-[10px] border border-slate-800/50 bg-slate-900/40 p-4 space-y-4">
              {/* Header */}
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] text-lg" style={{ backgroundColor: `${TYPE_CONFIG[selectedItem.type].color}20` }}>
                  {TYPE_CONFIG[selectedItem.type].emoji}
                </span>
                <div>
                  <p className="text-base font-bold text-slate-100">{selectedItem.title}</p>
                  <span className="inline-block mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${TYPE_CONFIG[selectedItem.type].color}30`, color: TYPE_CONFIG[selectedItem.type].color }}>
                    {TYPE_CONFIG[selectedItem.type].label}
                  </span>
                </div>
              </div>

              {/* Rows */}
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <span className="w-[80px] flex-shrink-0 text-slate-500 flex items-center gap-1.5">📅 Data</span>
                  <span className="text-slate-200">
                    {(() => {
                      const s = parseTime(selectedItem.start_time);
                      const e = selectedItem.end_time ? parseTime(selectedItem.end_time) : null;
                      return `${s.day.toString().padStart(2, "0")} ${MESES[s.month].slice(0, 3)} ${s.year} · ${formatHour(s.hour, s.minute)}${e ? ` — ${formatHour(e.hour, e.minute)}` : ""}`;
                    })()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-[80px] flex-shrink-0 text-slate-500 flex items-center gap-1.5">👤 Responsável</span>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: selectedItem.responsible.color }}>
                      {selectedItem.responsible.initial}
                    </span>
                    <span className="text-slate-200">{selectedItem.responsible.name}</span>
                  </div>
                </div>
                {selectedItem.location && (
                  <div className="flex items-start gap-3">
                    <span className="w-[80px] flex-shrink-0 text-slate-500 flex items-center gap-1.5">📍 Local</span>
                    <span className="text-slate-200">{selectedItem.location}</span>
                  </div>
                )}
                {selectedItem.platforms && selectedItem.platforms.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="w-[80px] flex-shrink-0 text-slate-500 flex items-center gap-1.5">🏷️ Plataformas</span>
                    <div className="flex gap-1.5">
                      {selectedItem.platforms.map((p) => (
                        <span key={p} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${PLATFORM_COLORS[p]}20`, color: PLATFORM_COLORS[p] }}>
                          ● {p.charAt(0).toUpperCase() + p.slice(1)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedItem.description && (
                  <div className="flex items-start gap-3">
                    <span className="w-[80px] flex-shrink-0 text-slate-500 flex items-center gap-1.5">📝 Descrição</span>
                    <span className="text-slate-400 text-[13px] leading-relaxed">{selectedItem.description}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. Itens Conectados */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">🔗 Itens Conectados</p>
          <div className="space-y-2">
            {CONNECTED_ITEMS.map((ci, i) => (
              <div key={i} className="flex items-center justify-between rounded-[10px] border border-slate-800/50 bg-slate-900/40 p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: ci.type === "Criação" ? TYPE_CONFIG.creation.color : TYPE_CONFIG.delivery.color }} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-200 truncate">{ci.title}</p>
                    <p className="text-[11px] text-slate-500">{ci.day} · {ci.type}</p>
                  </div>
                </div>
                <span className="text-slate-600 flex-shrink-0">→</span>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Comentários */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">💬 Comentários ({MOCK_COMMENTS.length})</p>
          <div className="space-y-3">
            {MOCK_COMMENTS.map((c, i) => (
              <div key={i} className="flex gap-2.5">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: c.author.color }}>
                  {c.author.initial}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-bold text-slate-200">{c.author.name}</span>
                    <span className="text-[10px] text-slate-600">{c.time}</span>
                  </div>
                  <p className="text-[13px] text-slate-400 leading-relaxed mt-0.5">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Input */}
          <div className="mt-3 flex items-center gap-2">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: RESPONSAVEIS.Yuri.color }}>
              Y
            </span>
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5">
              <input placeholder="Escrever comentário..." className="flex-1 bg-transparent text-[13px] text-slate-200 outline-none placeholder:text-slate-600" />
              <button className="rounded-md bg-accent-cyan px-3 py-1 text-[11px] font-semibold text-white hover:bg-accent-cyan/80 transition-colors">
                Enviar
              </button>
            </div>
          </div>
        </div>

        {/* 6. Legenda */}
        <div className="pt-2 border-t border-slate-800/40">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Tipos de Item</p>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(TYPE_CONFIG) as ItemType[]).map((type) => {
              const cfg = TYPE_CONFIG[type];
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                  <span className="text-[11px] text-slate-400">{cfg.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
