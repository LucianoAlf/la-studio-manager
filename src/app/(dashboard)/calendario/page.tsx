"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Header } from "@/components/layout/header";
import { CaretLeft, CaretRight, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button, Badge, Avatar, IconButton, Chip, Dot } from "@/components/ui";
import { getCalendarItems, getCalendarItemConnections, getCalendarItemComments, addCalendarComment } from "@/lib/queries/calendar";
import { getCurrentUserProfile } from "@/lib/queries/users";
import { TYPE_COLORS, TYPE_EMOJIS, getDateRange, getUserDisplay, PLATFORM_COLORS } from "@/lib/utils/calendar-helpers";
import type { CalendarItem, CalendarItemType, CalendarItemConnection, CalendarItemComment } from "@/lib/types/database";

// ============================================================
// TIPOS LOCAIS
// ============================================================

type ViewMode = "dia" | "semana" | "mes";

// Mapa de config por tipo (derivado dos helpers centralizados)
const TYPE_CONFIG: Record<CalendarItemType, { color: string; emoji: string; label: string }> = {
  event:    { color: TYPE_COLORS.event.border,    emoji: TYPE_EMOJIS.event,    label: TYPE_COLORS.event.label },
  delivery: { color: TYPE_COLORS.delivery.border,  emoji: TYPE_EMOJIS.delivery,  label: TYPE_COLORS.delivery.label },
  creation: { color: TYPE_COLORS.creation.border,  emoji: TYPE_EMOJIS.creation,  label: TYPE_COLORS.creation.label },
  task:     { color: TYPE_COLORS.task.border,      emoji: TYPE_EMOJIS.task,      label: TYPE_COLORS.task.label },
  meeting:  { color: TYPE_COLORS.meeting.border,   emoji: TYPE_EMOJIS.meeting,   label: TYPE_COLORS.meeting.label },
};

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
  const TODAY = useMemo(() => new Date(), []);
  const [view, setView] = useState<ViewMode>("semana");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [filters, setFilters] = useState<Record<CalendarItemType, boolean>>({
    event: true, delivery: true, creation: true, task: true, meeting: true,
  });

  // === Estado Supabase ===
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connections, setConnections] = useState<CalendarItemConnection[]>([]);
  const [comments, setComments] = useState<CalendarItemComment[]>([]);
  const [currentUser, setCurrentUser] = useState<{ userId: string; profile: { full_name: string; display_name: string | null; avatar_url: string | null } } | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Carregar user atual uma vez
  useEffect(() => {
    getCurrentUserProfile().then(setCurrentUser).catch(console.error);
  }, []);

  // Carregar items quando muda data, view ou retry
  useEffect(() => {
    let cancelled = false;
    async function loadItems() {
      setLoading(true);
      setError(null);
      try {
        const { start, end } = getDateRange(currentDate, view);
        const data = await getCalendarItems(start, end);
        if (!cancelled) setItems(data);
      } catch (err) {
        console.error("Erro ao carregar items:", err);
        if (!cancelled) setError("Erro ao carregar dados do calendário");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadItems();
    return () => { cancelled = true; };
  }, [currentDate, view, retryKey]);

  const toggleFilter = useCallback((type: CalendarItemType) => {
    setFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  }, []);

  const filteredItems = useMemo(
    () => items.filter((item) => filters[item.type]),
    [items, filters]
  );

  // Ao clicar em evento — carregar detalhes
  const handleSelectItem = useCallback(async (item: CalendarItem) => {
    setSelectedItem(item);
    try {
      const [conns, comms] = await Promise.all([
        getCalendarItemConnections(item.id),
        getCalendarItemComments(item.id),
      ]);
      setConnections(conns);
      setComments(comms);
    } catch (err) {
      console.error("Erro ao carregar detalhes:", err);
    }
  }, []);

  // Enviar comentário
  const handleSendComment = useCallback(async (text: string) => {
    if (!selectedItem || !currentUser || !text.trim()) return;
    try {
      const newComment = await addCalendarComment(selectedItem.id, currentUser.userId, text.trim());
      setComments((prev) => [...prev, newComment]);
    } catch (err) {
      console.error("Erro ao enviar comentário:", err);
    }
  }, [selectedItem, currentUser]);

  // Navegação
  function goToday() { setCurrentDate(new Date()); }
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
        <Button variant="primary" size="lg">
          <Plus size={16} weight="bold" /> Novo Item
        </Button>
      </Header>

      {/* Toolbar */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-2.5">
        <div className="flex items-center gap-3">
          <IconButton size="sm" variant="outline" onClick={goPrev}>
            <CaretLeft size={14} weight="bold" />
          </IconButton>
          <IconButton size="sm" variant="outline" onClick={goNext}>
            <CaretRight size={14} weight="bold" />
          </IconButton>
          <span className="text-sm font-semibold text-slate-100 ml-1">{toolbarText}</span>
          <Button variant="outline" size="sm" onClick={goToday} className="ml-2">
            Hoje
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter chips */}
          {(Object.keys(TYPE_CONFIG) as CalendarItemType[]).map((type) => {
            const cfg = TYPE_CONFIG[type];
            return (
              <Chip
                key={type}
                label={cfg.label}
                dotColor={cfg.color}
                active={filters[type]}
                onClick={() => toggleFilter(type)}
              />
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
          {loading ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-slate-500">Carregando calendário...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-sm text-red-400 mb-2">{error}</p>
                <button onClick={() => setRetryKey((k) => k + 1)} className="text-sm text-accent-cyan hover:underline">
                  Tentar novamente
                </button>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center">
                <span className="text-4xl mb-3 block">📅</span>
                <p className="text-sm text-slate-500 mb-2">Nenhum item neste período</p>
              </div>
            </div>
          ) : (
            <>
              {view === "semana" && <WeekView currentDate={currentDate} today={TODAY} items={filteredItems} onSelectItem={handleSelectItem} />}
              {view === "dia" && <DayView currentDate={currentDate} today={TODAY} items={filteredItems} onSelectItem={handleSelectItem} />}
              {view === "mes" && <MonthView currentDate={currentDate} today={TODAY} items={filteredItems} onSelectItem={handleSelectItem} />}
            </>
          )}
        </div>

        {/* Painel lateral */}
        <SidePanel
          today={TODAY}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          items={filteredItems}
          allItems={items}
          selectedItem={selectedItem}
          onSelectItem={handleSelectItem}
          connections={connections}
          comments={comments}
          currentUser={currentUser}
          onSendComment={handleSendComment}
        />
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
        <div className="flex pt-3" style={{ minHeight: HOURS.length * HOUR_H + 12 }}>
          {/* Time labels */}
          <div className="w-[60px] flex-shrink-0 relative">
            {HOURS.map((h) => (
              <div key={h} className="absolute right-3 -translate-y-1/2 text-[11px] text-slate-600" style={{ top: (h - START_HOUR) * HOUR_H + 12 }}>
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
                  <div key={h} className="absolute left-0 right-0 border-t border-slate-800/20" style={{ top: (h - START_HOUR) * HOUR_H + 12 }} />
                ))}

                {/* Event blocks */}
                {dayItems.map((item) => {
                  const s = parseTime(item.start_time);
                  const e = item.end_time ? parseTime(item.end_time) : null;
                  const startMin = (s.hour - START_HOUR) * 60 + s.minute;
                  const duration = e ? ((e.hour - s.hour) * 60 + (e.minute - s.minute)) : 45;
                  const top = (startMin / 60) * HOUR_H + 12;
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
                      {height > 50 && (() => {
                        const resp = getUserDisplay(item.responsible);
                        return (
                          <div className="mt-1 flex items-center gap-1">
                            <Avatar initial={resp.initial} color={resp.color} size="xs" />
                            {item.platforms?.map((p) => (
                              <Dot key={p} color={PLATFORM_COLORS[p]} size="sm" />
                            ))}
                          </div>
                        );
                      })()}
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
  const urgentCount = dayItems.filter((i) => (i.metadata as Record<string, unknown>)?.priority === "urgent").length;

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
        <div className="flex pt-3" style={{ minHeight: HOURS.length * HOUR_H + 12 }}>
          {/* Time labels */}
          <div className="w-[60px] flex-shrink-0 relative">
            {HOURS.map((h) => (
              <div key={h} className="absolute right-3 -translate-y-1/2 text-[11px] text-slate-600" style={{ top: (h - START_HOUR) * HOUR_H + 12 }}>
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Single column */}
          <div className="flex-1 relative">
            {HOURS.map((h) => (
              <div key={h} className="absolute left-0 right-0 border-t border-slate-800/20" style={{ top: (h - START_HOUR) * HOUR_H + 12 }} />
            ))}

            {dayItems.map((item) => {
              const s = parseTime(item.start_time);
              const e = item.end_time ? parseTime(item.end_time) : null;
              const startMin = (s.hour - START_HOUR) * 60 + s.minute;
              const duration = e ? ((e.hour - s.hour) * 60 + (e.minute - s.minute)) : 45;
              const top = (startMin / 60) * HOUR_H + 12;
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
                    {height > 40 && (() => {
                      const resp = getUserDisplay(item.responsible);
                      return (
                        <div className="flex items-center gap-1 ml-2">
                          <Avatar initial={resp.initial} color={resp.color} size="sm" className="!h-5 !w-5 !text-[9px]" />
                        </div>
                      );
                    })()}
                  </div>
                  {height > 55 && item.platforms && (
                    <div className="mt-1 flex items-center gap-1.5">
                      {item.platforms.map((p) => (
                        <span key={p} className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Dot color={PLATFORM_COLORS[p]} size="sm" />
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

function SidePanel({ today, currentDate, setCurrentDate, items, allItems, selectedItem, onSelectItem, connections, comments, currentUser, onSendComment }: {
  today: Date;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  items: CalendarItem[];
  allItems: CalendarItem[];
  selectedItem: CalendarItem | null;
  onSelectItem: (i: CalendarItem) => void;
  connections: CalendarItemConnection[];
  comments: CalendarItemComment[];
  currentUser: { userId: string; profile: { full_name: string; display_name: string | null; avatar_url: string | null } } | null;
  onSendComment: (text: string) => void;
}) {
  const [miniMonth, setMiniMonth] = useState(today.getMonth());
  const [miniYear, setMiniYear] = useState(today.getFullYear());
  const commentInputRef = useRef<HTMLInputElement>(null);

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
    allItems.forEach((item) => {
      const d = new Date(item.start_time);
      set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });
    return set;
  }, [allItems]);

  function handleCommentSubmit() {
    const text = commentInputRef.current?.value;
    if (!text?.trim()) return;
    onSendComment(text);
    if (commentInputRef.current) commentInputRef.current.value = "";
  }

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
              const isTodayMini = isSameDay(d, today);
              const hasEvent = daysWithEvents.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <button
                  key={i}
                  onClick={() => setCurrentDate(new Date(d))}
                  className={cn(
                    "flex flex-col items-center justify-center h-8 rounded-full text-[11px] transition-colors",
                    !isCurrentMonth && "opacity-40",
                    isTodayMini ? "bg-accent-cyan text-white font-bold" : isWeekend ? "text-slate-600 hover:bg-slate-800" : "text-slate-400 hover:bg-slate-800"
                  )}
                >
                  {d.getDate()}
                  {hasEvent && !isTodayMini && <span className="h-1 w-1 rounded-full bg-orange-500 -mt-0.5" />}
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
            {todayItems.length === 0 && (
              <p className="text-[12px] text-slate-600 italic">Nenhum item para hoje</p>
            )}
            {todayItems.map((item) => {
              const s = parseTime(item.start_time);
              const e = item.end_time ? parseTime(item.end_time) : null;
              const duration = e ? ((e.hour - s.hour) * 60 + (e.minute - s.minute)) : 0;
              const durationLabel = duration >= 60 ? `${Math.floor(duration / 60)}h` : `${duration}min`;
              const cfg = TYPE_CONFIG[item.type];
              const priority = (item.metadata as Record<string, unknown>)?.priority as string | undefined;
              const isUrgent = priority === "urgent";
              const resp = getUserDisplay(item.responsible);

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
                      <Dot color={cfg.color} className="mt-1" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-slate-100 truncate">{item.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="type" size="sm" color={cfg.color}>
                          {cfg.label}
                        </Badge>
                        {isUrgent && (
                          <Badge variant="type" size="sm" color="#EF4444">Urgente</Badge>
                        )}
                        {item.content_type && (
                          <span className="text-[9px] text-slate-500">{item.content_type}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex -space-x-1 flex-shrink-0">
                      <Avatar initial={resp.initial} color={resp.color} size="sm" bordered />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Detalhes do Item Selecionado */}
        {selectedItem && (() => {
          const selCfg = TYPE_CONFIG[selectedItem.type];
          const selResp = getUserDisplay(selectedItem.responsible);
          return (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">📋 Detalhes do Item</p>
              <div className="rounded-[10px] border border-slate-800/50 bg-slate-900/40 p-4 space-y-4">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[10px] text-lg" style={{ backgroundColor: `${selCfg.color}20` }}>
                    {selCfg.emoji}
                  </span>
                  <div>
                    <p className="text-base font-bold text-slate-100">{selectedItem.title}</p>
                    <Badge variant="type" size="md" color={selCfg.color}>
                      {selCfg.label}
                    </Badge>
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
                      <Avatar initial={selResp.initial} color={selResp.color} size="sm" className="!h-5 !w-5 !text-[9px]" />
                      <span className="text-slate-200">{selResp.name}</span>
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
                          <Badge key={p} variant="platform" size="md" color={PLATFORM_COLORS[p]}>
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </Badge>
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
          );
        })()}

        {/* 4. Itens Conectados */}
        {connections.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">🔗 Itens Conectados</p>
            <div className="space-y-2">
              {connections.map((conn) => {
                const linked = conn.target_item_id === selectedItem?.id ? conn.source_item : conn.target_item;
                if (!linked) return null;
                const linkedCfg = TYPE_CONFIG[linked.type];
                const linkedDate = new Date(linked.start_time);
                const dayLabel = `${DIAS_SEMANA_CURTO[linkedDate.getDay() === 0 ? 6 : linkedDate.getDay() - 1]} ${linkedDate.getDate()}`;
                return (
                  <div key={conn.id} className="flex items-center justify-between rounded-[10px] border border-slate-800/50 bg-slate-900/40 p-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Dot color={linkedCfg.color} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-slate-200 truncate">{linked.title}</p>
                        <p className="text-[11px] text-slate-500">{dayLabel} · {linkedCfg.label}</p>
                      </div>
                    </div>
                    <span className="text-slate-600 flex-shrink-0">→</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Comentários */}
        {selectedItem && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">💬 Comentários ({comments.length})</p>
            <div className="space-y-3">
              {comments.map((c) => {
                const authorDisplay = getUserDisplay(c.user ?? null);
                const timeLabel = new Date(c.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={c.id} className="flex gap-2.5">
                    <Avatar initial={authorDisplay.initial} color={authorDisplay.color} size="sm" className="!h-7 !w-7 !text-[10px]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[13px] font-bold text-slate-200">{authorDisplay.name}</span>
                        <span className="text-[10px] text-slate-600">{timeLabel}</span>
                      </div>
                      <p className="text-[13px] text-slate-400 leading-relaxed mt-0.5">{c.comment_text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Input */}
            {currentUser && (() => {
              const userDisplay = getUserDisplay(currentUser.profile);
              return (
                <div className="mt-3 flex items-center gap-2">
                  <Avatar initial={userDisplay.initial} color={userDisplay.color} size="sm" className="!h-7 !w-7 !text-[10px]" />
                  <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5">
                    <input
                      ref={commentInputRef}
                      placeholder="Escrever comentário..."
                      className="flex-1 bg-transparent text-[13px] text-slate-200 outline-none placeholder:text-slate-600"
                      onKeyDown={(e) => { if (e.key === "Enter") handleCommentSubmit(); }}
                    />
                    <button onClick={handleCommentSubmit} className="rounded-md bg-accent-cyan px-3 py-1 text-[11px] font-semibold text-white hover:bg-accent-cyan/80 transition-colors">
                      Enviar
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* 6. Legenda */}
        <div className="pt-2 border-t border-slate-800/40">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Tipos de Item</p>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(TYPE_CONFIG) as CalendarItemType[]).map((type) => {
              const cfg = TYPE_CONFIG[type];
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <Dot color={cfg.color} />
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
