"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, SpinnerGap, FloppyDisk } from "@phosphor-icons/react";
import type { UserNotificationSettings } from "@/lib/types/settings";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/lib/types/settings";
import { upsertNotificationSettings } from "@/lib/queries/settings";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select";
import { Clock } from "@phosphor-icons/react";

interface NotificationsSectionProps {
  authUserId: string;
  settings: UserNotificationSettings | null;
  onSettingsUpdated: (settings: UserNotificationSettings) => void;
}

const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

const REMINDER_DAY_OPTIONS = [
  { value: 0, label: "No dia", highlight: true },
  { value: 1, label: "1 dia antes" },
  { value: 2, label: "2 dias antes" },
  { value: 3, label: "3 dias antes" },
  { value: 5, label: "5 dias antes" },
  { value: 7, label: "7 dias antes" },
];

const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "São Paulo (UTC-3)" },
  { value: "America/Manaus", label: "Manaus (UTC-4)" },
  { value: "America/Cuiaba", label: "Cuiabá (UTC-4)" },
  { value: "America/Belem", label: "Belém (UTC-3)" },
  { value: "America/Fortaleza", label: "Fortaleza (UTC-3)" },
  { value: "America/Recife", label: "Recife (UTC-3)" },
  { value: "America/Bahia", label: "Bahia (UTC-3)" },
  { value: "America/Rio_Branco", label: "Rio Branco (UTC-5)" },
  { value: "America/Noronha", label: "Fernando de Noronha (UTC-2)" },
  { value: "America/New_York", label: "Nova York (UTC-5)" },
  { value: "Europe/Lisbon", label: "Lisboa (UTC+0)" },
];

