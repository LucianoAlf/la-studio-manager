-- ============================================
-- LA STUDIO MANAGER — Migration 005
-- Approvals, Metrics, Campaigns, AI Agents, Notifications
-- ============================================

-- ===== APPROVALS =====
CREATE TABLE approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  requested_by uuid REFERENCES auth.users(id) NOT NULL,
  approver_id uuid REFERENCES auth.users(id),
  status approval_status DEFAULT 'pending' NOT NULL,
  feedback text,
  revision_notes text,
  requested_at timestamp with time zone DEFAULT now() NOT NULL,
  responded_at timestamp with time zone,
  whatsapp_message_id text,
  post_version_id uuid REFERENCES post_versions(id)
);

CREATE INDEX idx_approvals_post ON approvals(post_id);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_approver ON approvals(approver_id);
CREATE INDEX idx_approvals_requested ON approvals(requested_at);

ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approvals" ON approvals
  FOR SELECT USING (
    requested_by = auth.uid() OR
    approver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'developer')
    )
  );

CREATE POLICY "Users can request approval" ON approvals
  FOR INSERT WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Approvers can respond" ON approvals
  FOR UPDATE USING (
    approver_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ===== POST METRICS =====
CREATE TABLE post_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  platform_id uuid REFERENCES platforms(id) ON DELETE CASCADE NOT NULL,
  views integer DEFAULT 0,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  saves integer DEFAULT 0,
  engagement_rate decimal(5,2),
  watch_time_seconds integer,
  average_view_duration_seconds integer,
  completion_rate decimal(5,2),
  audience_demographics jsonb,
  collected_at timestamp with time zone DEFAULT now() NOT NULL,
  raw_data jsonb
);

CREATE INDEX idx_post_metrics_post ON post_metrics(post_id);
CREATE INDEX idx_post_metrics_platform ON post_metrics(platform_id);
CREATE INDEX idx_post_metrics_collected ON post_metrics(collected_at);

ALTER TABLE post_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view metrics" ON post_metrics
  FOR SELECT USING (true);

-- ===== DAILY METRICS SUMMARY =====
CREATE TABLE daily_metrics_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date date NOT NULL,
  platform_id uuid REFERENCES platforms(id) ON DELETE CASCADE NOT NULL,
  brand text CHECK (brand IN ('la_music_school', 'la_music_kids')),
  total_posts integer DEFAULT 0,
  total_views integer DEFAULT 0,
  total_impressions integer DEFAULT 0,
  total_reach integer DEFAULT 0,
  total_engagement integer DEFAULT 0,
  average_engagement_rate decimal(5,2),
  followers_count integer,
  followers_gained integer,
  followers_lost integer,
  raw_data jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(metric_date, platform_id, brand)
);

CREATE INDEX idx_daily_metrics_date ON daily_metrics_summary(metric_date);
CREATE INDEX idx_daily_metrics_platform ON daily_metrics_summary(platform_id);
CREATE INDEX idx_daily_metrics_brand ON daily_metrics_summary(brand);

-- ===== CAMPAIGNS =====
CREATE TABLE campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  campaign_type campaign_type NOT NULL,
  status campaign_status DEFAULT 'draft' NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  managed_by uuid REFERENCES auth.users(id),
  kanban_card_id uuid REFERENCES kanban_cards(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date,
  brand text CHECK (brand IN ('la_music_school', 'la_music_kids')) NOT NULL,
  objective text,
  target_audience text,
  budget_total decimal(10,2),
  budget_spent decimal(10,2) DEFAULT 0,
  currency text DEFAULT 'BRL',
  kpi_goals jsonb DEFAULT '{}'::jsonb,
  external_campaign_ids jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  deleted_at timestamp with time zone
);

CREATE INDEX idx_campaigns_type ON campaigns(campaign_type);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_brand ON campaigns(brand);
CREATE INDEX idx_campaigns_dates ON campaigns(start_date, end_date);
CREATE INDEX idx_campaigns_managed_by ON campaigns(managed_by);
CREATE INDEX idx_campaigns_active ON campaigns(deleted_at) WHERE deleted_at IS NULL;

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view campaigns" ON campaigns
  FOR SELECT USING (deleted_at IS NULL);

CREATE POLICY "Users can insert campaigns" ON campaigns
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update campaigns" ON campaigns
  FOR UPDATE USING (
    created_by = auth.uid() OR
    managed_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role IN ('admin', 'developer')
    )
  );

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== CAMPAIGN POSTS =====
CREATE TABLE campaign_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(campaign_id, post_id)
);

CREATE INDEX idx_campaign_posts_campaign ON campaign_posts(campaign_id);
CREATE INDEX idx_campaign_posts_post ON campaign_posts(post_id);

