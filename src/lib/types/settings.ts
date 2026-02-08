// ============================================================
// TIPOS — Configurações (WA-07)
// ============================================================

// === NOTIFICATION SETTINGS ===
export interface UserNotificationSettings {
  id: string;
  user_id: string;

  // Lembretes de calendário
  calendar_reminders_enabled: boolean;
  calendar_reminder_days: number[];
  calendar_reminder_time: string; // "HH:MM"

  // Resumo diário
  daily_summary_enabled: boolean;
  daily_summary_time: string;

  // Resumo semanal
  weekly_summary_enabled: boolean;
  weekly_summary_day: number; // 0=dom, 1=seg...
  weekly_summary_time: string;

  // Resumo mensal
  monthly_summary_enabled: boolean;
  monthly_summary_day: number;
  monthly_summary_time: string;

  // Alertas
  urgent_alerts_enabled: boolean;
  deadline_alerts_enabled: boolean;
  assignment_alerts_enabled: boolean;
  group_reports_enabled: boolean;
  reminders_enabled: boolean;

  // Horário de silêncio
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;

  // Timezone
  timezone: string;

  created_at: string;
  updated_at: string;
}

// === MIKE CONFIG (singleton) ===
export interface MikeConfig {
  id: string;

  // Grupos habilitados: { "JID": "Nome legível" }
  enabled_groups: Record<string, string>;

  // Trigger names
  agent_trigger_names: string[];

  // Sessão de grupo
  group_session_timeout_minutes: number;

  // Memória
  group_memory_hours_back: number;
  group_memory_max_messages: number;
  group_memory_retention_days: number;

  // Personalidade
  personality_tone: string;
  personality_emoji_level: string;

  // Modelos IA
  default_ai_model: string;
  fallback_ai_model: string;
  max_output_tokens: number;

  // Bot
  bot_phone_number: string;

  created_at: string;
  updated_at: string;
}

// === USER PROFILE ESTENDIDO (com novos campos WA-07) ===
export interface UserProfileExtended {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  phone: string | null;
  is_active: boolean;
  is_admin: boolean;
  whatsapp_jid: string | null;
  bio: string | null;
  specializations: string[];
  timezone: string | null;
  language: string | null;
  created_at: string;
  updated_at: string;
}

// === DEFAULTS para criação ===
export const DEFAULT_NOTIFICATION_SETTINGS: Omit<UserNotificationSettings, "id" | "user_id" | "created_at" | "updated_at"> = {
  calendar_reminders_enabled: true,
  calendar_reminder_days: [3, 1],
  calendar_reminder_time: "09:00",
  daily_summary_enabled: false,
  daily_summary_time: "08:00",
  weekly_summary_enabled: true,
  weekly_summary_day: 1,
  weekly_summary_time: "09:00",
  monthly_summary_enabled: true,
  monthly_summary_day: 1,
  monthly_summary_time: "10:00",
  urgent_alerts_enabled: true,
  deadline_alerts_enabled: true,
  assignment_alerts_enabled: true,
  group_reports_enabled: true,
  reminders_enabled: true,
  quiet_hours_enabled: true,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  timezone: "America/Sao_Paulo",
};
