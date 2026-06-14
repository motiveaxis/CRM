
-- =========================
-- CORRECTION 1: Standardize RLS via is_staff()
-- =========================

-- LEADS
DROP POLICY IF EXISTS "Admin delete leads" ON public.leads;
DROP POLICY IF EXISTS "Admin/manager view all leads" ON public.leads;
DROP POLICY IF EXISTS "Employee view assigned leads" ON public.leads;
DROP POLICY IF EXISTS "Staff insert leads" ON public.leads;
DROP POLICY IF EXISTS "Staff update leads" ON public.leads;
DROP POLICY IF EXISTS "staff_full_access_leads" ON public.leads;
CREATE POLICY "staff_full_access_leads" ON public.leads FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- REPORTS
DROP POLICY IF EXISTS "Staff manage reports" ON public.reports;
DROP POLICY IF EXISTS "staff_full_access_reports" ON public.reports;
CREATE POLICY "staff_full_access_reports" ON public.reports FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- DEALS
DROP POLICY IF EXISTS "Admin delete deals" ON public.deals;
DROP POLICY IF EXISTS "Admin/manager view all deals" ON public.deals;
DROP POLICY IF EXISTS "Employee view assigned deals" ON public.deals;
DROP POLICY IF EXISTS "Staff manage deals" ON public.deals;
DROP POLICY IF EXISTS "Staff update deals" ON public.deals;
DROP POLICY IF EXISTS "staff_full_access_deals" ON public.deals;
CREATE POLICY "staff_full_access_deals" ON public.deals FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- CLIENTS
DROP POLICY IF EXISTS "Admin delete clients" ON public.clients;
DROP POLICY IF EXISTS "Client views own record" ON public.clients;
DROP POLICY IF EXISTS "Staff manage clients" ON public.clients;
DROP POLICY IF EXISTS "Staff update clients" ON public.clients;
DROP POLICY IF EXISTS "Staff view all clients" ON public.clients;
DROP POLICY IF EXISTS "staff_full_access_clients" ON public.clients;
DROP POLICY IF EXISTS "client_read_own_client" ON public.clients;
CREATE POLICY "staff_full_access_clients" ON public.clients FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "client_read_own_client" ON public.clients FOR SELECT TO authenticated
  USING (portal_user_id = auth.uid());

-- AUTOMATIONS
DROP POLICY IF EXISTS "Client view own automations" ON public.automations;
DROP POLICY IF EXISTS "Staff manage automations" ON public.automations;
DROP POLICY IF EXISTS "staff_full_access_automations" ON public.automations;
DROP POLICY IF EXISTS "client_read_own_automations" ON public.automations;
CREATE POLICY "staff_full_access_automations" ON public.automations FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "client_read_own_automations" ON public.automations FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE portal_user_id = auth.uid()));

-- API_CONNECTIONS
DROP POLICY IF EXISTS "Client view own api_connections" ON public.api_connections;
DROP POLICY IF EXISTS "Staff manage api_connections" ON public.api_connections;
DROP POLICY IF EXISTS "staff_full_access_api_connections" ON public.api_connections;
DROP POLICY IF EXISTS "client_read_own_api_connections" ON public.api_connections;
CREATE POLICY "staff_full_access_api_connections" ON public.api_connections FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "client_read_own_api_connections" ON public.api_connections FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE portal_user_id = auth.uid()));

-- EMPLOYEES
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Staff can view employees" ON public.employees;
DROP POLICY IF EXISTS "staff_full_access_employees" ON public.employees;
CREATE POLICY "staff_full_access_employees" ON public.employees FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- SUPPORT_TICKETS
DROP POLICY IF EXISTS "Client create own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Client view own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Staff manage tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "staff_full_access_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "client_read_own_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "client_insert_own_tickets" ON public.support_tickets;
CREATE POLICY "staff_full_access_tickets" ON public.support_tickets FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "client_read_own_tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE portal_user_id = auth.uid()));
CREATE POLICY "client_insert_own_tickets" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE portal_user_id = auth.uid()));

-- CREDENTIALS_VAULT (staff full access; UI must hide encrypted blob)
DROP POLICY IF EXISTS "Admin read vault" ON public.credentials_vault;
DROP POLICY IF EXISTS "staff_full_access_vault" ON public.credentials_vault;
DROP POLICY IF EXISTS "client_insert_own_vault" ON public.credentials_vault;
CREATE POLICY "staff_full_access_vault" ON public.credentials_vault FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "client_insert_own_vault" ON public.credentials_vault FOR INSERT TO authenticated
  WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE portal_user_id = auth.uid()));

