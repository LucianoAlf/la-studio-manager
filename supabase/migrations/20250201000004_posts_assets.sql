-- ============================================
-- LA STUDIO MANAGER — Migration 004
-- Posts, Platforms, Post relations, Assets
-- ============================================

-- ===== PLATFORMS =====
CREATE TABLE platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  icon_url text,
  is_active boolean DEFAULT true,
  api_config jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== POSTS =====
CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  caption text,
  post_type post_type NOT NULL,
  status post_status DEFAULT 'draft' NOT NULL,
  created_by_ai boolean DEFAULT false,
  ai_agent_name text,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  kanban_card_id uuid REFERENCES kanban_cards(id) ON DELETE SET NULL,
  calendar_item_id uuid REFERENCES calendar_items(id) ON DELETE SET NULL,
  scheduled_for timestamp with time zone,
  published_at timestamp with time zone,
  brand text CHECK (brand IN ('la_music_school', 'la_music_kids')) NOT NULL,
  hashtags text[] DEFAULT ARRAY[]::text[],
  location_name text,
  location_lat decimal,
  location_lng decimal,
  platform_urls jsonb DEFAULT '{}'::jsonb,
  platform_ids jsonb DEFAULT '{}'::jsonb,
  total_views integer DEFAULT 0,
  total_likes integer DEFAULT 0,
  total_comments integer DEFAULT 0,
  total_shares integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);

CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_scheduled ON posts(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_posts_published ON posts(published_at) WHERE published_at IS NOT NULL;
CREATE INDEX idx_posts_brand ON posts(brand);
CREATE INDEX idx_posts_kanban ON posts(kanban_card_id);
CREATE INDEX idx_posts_calendar ON posts(calendar_item_id);
CREATE INDEX idx_posts_hashtags ON posts USING GIN(hashtags);
CREATE INDEX idx_posts_active ON posts(deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all posts" ON posts
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Users can insert posts" ON posts
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update posts" ON posts
  FOR UPDATE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'developer')
    )
  );

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add post_id FK to calendar_items (deferred to avoid circular dependency)
ALTER TABLE calendar_items
  ADD COLUMN post_id uuid REFERENCES posts(id) ON DELETE SET NULL;

CREATE INDEX idx_calendar_items_post ON calendar_items(post_id);

-- ===== POST VERSIONS =====
CREATE TABLE post_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  version_number integer NOT NULL,
  title text,
  caption text,
  hashtags text[],
  metadata jsonb,
  changed_by uuid REFERENCES auth.users(id) NOT NULL,
  change_notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_post_versions_post ON post_versions(post_id);
CREATE INDEX idx_post_versions_created ON post_versions(created_at);

-- ===== POST PLATFORMS =====
CREATE TABLE post_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  platform_id uuid REFERENCES platforms(id) ON DELETE CASCADE NOT NULL,
  status text CHECK (status IN ('pending', 'scheduled', 'published', 'failed')) DEFAULT 'pending',
  published_url text,
  external_id text,
  published_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(post_id, platform_id)
);

CREATE INDEX idx_post_platforms_post ON post_platforms(post_id);
CREATE INDEX idx_post_platforms_platform ON post_platforms(platform_id);
CREATE INDEX idx_post_platforms_status ON post_platforms(status);

ALTER TABLE post_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view post platforms" ON post_platforms
  FOR SELECT USING (true);

-- ===== ASSETS =====
CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  mime_type text,
  asset_type asset_type NOT NULL,
  source asset_source NOT NULL,
  width integer,
  height integer,
  duration integer,
  storage_provider text CHECK (storage_provider IN ('supabase', 'google_drive')) DEFAULT 'supabase',
  storage_path text,
  auto_tags text[] DEFAULT ARRAY[]::text[],
  ai_description text,
  folder_path text,
  brand text CHECK (brand IN ('la_music_school', 'la_music_kids', 'both')),
  event_name text,
  event_date date,
  person_name text,
  person_id text,
  is_approved boolean DEFAULT false,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamp with time zone,
  usage_rights text,
  uploaded_by uuid REFERENCES auth.users(id),
  times_used integer DEFAULT 0,
  last_used_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);

CREATE INDEX idx_assets_type ON assets(asset_type);
CREATE INDEX idx_assets_source ON assets(source);
CREATE INDEX idx_assets_brand ON assets(brand);
CREATE INDEX idx_assets_tags ON assets USING GIN(auto_tags);
CREATE INDEX idx_assets_folder ON assets(folder_path);
CREATE INDEX idx_assets_uploaded_by ON assets(uploaded_by);
CREATE INDEX idx_assets_approved ON assets(is_approved);
CREATE INDEX idx_assets_created ON assets(created_at);
CREATE INDEX idx_assets_active ON assets(deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approved assets" ON assets
  FOR SELECT USING (deleted_at IS NULL AND (is_approved = true OR uploaded_by = auth.uid()));

CREATE POLICY "Users can upload assets" ON assets
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can update own assets" ON assets
  FOR UPDATE USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'developer')
    )
  );

CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== POST ASSETS =====
CREATE TABLE post_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  asset_id uuid REFERENCES assets(id) ON DELETE CASCADE NOT NULL,
  position integer,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(post_id, asset_id)
);

CREATE INDEX idx_post_assets_post ON post_assets(post_id);
CREATE INDEX idx_post_assets_asset ON post_assets(asset_id);
CREATE INDEX idx_post_assets_position ON post_assets(post_id, position);

-- ===== ASSET TAGS =====
CREATE TABLE asset_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  color text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_asset_tags_slug ON asset_tags(slug);

-- ===== ASSET TAG RELATIONS =====
CREATE TABLE asset_tag_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES assets(id) ON DELETE CASCADE NOT NULL,
  tag_id uuid REFERENCES asset_tags(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(asset_id, tag_id)
);

CREATE INDEX idx_asset_tag_relations_asset ON asset_tag_relations(asset_id);
CREATE INDEX idx_asset_tag_relations_tag ON asset_tag_relations(tag_id);

-- ===== TEMPLATES =====
CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  template_type text,
  canva_template_id text UNIQUE,
  canva_url text,
  thumbnail_url text,
  editable_fields jsonb DEFAULT '{}'::jsonb,
  brand text CHECK (brand IN ('la_music_school', 'la_music_kids', 'both')),
  times_used integer DEFAULT 0,
  last_used_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_templates_type ON templates(template_type);
CREATE INDEX idx_templates_brand ON templates(brand);
CREATE INDEX idx_templates_active ON templates(is_active);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view active templates" ON templates
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage templates" ON templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'developer')
    )
  );
