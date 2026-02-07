-- ============================================
-- MIGRATION: whatsapp_infrastructure
-- LA Studio Manager - WA-01
-- Data: 2025-02-07
-- ============================================

-- 1. Conexão WhatsApp por usuário
CREATE TABLE whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  phone_jid VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  display_name VARCHAR(100),
  total_messages_sent INTEGER DEFAULT 0,
  total_messages_received INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_whatsapp_connections_user UNIQUE (user_id),
  CONSTRAINT uq_whatsapp_connections_phone UNIQUE (phone_number)
);

CREATE INDEX idx_whatsapp_connections_phone ON whatsapp_connections(phone_number);
CREATE INDEX idx_whatsapp_connections_user ON whatsapp_connections(user_id);
CREATE INDEX idx_whatsapp_connections_active ON whatsapp_connections(is_active) WHERE is_active = TRUE;
COMMENT ON TABLE whatsapp_connections IS 'Mapeia usuários do sistema aos seus números de WhatsApp';

-- 2. Mensagens WhatsApp (histórico completo)
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  phone_number VARCHAR(20) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type VARCHAR(20) NOT NULL DEFAULT 'text' 
    CHECK (message_type IN ('text', 'audio', 'image', 'document', 'location', 'sticker', 'video')),
  content TEXT,
  media_url TEXT,
  processing_status VARCHAR(20) DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'ignored')),
  intent_detected VARCHAR(50),
  intent_confidence DECIMAL(3,2),
  response_text TEXT,
  response_sent_at TIMESTAMPTZ,
  is_group_message BOOLEAN DEFAULT FALSE,
  group_jid VARCHAR(50),
  reply_to_message_id VARCHAR(100),
  uazapi_message_id VARCHAR(100),
  raw_webhook JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_content_or_media CHECK (content IS NOT NULL OR media_url IS NOT NULL)
);

CREATE INDEX idx_whatsapp_messages_user ON whatsapp_messages(user_id);
CREATE INDEX idx_whatsapp_messages_phone ON whatsapp_messages(phone_number);
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(processing_status);
CREATE INDEX idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);
CREATE INDEX idx_whatsapp_messages_intent ON whatsapp_messages(intent_detected) WHERE intent_detected IS NOT NULL;
CREATE INDEX idx_whatsapp_messages_direction ON whatsapp_messages(direction, created_at DESC);
CREATE INDEX idx_whatsapp_messages_group ON whatsapp_messages(group_jid) WHERE is_group_message = TRUE;
COMMENT ON TABLE whatsapp_messages IS 'Histórico completo de mensagens WhatsApp (inbound e outbound)';

-- 3. Contexto de conversa
CREATE TABLE whatsapp_conversation_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  context_type VARCHAR(30) NOT NULL DEFAULT 'general',
  context_data JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_whatsapp_context_user_type UNIQUE (user_id, context_type)
);

CREATE INDEX idx_whatsapp_context_user ON whatsapp_conversation_context(user_id);
CREATE INDEX idx_whatsapp_context_active ON whatsapp_conversation_context(is_active) WHERE is_active = TRUE;
COMMENT ON TABLE whatsapp_conversation_context IS 'Estado de conversa para fluxos multi-step';

-- 4. Configurações de notificação por usuário
CREATE TABLE whatsapp_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  calendar_reminders_enabled BOOLEAN DEFAULT TRUE,
  calendar_reminder_days INTEGER[] DEFAULT '{3,1}',
  calendar_reminder_time TIME DEFAULT '09:00',
  daily_summary_enabled BOOLEAN DEFAULT FALSE,
  daily_summary_time TIME DEFAULT '08:00',
  weekly_summary_enabled BOOLEAN DEFAULT TRUE,
  weekly_summary_day INTEGER DEFAULT 1,
  weekly_summary_time TIME DEFAULT '09:00',
  monthly_summary_enabled BOOLEAN DEFAULT TRUE,
  monthly_summary_day INTEGER DEFAULT 1,
  monthly_summary_time TIME DEFAULT '10:00',
  urgent_alerts_enabled BOOLEAN DEFAULT TRUE,
  deadline_alerts_enabled BOOLEAN DEFAULT TRUE,
  assignment_alerts_enabled BOOLEAN DEFAULT TRUE,
  group_reports_enabled BOOLEAN DEFAULT TRUE,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '07:00',
  timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_whatsapp_notif_user UNIQUE (user_id)
);
COMMENT ON TABLE whatsapp_notification_settings IS 'Preferências de notificação WhatsApp por usuário';

-- 5. Fila de mensagens agendadas
CREATE TABLE whatsapp_scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('user', 'group')),
  target_user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  target_phone VARCHAR(20),
  target_group_jid VARCHAR(50),
  message_type VARCHAR(20) DEFAULT 'text',
  content TEXT NOT NULL,
  media_url TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  source VARCHAR(30) NOT NULL,
  source_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_target CHECK (
    (target_type = 'user' AND target_user_id IS NOT NULL) OR
    (target_type = 'group' AND target_group_jid IS NOT NULL)
  )
);