export function NotificationsSection({
  authUserId,
  settings,
  onSettingsUpdated,
}: NotificationsSectionProps) {
  const [saving, setSaving] = useState(false);
  const initial = settings || DEFAULT_NOTIFICATION_SETTINGS;

  const [form, setForm] = useState({
    calendar_reminders_enabled: initial.calendar_reminders_enabled,
    calendar_reminder_days: initial.calendar_reminder_days,
    calendar_reminder_time: initial.calendar_reminder_time,
    daily_summary_enabled: initial.daily_summary_enabled,
    daily_summary_time: initial.daily_summary_time,
    weekly_summary_enabled: initial.weekly_summary_enabled,
    weekly_summary_day: initial.weekly_summary_day,
    weekly_summary_time: initial.weekly_summary_time,
    monthly_summary_enabled: initial.monthly_summary_enabled,
    monthly_summary_day: initial.monthly_summary_day,
    monthly_summary_time: initial.monthly_summary_time,
    urgent_alerts_enabled: initial.urgent_alerts_enabled,
    deadline_alerts_enabled: initial.deadline_alerts_enabled,
    assignment_alerts_enabled: initial.assignment_alerts_enabled,
    group_reports_enabled: initial.group_reports_enabled,
    reminders_enabled: initial.reminders_enabled,
    quiet_hours_enabled: initial.quiet_hours_enabled,
    quiet_hours_start: initial.quiet_hours_start,
    quiet_hours_end: initial.quiet_hours_end,
    timezone: initial.timezone,
  });

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleReminderDay(day: number) {
    setForm((prev) => ({
      ...prev,
      calendar_reminder_days: prev.calendar_reminder_days.includes(day)
        ? prev.calendar_reminder_days.filter((d) => d !== day)
        : [...prev.calendar_reminder_days, day].sort((a, b) => b - a),
    }));
  }

  async function handleSave() {
    try {
      setSaving(true);
      const updated = await upsertNotificationSettings(authUserId, form);
      onSettingsUpdated(updated);
      toast.success("Preferências de notificação salvas!");
    } catch (err) {
      toast.error("Erro ao salvar: " + (err instanceof Error ? err.message : "Erro desconhecido"));
    } finally {
      setSaving(false);
    }
  }

  const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const MINUTES = ["00", "15", "30", "45"];

  function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [h, m] = value.split(":");
    return (
      <div className="flex items-center gap-1">
        <Select value={h || "09"} onValueChange={(v) => onChange(`${v}:${m || "00"}`)}>
          <SelectTrigger className="w-[68px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-48">
            {HOURS.map((hr) => (
              <SelectItem key={hr} value={hr}>{hr}h</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-slate-600 text-xs">:</span>
        <Select value={m || "00"} onValueChange={(v) => onChange(`${h || "09"}:${v}`)}>
          <SelectTrigger className="w-[68px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MINUTES.map((min) => (
              <SelectItem key={min} value={min}>{min}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <Card variant="default" className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-amber-500/10">
          <Bell size={20} weight="duotone" className="text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Notificações WhatsApp</h2>
          <p className="text-xs text-slate-500">Configure quando e como receber alertas</p>
        </div>
      </div>

      {/* === LEMBRETES DE CALENDÁRIO === */}
      <div className="space-y-3 pb-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-300">Lembretes de Calendário</h3>
        <Switch
          checked={form.calendar_reminders_enabled}
          onCheckedChange={(v) => updateField("calendar_reminders_enabled", v)}
          label="Lembretes de eventos"
          description="Receba avisos antes de eventos e entregas"
        />
        {form.calendar_reminders_enabled && (
          <div className="ml-0 mt-2 space-y-3 pl-4 border-l-2 border-slate-800">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-400">Avisar com antecedência de</label>
              <div className="flex flex-wrap gap-2">
                {REMINDER_DAY_OPTIONS.map((opt) => {
                  const isActive = form.calendar_reminder_days.includes(opt.value);
                  const isHighlight = "highlight" in opt && opt.highlight;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleReminderDay(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isActive && isHighlight
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 ring-1 ring-amber-500/20"
                          : isActive
                          ? "bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30"
                          : "bg-slate-800/60 text-slate-400 border border-slate-700 hover:border-slate-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-slate-400">Horário</label>
              <TimeSelect
                value={form.calendar_reminder_time}
                onChange={(v) => updateField("calendar_reminder_time", v)}
              />
            </div>
          </div>
        )}
      </div>

      {/* === RESUMOS === */}
      <div className="space-y-3 pb-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-300">Resumos Automáticos</h3>

        {/* Diário */}
        <Switch
          checked={form.daily_summary_enabled}
          onCheckedChange={(v) => updateField("daily_summary_enabled", v)}
          label="Resumo diário"
          description="Agenda do dia, cards urgentes e insights"
        />
        {form.daily_summary_enabled && (
          <div className="flex items-center gap-3 pl-4 border-l-2 border-slate-800">
            <label className="text-xs font-medium text-slate-400">Horário</label>
            <TimeSelect
              value={form.daily_summary_time}
              onChange={(v) => updateField("daily_summary_time", v)}
            />
          </div>
        )}

        {/* Semanal */}
        <Switch
          checked={form.weekly_summary_enabled}
          onCheckedChange={(v) => updateField("weekly_summary_enabled", v)}
          label="Resumo semanal"
          description="Visão geral da semana com métricas"
        />
        {form.weekly_summary_enabled && (
          <div className="flex items-center gap-3 pl-4 border-l-2 border-slate-800 flex-wrap">
            <label className="text-xs font-medium text-slate-400">Dia</label>
            <Select
              value={String(form.weekly_summary_day)}
              onValueChange={(v) => updateField("weekly_summary_day", Number(v))}
            >
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="text-xs font-medium text-slate-400">às</label>
            <TimeSelect
              value={form.weekly_summary_time}
              onChange={(v) => updateField("weekly_summary_time", v)}
            />
          </div>
        )}

        {/* Mensal */}
        <Switch
          checked={form.monthly_summary_enabled}
          onCheckedChange={(v) => updateField("monthly_summary_enabled", v)}
          label="Resumo mensal"
          description="Relatório completo do mês"
        />
        {form.monthly_summary_enabled && (
          <div className="flex items-center gap-3 pl-4 border-l-2 border-slate-800 flex-wrap">
            <label className="text-xs font-medium text-slate-400">Dia do mês</label>
            <Select
              value={String(form.monthly_summary_day)}
              onValueChange={(v) => updateField("monthly_summary_day", Number(v))}
            >
              <SelectTrigger className="w-20 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="text-xs font-medium text-slate-400">às</label>
            <TimeSelect
              value={form.monthly_summary_time}
              onChange={(v) => updateField("monthly_summary_time", v)}
            />
          </div>
        )}
      </div>

      {/* === ALERTAS === */}
      <div className="space-y-3 pb-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-300">Alertas em Tempo Real</h3>
        <Switch
          checked={form.urgent_alerts_enabled}
          onCheckedChange={(v) => updateField("urgent_alerts_enabled", v)}
          label="Cards urgentes"
          description="Quando um card é marcado como urgente"
        />
        <Switch
          checked={form.deadline_alerts_enabled}
          onCheckedChange={(v) => updateField("deadline_alerts_enabled", v)}
          label="Prazos vencendo"
          description="Quando um card está próximo do prazo"
        />
        <Switch
          checked={form.assignment_alerts_enabled}
          onCheckedChange={(v) => updateField("assignment_alerts_enabled", v)}
          label="Atribuições"
          description="Quando um card é atribuído a você"
        />
        <Switch
          checked={form.group_reports_enabled}
          onCheckedChange={(v) => updateField("group_reports_enabled", v)}
          label="Relatórios no grupo"
          description="Receber relatórios nos grupos do WhatsApp"
        />
      </div>

      {/* === HORÁRIO DE SILÊNCIO === */}
      <div className="space-y-3 pb-4 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-slate-300">Horário de Silêncio</h3>
        <Switch
          checked={form.quiet_hours_enabled}
          onCheckedChange={(v) => updateField("quiet_hours_enabled", v)}
          label="Não perturbe"
          description="Pausar notificações em horários específicos"
        />
        {form.quiet_hours_enabled && (
          <div className="flex items-center gap-3 pl-4 border-l-2 border-slate-800 flex-wrap">
            <label className="text-xs font-medium text-slate-400">Das</label>
            <TimeSelect
              value={form.quiet_hours_start}
              onChange={(v) => updateField("quiet_hours_start", v)}
            />
            <label className="text-xs font-medium text-slate-400">até</label>
            <TimeSelect
              value={form.quiet_hours_end}
              onChange={(v) => updateField("quiet_hours_end", v)}
            />
          </div>
        )}
      </div>

      {/* === FUSO HORÁRIO === */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Fuso Horário</h3>
        <div className="flex items-center gap-3">
          <Clock size={16} className="text-slate-400" />
          <Select
            value={form.timezone}
            onValueChange={(v) => updateField("timezone", v)}
          >
            <SelectTrigger className="w-64 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-48">
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-[11px] text-slate-500">
          Todos os horários de notificação usam este fuso
        </p>
      </div>

      {/* Salvar */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} size="md">
          {saving ? (
            <SpinnerGap size={16} className="animate-spin" />
          ) : (
            <FloppyDisk size={16} weight="duotone" />
          )}
          {saving ? "Salvando..." : "Salvar notificações"}
        </Button>
      </div>
    </Card>
  );
}
