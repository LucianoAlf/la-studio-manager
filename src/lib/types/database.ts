// ============================================================
// TIPOS DO DOMÍNIO — LA Studio Manager
// Tipos derivados do schema Supabase para uso na aplicação
// ============================================================

// === ENUMS ===
export type CalendarItemType = "event" | "delivery" | "creation" | "task" | "meeting" | "reminder";
export type CalendarItemStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type CardType = "single_post" | "campaign";
export type CardPriority = "low" | "medium" | "high" | "urgent";
export type UserRole = "admin" | "usuario";

// === USER PROFILE ===
export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

// === CALENDAR ===
export interface CalendarItem {
  id: string;
  title: string;
  description: string | null;
  type: CalendarItemType;
  status: CalendarItemStatus;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  created_by: string;
  responsible_user_id: string | null;
  content_type: string | null;
  platforms: string[];
  color: string | null;
  location: string | null;
  kanban_card_id: string | null;
  post_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joined
  responsible?: UserProfile | null;
  creator?: UserProfile | null;
}

export interface CalendarItemConnection {
  id: string;
  source_item_id: string;
  target_item_id: string;
  connection_type: string | null;
  notes: string | null;
  created_at: string;
  target_item?: Pick<CalendarItem, "id" | "title" | "type" | "start_time" | "status">;
  source_item?: Pick<CalendarItem, "id" | "title" | "type" | "start_time" | "status">;
}

export interface CalendarItemComment {
  id: string;
  calendar_item_id: string;
  user_id: string;
  comment_text: string;
  created_at: string;
  user?: Pick<UserProfile, "id" | "user_id" | "full_name" | "display_name" | "avatar_url">;
}

// === KANBAN ===
export interface KanbanColumn {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string | null;
  emoji: string | null;
  position: number;
  card_limit: number | null;
  created_at: string;
  updated_at: string;
}

export interface KanbanCard {
  id: string;
  title: string;
  description: string | null;
  card_type: CardType;
  column_id: string;
  position_in_column: number;
  created_by: string;
  responsible_user_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  priority: CardPriority | null;
  platforms: string[];
  content_type: string | null;
  tags: string[];
  is_blocked: boolean;
  blocked_reason: string | null;
  moved_to_column_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joined
  responsible?: UserProfile | null;
  creator?: UserProfile | null;
  column?: KanbanColumn;
}
