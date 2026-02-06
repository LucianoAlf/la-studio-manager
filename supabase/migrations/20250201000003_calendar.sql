-- ============================================
-- LA STUDIO MANAGER — Migration 003
-- Calendar: Items, Connections, Comments
-- ============================================

-- ===== CALENDAR ITEMS =====
-- Note: kanban_card_id FK added here; post_id FK added in migration 004 via ALTER
CREATE TABLE calendar_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type calendar_item_type NOT NULL,
  status calendar_item_status DEFAULT 'pending' NOT NULL,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone,
  all_day boolean DEFAULT false,
  is_recurring boolean DEFAULT false,
  recurrence_rule text,
  recurrence_parent_id uuid REFERENCES calendar_items(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  responsible_user_id uuid REFERENCES auth.users(id),
  content_type text,
  platforms text[] DEFAULT ARRAY[]::text[],
  color text,
  notifications_sent jsonb DEFAULT '[]'::jsonb,
  kanban_card_id uuid REFERENCES kanban_cards(id) ON DELETE SET NULL,
  location text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);

CREATE INDEX idx_calendar_items_start_time ON calendar_items(start_time);
CREATE INDEX idx_calendar_items_type ON calendar_items(type);
CREATE INDEX idx_calendar_items_status ON calendar_items(status);
CREATE INDEX idx_calendar_items_responsible ON calendar_items(responsible_user_id);
CREATE INDEX idx_calendar_items_created_by ON calendar_items(created_by);
CREATE INDEX idx_calendar_items_kanban ON calendar_items(kanban_card_id);
CREATE INDEX idx_calendar_items_active ON calendar_items(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_calendar_items_platforms ON calendar_items USING GIN(platforms);
CREATE INDEX idx_calendar_items_metadata ON calendar_items USING GIN(metadata);

ALTER TABLE calendar_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all calendar items" ON calendar_items
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Users can insert calendar items" ON calendar_items
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their items or items assigned to them" ON calendar_items
  FOR UPDATE USING (
    created_by = auth.uid() OR
    responsible_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'developer')
    )
  );

CREATE TRIGGER update_calendar_items_updated_at
  BEFORE UPDATE ON calendar_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== CALENDAR ITEM CONNECTIONS =====
CREATE TABLE calendar_item_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_item_id uuid REFERENCES calendar_items(id) ON DELETE CASCADE NOT NULL,
  target_item_id uuid REFERENCES calendar_items(id) ON DELETE CASCADE NOT NULL,
  connection_type text,
  notes text,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(source_item_id, target_item_id)
);

CREATE INDEX idx_calendar_connections_source ON calendar_item_connections(source_item_id);
CREATE INDEX idx_calendar_connections_target ON calendar_item_connections(target_item_id);

ALTER TABLE calendar_item_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view connections" ON calendar_item_connections
  FOR SELECT USING (true);

CREATE POLICY "Users can manage connections" ON calendar_item_connections
  FOR ALL USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'editor', 'developer')
    )
  );

-- ===== CALENDAR ITEM COMMENTS =====
CREATE TABLE calendar_item_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_item_id uuid REFERENCES calendar_items(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  comment_text text NOT NULL,
  parent_comment_id uuid REFERENCES calendar_item_comments(id) ON DELETE CASCADE,
  is_edited boolean DEFAULT false,
  edited_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);

CREATE INDEX idx_calendar_comments_item ON calendar_item_comments(calendar_item_id);
CREATE INDEX idx_calendar_comments_user ON calendar_item_comments(user_id);
CREATE INDEX idx_calendar_comments_parent ON calendar_item_comments(parent_comment_id);

ALTER TABLE calendar_item_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments" ON calendar_item_comments
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Users can insert comments" ON calendar_item_comments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own comments" ON calendar_item_comments
  FOR UPDATE USING (user_id = auth.uid());
