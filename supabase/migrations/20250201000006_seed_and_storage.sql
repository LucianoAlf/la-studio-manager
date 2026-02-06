-- ============================================
-- LA STUDIO MANAGER — Migration 006
-- Seed Data + Storage Buckets
-- ============================================

-- ===== KANBAN COLUMNS SEED =====
INSERT INTO kanban_columns (name, slug, color, position) VALUES
  ('Brainstorming/Ideias', 'brainstorming', '#A78BFA', 1),
  ('Planejamento', 'planning', '#06B6D4', 2),
  ('A Fazer', 'todo', '#1AA8BF', 3),
  ('Captando', 'capturing', '#F59E0B', 4),
  ('Editando', 'editing', '#F97316', 5),
  ('Aguardando Aprovação', 'awaiting_approval', '#22C55E', 6),
  ('Aprovado/Agendado', 'approved', '#38C8DB', 7),
  ('Publicado', 'published', '#1AA8BF', 8),
  ('Arquivo', 'archived', '#5A7A82', 9);

-- ===== PLATFORMS SEED =====
INSERT INTO platforms (name, display_name) VALUES
  ('instagram', 'Instagram'),
  ('youtube', 'YouTube'),
  ('tiktok', 'TikTok'),
  ('facebook', 'Facebook');

-- ===== AI AGENTS SEED =====
INSERT INTO ai_agents (name, display_name, role, description, llm_provider, llm_model) VALUES
  ('Maestro', 'Maestro', 'orchestrator', 'Orquestrador geral — coordena agentes e workflows', 'openai', 'gpt-4'),
  ('Luna', 'Luna', 'ideation', 'Ideação e brainstorm criativo', 'openai', 'gpt-4'),
  ('Atlas', 'Atlas', 'planning', 'Planejamento e calendário editorial', 'openai', 'gpt-3.5-turbo'),
  ('Nina', 'Nina', 'design', 'Design visual e geração de imagens', 'google', 'gemini-pro'),
  ('Theo', 'Theo', 'copywriting', 'Copywriting e legendas para redes sociais', 'openai', 'gpt-4'),
  ('Ada', 'Ada', 'analytics', 'Analytics e relatórios de performance', 'google', 'gemini-pro');

-- ===== STORAGE BUCKETS =====
-- Assets bucket (images, videos, documents)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assets',
  'assets',
  false,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'application/pdf']
);

-- Avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- Storage RLS: Assets
CREATE POLICY "Authenticated users can upload assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assets'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Authenticated users can view assets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assets'
    AND auth.role() = 'authenticated'
  );

-- Storage RLS: Avatars (public read, auth write)
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
  );