-- ===== CAMPAIGN METRICS =====
CREATE TABLE campaign_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  metric_date date NOT NULL,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  ctr decimal(5,2),
  cpc decimal(10,2),
  cpm decimal(10,2),
  conversions integer DEFAULT 0,
  conversion_rate decimal(5,2),
  cost_per_conversion decimal(10,2),
  spend decimal(10,2) DEFAULT 0,
  revenue decimal(10,2),
  roas decimal(5,2),
  raw_data jsonb,
  collected_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE(campaign_id, metric_date)
);

CREATE INDEX idx_campaign_metrics_campaign ON campaign_metrics(campaign_id);
CREATE INDEX idx_campaign_metrics_date ON campaign_metrics(metric_date);

-- ===== AI AGENTS =====
CREATE TABLE ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL,
  description text,
  llm_provider text,
  llm_model text,
  system_prompt text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ===== AI CONVERSATIONS =====
CREATE TABLE ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  ai_agent_id uuid REFERENCES ai_agents(id) NOT NULL,
  context_type text,
  kanban_card_id uuid REFERENCES kanban_cards(id) ON DELETE SET NULL,
  post_id uuid REFERENCES posts(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  messages jsonb DEFAULT '[]'::jsonb,
  started_at timestamp with time zone DEFAULT now() NOT NULL,
  last_message_at timestamp with time zone DEFAULT now() NOT NULL,
  ended_at timestamp with time zone
);

CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_agent ON ai_conversations(ai_agent_id);
CREATE INDEX idx_ai_conversations_active ON ai_conversations(is_active);
CREATE INDEX idx_ai_conversations_last_message ON ai_conversations(last_message_at);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON ai_conversations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create conversations" ON ai_conversations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conversations" ON ai_conversations
  FOR UPDATE USING (user_id = auth.uid());

-- ===== AI EXECUTIONS =====
CREATE TABLE ai_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agent_id uuid REFERENCES ai_agents(id) NOT NULL,
  task_type text NOT NULL,
  input_data jsonb NOT NULL,
  output_data jsonb,
  status execution_status DEFAULT 'queued' NOT NULL,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  duration_ms integer,
  tokens_used integer,
  estimated_cost decimal(10,4),
  triggered_by text,
  trigger_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_ai_executions_agent ON ai_executions(ai_agent_id);
CREATE INDEX idx_ai_executions_status ON ai_executions(status);
CREATE INDEX idx_ai_executions_task_type ON ai_executions(task_type);
CREATE INDEX idx_ai_executions_created ON ai_executions(created_at);

-- ===== AI LOGS =====
CREATE TABLE ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agent_id uuid REFERENCES ai_agents(id),
  execution_id uuid REFERENCES ai_executions(id) ON DELETE CASCADE,
  level log_level NOT NULL,
  message text NOT NULL,
  context jsonb,
  stack_trace text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_ai_logs_agent ON ai_logs(ai_agent_id);
CREATE INDEX idx_ai_logs_execution ON ai_logs(execution_id);
CREATE INDEX idx_ai_logs_level ON ai_logs(level);
CREATE INDEX idx_ai_logs_created ON ai_logs(created_at);

-- ===== NOTIFICATIONS QUEUE =====
CREATE TABLE notifications_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  notification_type notification_type NOT NULL,
  priority notification_priority DEFAULT 'normal' NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  payload jsonb,
  related_entity_type text,
  related_entity_id uuid,
  scheduled_for timestamp with time zone DEFAULT now() NOT NULL,
  status text CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')) DEFAULT 'pending',
  sent_at timestamp with time zone,
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  error_message text,
  whatsapp_message_id text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_notifications_user ON notifications_queue(user_id);
CREATE INDEX idx_notifications_type ON notifications_queue(notification_type);
CREATE INDEX idx_notifications_status ON notifications_queue(status);
CREATE INDEX idx_notifications_scheduled ON notifications_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_notifications_priority ON notifications_queue(priority);

ALTER TABLE notifications_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON notifications_queue
  FOR SELECT USING (user_id = auth.uid());

-- ===== NOTIFICATIONS LOG =====
CREATE TABLE notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_queue_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  notification_type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  payload jsonb,
  related_entity_type text,
  related_entity_id uuid,
  status text CHECK (status IN ('sent', 'delivered', 'read', 'failed')) NOT NULL,
  delivered_at timestamp with time zone,
  read_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX idx_notifications_log_user ON notifications_log(user_id);
CREATE INDEX idx_notifications_log_type ON notifications_log(notification_type);
CREATE INDEX idx_notifications_log_status ON notifications_log(status);
CREATE INDEX idx_notifications_log_created ON notifications_log(created_at);

ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification logs" ON notifications_log
  FOR SELECT USING (user_id = auth.uid());
