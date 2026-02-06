-- ============================================
-- LA STUDIO MANAGER — Migration 001
-- User Profiles + Enums
-- ============================================

-- Updated_at trigger function (used by all tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ===== ENUMS =====
CREATE TYPE calendar_item_type AS ENUM (
  'event', 'delivery', 'creation', 'task', 'meeting'
);

CREATE TYPE calendar_item_status AS ENUM (
  'pending', 'in_progress', 'completed', 'cancelled'
);

CREATE TYPE card_type AS ENUM ('single_post', 'campaign');

CREATE TYPE post_status AS ENUM (
  'draft', 'awaiting_approval', 'approved', 'scheduled',
  'published', 'failed', 'rejected'
);

CREATE TYPE post_type AS ENUM (
  'image', 'video', 'carousel', 'story', 'reels', 'short', 'newsletter'
);

CREATE TYPE asset_type AS ENUM (
  'image', 'video', 'audio', 'document', 'template'
);

CREATE TYPE asset_source AS ENUM (
  'upload', 'ai_generated', 'emusys', 'canva', 'event'
);

CREATE TYPE approval_status AS ENUM (
  'pending', 'approved', 'rejected', 'needs_revision'
);

CREATE TYPE campaign_type AS ENUM (
  'organic', 'paid_social', 'paid_search', 'mixed'
);

CREATE TYPE campaign_status AS ENUM (
  'draft', 'active', 'paused', 'completed', 'cancelled'
);

CREATE TYPE execution_status AS ENUM (
  'queued', 'running', 'completed', 'failed', 'cancelled'
);

CREATE TYPE log_level AS ENUM (
  'debug', 'info', 'warning', 'error', 'critical'
);

CREATE TYPE notification_type AS ENUM (
  'whatsapp', 'email', 'in_app', 'push'
);

CREATE TYPE notification_priority AS ENUM (
  'low', 'normal', 'high', 'urgent'
);

-- ===== USER PROFILES =====
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name text NOT NULL,
  display_name text,
  avatar_url text,
  phone text,
  role text NOT NULL CHECK (role IN ('admin', 'editor', 'viewer', 'developer')),
  timezone text DEFAULT 'America/Sao_Paulo',
  language text DEFAULT 'pt-BR',
  notification_preferences jsonb DEFAULT '{"email": true, "whatsapp": true, "push": true}'::jsonb,
  is_active boolean DEFAULT true,
  last_active_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_active ON user_profiles(is_active) WHERE deleted_at IS NULL;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view active profiles" ON user_profiles
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Admins can update profiles" ON user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.user_id = auth.uid()
      AND up.role IN ('admin', 'developer')
    )
  );

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
