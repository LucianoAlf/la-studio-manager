"use client";

import { useState, useMemo, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import { CalendarBlank, CaretLeft, CaretRight, Clock } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ============================================================
// HELPERS
// ============================================================

const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const daysInMonth = getDaysInMonth(year, month);
  const grid: (Date | null)[] = [];

  for (let i = 0; i < startOffset; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
  while (grid.length % 7 !== 0) grid.push(null);

  return grid;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function formatDisplay(date: Date | null, includeTime: boolean) {
  if (!date) return "";
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();
  if (!includeTime) return `${day}/${month}/${year}`;
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// ============================================================
// MINI CALENDAR
// ============================================================

function MiniCalendar({
  selectedDate,
  onSelectDate,
}: {
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());
  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());

  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const goPrev = useCallback(() => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }, [viewMonth]);

  const goNext = useCallback(() => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }, [viewMonth]);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={goPrev}
          className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors"
        >
          <CaretLeft size={14} weight="bold" />
        </button>
        <span className="text-sm font-semibold text-slate-200">
          {MESES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={goNext}
          className="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors"
        >
          <CaretRight size={14} weight="bold" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-slate-500 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7">
        {grid.map((day, i) => {
          if (!day) {
            return <div key={`empty-${i}`} className="h-8" />;
          }
          const isToday = isSameDay(day, today);
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelectDate(day)}
              className={cn(
                "h-8 w-full flex items-center justify-center rounded-md text-xs font-medium transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground font-bold"
                  : isToday
                  ? "bg-slate-700 text-slate-100 font-bold"
                  : isWeekend
                  ? "text-slate-500 hover:bg-slate-700/50 hover:text-slate-300"
                  : "text-slate-300 hover:bg-slate-700/50 hover:text-slate-100"
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      {/* Atalho Hoje */}
      <button
        type="button"
        onClick={() => {
          setViewMonth(today.getMonth());
          setViewYear(today.getFullYear());
          onSelectDate(today);
        }}
        className="mt-2 w-full text-center text-xs text-primary hover:underline"
      >
        Hoje
      </button>
    </div>
  );
}

// ============================================================
// TIME SELECTOR
// ============================================================

function TimeSelector({
  hours,
  minutes,
  onChangeHours,
  onChangeMinutes,
}: {
  hours: number;
  minutes: number;
  onChangeHours: (h: number) => void;
  onChangeMinutes: (m: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-700">
      <Clock size={14} className="text-slate-400 flex-shrink-0" />
      <span className="text-xs text-slate-400 mr-1">Hora</span>
      <select
        value={hours}
        onChange={(e) => onChangeHours(Number(e.target.value))}
        className="h-8 rounded-md border border-slate-700 bg-slate-800 px-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
      >
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>{pad2(i)}</option>
        ))}
      </select>
      <span className="text-slate-400 font-bold">:</span>
      <select
        value={minutes}
        onChange={(e) => onChangeMinutes(Number(e.target.value))}
        className="h-8 rounded-md border border-slate-700 bg-slate-800 px-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
      >
        {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
          <option key={m} value={m}>{pad2(m)}</option>
        ))}
      </select>
    </div>
  );
}

// ============================================================
// DATE TIME PICKER (data + hora)
// ============================================================

interface DateTimePickerProps {
  value: string;
  onChange: (isoOrLocal: string) => void;
  placeholder?: string;
  error?: boolean;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Selecione data e hora",
  error,
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);

  const parsed = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  const hours = parsed?.getHours() ?? new Date().getHours();
  const minutes = parsed?.getMinutes() ?? 0;

  function emitChange(date: Date, h: number, m: number) {
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    const year = d.getFullYear();
    const month = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const hrs = pad2(d.getHours());
    const mins = pad2(d.getMinutes());
    onChange(`${year}-${month}-${day}T${hrs}:${mins}`);
  }

  function handleSelectDate(day: Date) {
    emitChange(day, hours, minutes);
  }

  function handleChangeHours(h: number) {
    const base = parsed ?? new Date();
    emitChange(base, h, minutes);
  }

  function handleChangeMinutes(m: number) {
    const base = parsed ?? new Date();
    emitChange(base, hours, m);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-md border bg-transparent px-3 text-sm shadow-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            error ? "border-destructive" : "border-input",
            parsed ? "text-slate-200" : "text-muted-foreground",
            className
          )}
        >
          <CalendarBlank size={14} className="flex-shrink-0 text-slate-400" />
          <span className="flex-1 text-left truncate">
            {parsed ? formatDisplay(parsed, true) : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-3 bg-slate-900 border-slate-700"
        align="start"
        sideOffset={4}
      >
        <MiniCalendar selectedDate={parsed} onSelectDate={handleSelectDate} />
        <TimeSelector
          hours={hours}
          minutes={minutes}
          onChangeHours={handleChangeHours}
          onChangeMinutes={handleChangeMinutes}
        />
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// DATE PICKER (só data, sem hora)
// ============================================================

interface DatePickerProps {
  value: string;
  onChange: (dateStr: string) => void;
  placeholder?: string;
  error?: boolean;
  className?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Selecione uma data",
  error,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const parsed = useMemo(() => {
    if (!value) return null;
    const d = new Date(value + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  function handleSelectDate(day: Date) {
    const year = day.getFullYear();
    const month = pad2(day.getMonth() + 1);
    const dd = pad2(day.getDate());
    onChange(`${year}-${month}-${dd}`);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center gap-2 rounded-md border bg-transparent px-3 text-sm shadow-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            error ? "border-destructive" : "border-input",
            parsed ? "text-slate-200" : "text-muted-foreground",
            className
          )}
        >
          <CalendarBlank size={14} className="flex-shrink-0 text-slate-400" />
          <span className="flex-1 text-left truncate">
            {parsed ? formatDisplay(parsed, false) : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-3 bg-slate-900 border-slate-700"
        align="start"
        sideOffset={4}
      >
        <MiniCalendar selectedDate={parsed} onSelectDate={handleSelectDate} />
      </PopoverContent>
    </Popover>
  );
}
