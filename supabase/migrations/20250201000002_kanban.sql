-- ============================================
-- LA STUDIO MANAGER — Migration 002
-- Kanban: Columns, Cards, History, Comments, Checklists, Attachments
-- ============================================

-- ===== KANBAN COLUMNS =====
CREATE TABLE kanban_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  color text,
  position integer NOT NULL,
  card_limit integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_kanban_columns_position ON kanban_columns(position);

-- ===== KANBAN CARDS =====
CREATE TABLE kanban_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  card_type card_type DEFAULT 'single_post' NOT NULL,
  column_id uuid REFERENCES kanban_columns(id) NOT NULL,
  position_in_column integer NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  responsible_user_id uuid REFERENCES auth.users(id),
  due_date timestamp with time zone,
  completed_at timestamp with time zone,
  priority text CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  tags text[] DEFAULT ARRAY[]::text[],
  platforms text[] DEFAULT ARRAY[]::text[],
  content_type text,
  is_blocked boolean DEFAULT false,
  blocked_reason text,
  moved_to_column_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);

CREATE INDEX idx_kanban_cards_column ON kanban_cards(column_id);
CREATE INDEX idx_kanban_cards_responsible ON kanban_cards(responsible_user_id);
CREATE INDEX idx_kanban_cards_due_date ON kanban_cards(due_date);
CREATE INDEX idx_kanban_cards_position ON kanban_cards(column_id, position_in_column);
CREATE INDEX idx_kanban_cards_tags ON kanban_cards USING GIN(tags);
CREATE INDEX idx_kanban_cards_platforms ON kanban_cards USING GIN(platforms);
CREATE INDEX idx_kanban_cards_active ON kanban_cards(deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE kanban_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all cards" ON kanban_cards
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Users can insert cards" ON kanban_cards
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update cards" ON kanban_cards
  FOR UPDATE USING (
    created_by = auth.uid() OR
    responsible_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'developer')
    )
  );

CREATE TRIGGER update_kanban_cards_updated_at
  BEFORE UPDATE ON kanban_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== KANBAN CARD HISTORY =====
CREATE TABLE kanban_card_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES kanban_cards(id) ON DELETE CASCADE NOT NULL,
  from_column_id uuid REFERENCES kanban_columns(id),
  to_column_id uuid REFERENCES kanban_columns(id) NOT NULL,
  moved_by uuid REFERENCES auth.users(id) NOT NULL,
  moved_at timestamp with time zone DEFAULT now() NOT NULL,
  notes text
);

CREATE INDEX idx_kanban_history_card ON kanban_card_history(card_id);
CREATE INDEX idx_kanban_history_moved_at ON kanban_card_history(moved_at);

-- ===== KANBAN CARD COMMENTS =====
CREATE TABLE kanban_card_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES kanban_cards(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  comment_text text NOT NULL,
  parent_comment_id uuid REFERENCES kanban_card_comments(id) ON DELETE CASCADE,
  is_edited boolean DEFAULT false,
  edited_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);

CREATE INDEX idx_kanban_comments_card ON kanban_card_comments(card_id);
CREATE INDEX idx_kanban_comments_user ON kanban_card_comments(user_id);

ALTER TABLE kanban_card_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments" ON kanban_card_comments
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Users can insert comments" ON kanban_card_comments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own comments" ON kanban_card_comments
  FOR UPDATE USING (user_id = auth.uid());

-- ===== KANBAN CARD CHECKLISTS =====
CREATE TABLE kanban_card_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES kanban_cards(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  is_completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  completed_by uuid REFERENCES auth.users(id),
  position integer NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_kanban_checklists_card ON kanban_card_checklists(card_id);
CREATE INDEX idx_kanban_checklists_position ON kanban_card_checklists(card_id, position);

ALTER TABLE kanban_card_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view checklists" ON kanban_card_checklists
  FOR SELECT USING (true);

CREATE POLICY "Users can manage checklists" ON kanban_card_checklists
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM kanban_cards kc
      WHERE kc.id = card_id
      AND (kc.created_by = auth.uid() OR kc.responsible_user_id = auth.uid())
    )
  );

-- ===== KANBAN CARD ATTACHMENTS =====
CREATE TABLE kanban_card_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES kanban_cards(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);

CREATE INDEX idx_kanban_attachments_card ON kanban_card_attachments(card_id);

ALTER TABLE kanban_card_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments" ON kanban_card_attachments
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Users can upload attachments" ON kanban_card_attachments
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());