-- PIPELINE_STAGES
DROP POLICY IF EXISTS "Admin manage stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Staff read stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "staff_full_access_stages" ON public.pipeline_stages;
CREATE POLICY "staff_full_access_stages" ON public.pipeline_stages FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- PERMISSIONS_CONFIG
DROP POLICY IF EXISTS "Admin manage permissions catalog" ON public.permissions_config;
DROP POLICY IF EXISTS "Staff read permissions catalog" ON public.permissions_config;
DROP POLICY IF EXISTS "staff_full_access_permissions" ON public.permissions_config;
CREATE POLICY "staff_full_access_permissions" ON public.permissions_config FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- APP_SETTINGS
DROP POLICY IF EXISTS "Admin manage settings" ON public.app_settings;
DROP POLICY IF EXISTS "Staff read settings" ON public.app_settings;
DROP POLICY IF EXISTS "staff_full_access_app_settings" ON public.app_settings;
CREATE POLICY "staff_full_access_app_settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========================
-- CORRECTION 2: communications → interactions
-- =========================
DROP POLICY IF EXISTS "Staff manage communications" ON public.communications;
ALTER TABLE public.communications RENAME TO interactions;

ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS interaction_id text UNIQUE;
ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS content_summary text;
ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS next_action text;
ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS next_action_due timestamptz;
ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS requires_human_review boolean DEFAULT false;
ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS conversion_probability text DEFAULT 'low';
ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS meeting_outcome text;
ALTER TABLE public.interactions ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interactions TO authenticated;
GRANT ALL ON public.interactions TO service_role;
CREATE POLICY "staff_full_access_interactions" ON public.interactions FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========================
-- CORRECTION 3: qc_records
-- =========================
CREATE TABLE IF NOT EXISTS public.qc_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qc_id text UNIQUE,
  agent_reviewed text,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  reviewed_at timestamptz DEFAULT now(),
  qc_status text NOT NULL DEFAULT 'pending',
  issues_found jsonb DEFAULT '[]'::jsonb,
  corrections_applied jsonb DEFAULT '[]'::jsonb,
  approved_output_ref text,
  source text DEFAULT 'agent',
  notes text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qc_records TO authenticated;
GRANT ALL ON public.qc_records TO service_role;
ALTER TABLE public.qc_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_full_access_qc_records" ON public.qc_records FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =========================
-- CORRECTION 4: configs
-- =========================
CREATE TABLE IF NOT EXISTS public.configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id text UNIQUE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text,
  onboarded_at timestamptz,
  hosting_preference text DEFAULT 'motiveaxis-server',
  n8n_instance_url text,
  gtm_container_id text,
  credentials jsonb DEFAULT '{"crm":{"tool":"","type":"","status":"pending"},"pm":{"tool":"","type":"","status":"pending"},"automation":{"tool":"","type":"","status":"pending"},"notifications":{"tool":"","type":"","status":"pending"}}'::jsonb,
  build_scope text,
  build_status text DEFAULT 'pending',
  source text DEFAULT 'agent',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configs TO authenticated;
GRANT ALL ON public.configs TO service_role;
ALTER TABLE public.configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_full_access_configs" ON public.configs FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "client_read_own_configs" ON public.configs FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM public.clients WHERE portal_user_id = auth.uid()));
CREATE TRIGGER configs_touch BEFORE UPDATE ON public.configs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================
-- CORRECTION 5: Hermes fields on leads + reports
-- =========================
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS hermes_lead_id text UNIQUE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email_type text DEFAULT 'unknown';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source_platform text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tool_stack jsonb DEFAULT '{"crm":[],"automation":[],"project_management":[],"communication":[],"other":[]}'::jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS pain_points jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS goals jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS quantified_data jsonb DEFAULT '{"hours_per_week_mentioned":null,"hours_per_month_mentioned":null,"team_size_mentioned":null,"frequency_mentioned":""}'::jsonb;

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS hermes_report_id text UNIQUE;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS core_automation_category text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS current_state_json jsonb;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS future_state_json jsonb;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS recommended_stack jsonb;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS roi_summary jsonb;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS implementation_approach jsonb;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS qc_status text DEFAULT 'pending';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS qc_approved_at timestamptz;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS source text DEFAULT 'agent';

-- =========================
-- CORRECTION 6: pipeline_stages
-- =========================
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS agent_owner text;
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS agent_action text;

DELETE FROM public.pipeline_stages;
INSERT INTO public.pipeline_stages (name, slug, order_index, color, agent_owner, agent_action) VALUES
  ('New',               'new',                1,  '#444444', 'lead-axis',        'Lead-Axis normalizes and qualifies.'),
  ('Lead Qualified',    'lead_qualified',     2,  '#FF6600', 'report-axis',      'Report-Axis triggered. Generating diagnosis.'),
  ('Report Generation', 'report_generation',  3,  '#FF001E', 'report-axis',      'Report-Axis writing Decision Narrative.'),
  ('QC Pending',        'report_qc_pending',  4,  '#8A8A93', 'zed',              'Zed reviewing report. Nothing ships without approval.'),
  ('QC Approved',       'report_qc_approved', 5,  '#8A8A93', 'zed',              'Report passed QC. Sales-Axis activated.'),
  ('Report Sent',       'report_sent',        6,  '#8A8A93', 'sales-axis',       'Sales-Axis outreach sent.'),
  ('Engaged',           'engaged',            7,  '#FF6600', 'sales-axis',       'Lead engaging. Sales-Axis tracking sequence.'),
  ('Conversion Signal', 'conversion_signal',  8,  '#FF001E', 'human',            'Human review required. High probability.'),
  ('Proposal',          'proposal',           9,  '#FF6600', 'human',            'Human managing proposal.'),
  ('Closed Won',        'closed_won',         10, '#22CC44', 'onboarding-axis',  'Onboarding-Axis provisioning environment.'),
  ('Closed Lost',       'closed_lost',        11, '#444444', 'human',            'Deal lost. Agent activity stopped.');

-- =========================
-- Realtime
-- =========================
ALTER TABLE public.leads REPLICA IDENTITY FULL;
ALTER TABLE public.reports REPLICA IDENTITY FULL;
ALTER TABLE public.interactions REPLICA IDENTITY FULL;
ALTER TABLE public.qc_records REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.leads; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.reports; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.interactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.qc_records; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