CREATE INDEX idx_whatsapp_scheduled_pending ON whatsapp_scheduled_messages(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_whatsapp_scheduled_status ON whatsapp_scheduled_messages(status);
CREATE INDEX idx_whatsapp_scheduled_source ON whatsapp_scheduled_messages(source, source_id);
COMMENT ON TABLE whatsapp_scheduled_messages IS 'Fila de mensagens agendadas (lembretes, relatórios)';

-- 6. Grupos WhatsApp
CREATE TABLE whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_jid VARCHAR(50) NOT NULL UNIQUE,
  group_name VARCHAR(200),
  group_type VARCHAR(20) DEFAULT 'team' CHECK (group_type IN ('team', 'brainstorm', 'reports')),
  is_active BOOLEAN DEFAULT TRUE,
  receive_daily_reports BOOLEAN DEFAULT FALSE,
  receive_weekly_reports BOOLEAN DEFAULT TRUE,
  receive_monthly_reports BOOLEAN DEFAULT TRUE,
  receive_urgent_alerts BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE whatsapp_groups IS 'Grupos de WhatsApp registrados no sistema';

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversation_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_connections_select" ON whatsapp_connections FOR SELECT USING (true);
CREATE POLICY "whatsapp_connections_insert" ON whatsapp_connections FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "whatsapp_connections_update" ON whatsapp_connections FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "whatsapp_connections_delete" ON whatsapp_connections FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "whatsapp_messages_select" ON whatsapp_messages FOR SELECT USING (true);
CREATE POLICY "whatsapp_messages_insert" ON whatsapp_messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "whatsapp_messages_update" ON whatsapp_messages FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "whatsapp_context_select" ON whatsapp_conversation_context FOR SELECT USING (true);
CREATE POLICY "whatsapp_context_insert" ON whatsapp_conversation_context FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "whatsapp_context_update" ON whatsapp_conversation_context FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "whatsapp_context_delete" ON whatsapp_conversation_context FOR DELETE USING (auth.uid() IS NOT NULL);

CREATE POLICY "whatsapp_notif_select" ON whatsapp_notification_settings FOR SELECT USING (true);
CREATE POLICY "whatsapp_notif_insert" ON whatsapp_notification_settings FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "whatsapp_notif_update" ON whatsapp_notification_settings FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "whatsapp_scheduled_select" ON whatsapp_scheduled_messages FOR SELECT USING (true);
CREATE POLICY "whatsapp_scheduled_insert" ON whatsapp_scheduled_messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "whatsapp_scheduled_update" ON whatsapp_scheduled_messages FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "whatsapp_groups_select" ON whatsapp_groups FOR SELECT USING (true);
CREATE POLICY "whatsapp_groups_insert" ON whatsapp_groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "whatsapp_groups_update" ON whatsapp_groups FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============================================
-- SEED DATA
-- ============================================

INSERT INTO whatsapp_connections (user_id, phone_number, phone_jid, display_name)
SELECT id, '5521981278047', '5521981278047@s.whatsapp.net', full_name
FROM user_profiles WHERE full_name ILIKE '%yuri%' LIMIT 1;

INSERT INTO whatsapp_notification_settings (user_id)
SELECT id FROM user_profiles WHERE full_name ILIKE '%yuri%' LIMIT 1;

UPDATE user_profiles SET phone = '+5521981278047' WHERE full_name ILIKE '%yuri%';

-- ============================================
-- FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION get_user_by_phone(p_phone VARCHAR)
RETURNS TABLE (
  profile_id UUID,
  auth_user_id UUID,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT,
  phone_number VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT up.id, up.user_id, up.full_name, up.avatar_url, up.role, wc.phone_number
  FROM user_profiles up
  JOIN whatsapp_connections wc ON wc.user_id = up.id
  WHERE wc.phone_number = p_phone AND wc.is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_whatsapp_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.direction = 'inbound' THEN
    UPDATE whatsapp_connections 
    SET total_messages_received = total_messages_received + 1, last_message_at = NOW(), updated_at = NOW()
    WHERE phone_number = NEW.phone_number;
  ELSIF NEW.direction = 'outbound' THEN
    UPDATE whatsapp_connections 
    SET total_messages_sent = total_messages_sent + 1, last_message_at = NOW(), updated_at = NOW()
    WHERE phone_number = NEW.phone_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_whatsapp_stats
  AFTER INSERT ON whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION update_whatsapp_stats();

CREATE OR REPLACE FUNCTION cleanup_expired_contexts()
RETURNS INTEGER AS $$
DECLARE deleted_count INTEGER;
BEGIN
  UPDATE whatsapp_conversation_context SET is_active = FALSE
  WHERE expires_at < NOW() AND is_active = TRUE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
