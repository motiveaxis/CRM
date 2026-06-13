
-- =====================================================================
-- ENUMS
-- =====================================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'employee', 'client_owner', 'client_viewer');

-- =====================================================================
-- HELPER: updated_at trigger
-- =====================================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================================
-- USER ROLES (separate table — never on profiles)
-- =====================================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','manager','employee')
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- EMPLOYEES
-- =====================================================================
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'employee', -- admin | manager | employee
  department text,                       -- sales | ops | engineering | all
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view employees" ON public.employees
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage employees" ON public.employees
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER employees_touch BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- helper: is current user assigned-to this employee row
CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- =====================================================================
-- LEADS
-- =====================================================================
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text UNIQUE NOT NULL,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  source text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  priority text DEFAULT 'medium',
  status text NOT NULL DEFAULT 'new',
  vertical text,
  notes text,
  assigned_to uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_assigned ON public.leads(assigned_to);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager view all leads" ON public.leads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Employee view assigned leads" ON public.leads FOR SELECT TO authenticated
  USING (assigned_to = public.current_employee_id());
CREATE POLICY "Staff insert leads" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update leads" ON public.leads FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admin delete leads" ON public.leads FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER leads_touch BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================================
-- REPORTS
-- =====================================================================
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id text UNIQUE NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  vertical text NOT NULL,
  diagnosis_summary text,
  hours_saved_estimate numeric,
  current_state_description text,
  future_state_description text,
  stack_recommendation jsonb DEFAULT '{}'::jsonb,
  pricing_tier text,
  pricing_value numeric,
  build_approach text,
  pdf_url text,
  pdf_generated_at timestamptz,
  report_status text NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage reports" ON public.reports FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER reports_touch BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================================
-- DEALS
-- =====================================================================
CREATE TABLE public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id text UNIQUE NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  stage text NOT NULL DEFAULT 'report_sent',
  deal_value numeric,
  pricing_tier text,
  contract_status text NOT NULL DEFAULT 'pending',
  contract_url text,
  contract_signed_at timestamptz,
  assigned_to uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  close_probability integer DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deals_stage ON public.deals(stage);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deals TO authenticated;
GRANT ALL ON public.deals TO service_role;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/manager view all deals" ON public.deals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "Employee view assigned deals" ON public.deals FOR SELECT TO authenticated
  USING (assigned_to = public.current_employee_id());
CREATE POLICY "Staff manage deals" ON public.deals FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update deals" ON public.deals FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admin delete deals" ON public.deals FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER deals_touch BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================================
-- CLIENTS
-- =====================================================================
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text UNIQUE NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id),
  deal_id uuid NOT NULL REFERENCES public.deals(id),
  report_id uuid REFERENCES public.reports(id),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'onboarding',
  pricing_tier text,
  monthly_value numeric,
  n8n_instance_url text,
  n8n_instance_name text,
  n8n_provisioned boolean NOT NULL DEFAULT false,
  n8n_provisioned_at timestamptz,
  portal_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  portal_created boolean NOT NULL DEFAULT false,
  portal_created_at timestamptz,
  credentials_submitted boolean NOT NULL DEFAULT false,
  onboarding_step text NOT NULL DEFAULT 'agreement_signed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_portal_user ON public.clients(portal_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view all clients" ON public.clients FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Client views own record" ON public.clients FOR SELECT TO authenticated
  USING (portal_user_id = auth.uid());
CREATE POLICY "Staff manage clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff update clients" ON public.clients FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admin delete clients" ON public.clients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER clients_touch BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- helper: is current user the portal owner of this client
CREATE OR REPLACE FUNCTION public.is_client_owner(_client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.clients WHERE id = _client_id AND portal_user_id = auth.uid())
$$;

-- =====================================================================
-- AUTOMATIONS
-- =====================================================================
CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id text UNIQUE NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'building',
  workflow_url text,
  apis_connected jsonb NOT NULL DEFAULT '[]'::jsonb,
  time_saved_minutes_per_run numeric DEFAULT 0,
  average_runs_per_month numeric DEFAULT 0,
  monthly_time_saved_hours numeric GENERATED ALWAYS AS
    (COALESCE(time_saved_minutes_per_run,0) * COALESCE(average_runs_per_month,0) / 60.0) STORED,
  cost_per_run numeric DEFAULT 0,
  monthly_cost numeric GENERATED ALWAYS AS
    (COALESCE(cost_per_run,0) * COALESCE(average_runs_per_month,0)) STORED,
  last_run_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT ALL ON public.automations TO service_role;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage automations" ON public.automations FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Client view own automations" ON public.automations FOR SELECT TO authenticated
  USING (public.is_client_owner(client_id));

CREATE TRIGGER automations_touch BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================================
-- API CONNECTIONS
-- =====================================================================
CREATE TABLE public.api_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  automation_id uuid REFERENCES public.automations(id) ON DELETE SET NULL,
  api_name text NOT NULL,
  endpoint text,
  calls_this_month integer NOT NULL DEFAULT 0,
  cost_per_call numeric NOT NULL DEFAULT 0,
  monthly_cost numeric GENERATED ALWAYS AS
    (COALESCE(cost_per_call,0) * COALESCE(calls_this_month,0)) STORED,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_connections TO authenticated;
GRANT ALL ON public.api_connections TO service_role;
ALTER TABLE public.api_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage api_connections" ON public.api_connections FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Client view own api_connections" ON public.api_connections FOR SELECT TO authenticated
  USING (public.is_client_owner(client_id));

-- =====================================================================
-- CREDENTIALS VAULT — never readable by client or non-admin staff
-- =====================================================================
CREATE TABLE public.credentials_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  encrypted_payload text NOT NULL,
  encryption_key_ref text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  submitted_by text
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credentials_vault TO authenticated;
GRANT ALL ON public.credentials_vault TO service_role;
ALTER TABLE public.credentials_vault ENABLE ROW LEVEL SECURITY;

-- Only admins can read the encrypted blob via SQL; decrypt happens in server fn with service role.
CREATE POLICY "Admin read vault" ON public.credentials_vault FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
-- Inserts/updates done only via server function (service role bypasses RLS).

-- =====================================================================
-- COMMUNICATIONS
-- =====================================================================
CREATE TABLE public.communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  type text,
  subject text,
  body text,
  sent_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  sent_at timestamptz,
  opened_at timestamptz,
  sentiment text,
  meeting_attended boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.communications TO authenticated;
GRANT ALL ON public.communications TO service_role;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage communications" ON public.communications FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- =====================================================================
-- SUPPORT TICKETS
-- =====================================================================
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id text UNIQUE NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  assigned_to uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage tickets" ON public.support_tickets FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Client view own tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (public.is_client_owner(client_id));
CREATE POLICY "Client create own tickets" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (public.is_client_owner(client_id));

CREATE TRIGGER tickets_touch BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================================
-- PIPELINE STAGES (config)
-- =====================================================================
CREATE TABLE public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  order_index integer NOT NULL,
  color text
);

GRANT SELECT ON public.pipeline_stages TO authenticated;
GRANT ALL ON public.pipeline_stages TO service_role;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read stages" ON public.pipeline_stages FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin manage stages" ON public.pipeline_stages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.pipeline_stages (name, slug, order_index, color) VALUES
  ('New Lead',     'new',           1, '#8A8A93'),
  ('Qualified',    'qualified',     2, '#8A8A93'),
  ('Report Sent',  'report_sent',   3, '#FF001E'),
  ('Proposal',     'proposal',      4, '#FF001E'),
  ('Negotiation',  'negotiation',   5, '#FF001E'),
  ('Closed Won',   'closed_won',    6, '#FF001E'),
  ('Closed Lost',  'closed_lost',   7, '#444444');

-- =====================================================================
-- PERMISSIONS CONFIG (catalog)
-- =====================================================================
CREATE TABLE public.permissions_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  category text NOT NULL
);

GRANT SELECT ON public.permissions_config TO authenticated;
GRANT ALL ON public.permissions_config TO service_role;
ALTER TABLE public.permissions_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read permissions catalog" ON public.permissions_config FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin manage permissions catalog" ON public.permissions_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.permissions_config (key, label, description, category) VALUES
  ('view_all_leads','View all leads','See every lead in the system','leads'),
  ('view_assigned_leads_only','View assigned leads only','See only leads assigned to me','leads'),
  ('create_leads','Create leads',NULL,'leads'),
  ('edit_leads','Edit leads',NULL,'leads'),
  ('delete_leads','Delete leads',NULL,'leads'),
  ('view_pipeline','View pipeline',NULL,'pipeline'),
  ('move_pipeline_stages','Move pipeline stages',NULL,'pipeline'),
  ('view_deal_values','View deal values',NULL,'pipeline'),
  ('view_reports','View reports',NULL,'reports'),
  ('create_reports','Create reports',NULL,'reports'),
  ('send_reports','Send reports',NULL,'reports'),
  ('edit_reports','Edit reports',NULL,'reports'),
  ('view_all_deals','View all deals',NULL,'sales'),
  ('view_assigned_deals_only','View assigned deals only',NULL,'sales'),
  ('edit_deals','Edit deals',NULL,'sales'),
  ('sign_contracts','Sign contracts',NULL,'sales'),
  ('view_revenue_data','View revenue data',NULL,'sales'),
  ('view_marketing_dashboard','View marketing dashboard',NULL,'marketing'),
  ('view_utm_data','View UTM data',NULL,'marketing'),
  ('view_all_clients','View all clients',NULL,'clients'),
  ('view_assigned_clients_only','View assigned clients only',NULL,'clients'),
  ('edit_client_data','Edit client data',NULL,'clients'),
  ('view_credentials_status','View credentials status',NULL,'clients'),
  ('view_portal_list','View portal list',NULL,'portal'),
  ('open_client_portals','Open client portals',NULL,'portal'),
  ('manage_n8n_instances','Manage n8n instances',NULL,'portal'),
  ('view_team','View team',NULL,'team'),
  ('manage_employees','Manage employees',NULL,'team'),
  ('manage_permissions','Manage permissions',NULL,'team'),
  ('access_settings','Access settings',NULL,'admin'),
  ('view_all_financials','View all financials',NULL,'admin');

-- =====================================================================
-- APP SETTINGS (single row config)
-- =====================================================================
CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  agency_name text DEFAULT 'MotiveAxis',
  agency_email text,
  agency_website text,
  webhook_provision_instance text,
  webhook_create_portal_user text,
  webhook_notify_credentials text,
  webhook_lead_normalize text,
  hourly_rate_for_savings numeric DEFAULT 50,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read settings" ON public.app_settings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Admin manage settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TRIGGER settings_touch BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================================
-- BOOTSTRAP: first user becomes admin + employee
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count int;
BEGIN
  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    INSERT INTO public.employees (auth_user_id, name, email, role, department, status)
      VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), NEW.email, 'admin', 'all', 'active')
      ON CONFLICT (email) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- =====================================================================
-- ID GENERATORS (human-readable: MA-LEAD-001 etc.)
-- =====================================================================
CREATE SEQUENCE IF NOT EXISTS public.lead_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.report_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.deal_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.client_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.automation_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.ticket_seq START 1;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_lead_id() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF NEW.lead_id IS NULL OR NEW.lead_id = '' THEN NEW.lead_id := 'MA-LEAD-' || lpad(nextval('public.lead_seq')::text,3,'0'); END IF; RETURN NEW; END $$;
CREATE TRIGGER leads_set_id BEFORE INSERT ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_lead_id();

CREATE OR REPLACE FUNCTION public.set_report_id() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF NEW.report_id IS NULL OR NEW.report_id = '' THEN NEW.report_id := 'MA-RPT-' || lpad(nextval('public.report_seq')::text,3,'0'); END IF; RETURN NEW; END $$;
CREATE TRIGGER reports_set_id BEFORE INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION public.set_report_id();

CREATE OR REPLACE FUNCTION public.set_deal_id() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF NEW.deal_id IS NULL OR NEW.deal_id = '' THEN NEW.deal_id := 'MA-DEAL-' || lpad(nextval('public.deal_seq')::text,3,'0'); END IF; RETURN NEW; END $$;
CREATE TRIGGER deals_set_id BEFORE INSERT ON public.deals FOR EACH ROW EXECUTE FUNCTION public.set_deal_id();

CREATE OR REPLACE FUNCTION public.set_client_id() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF NEW.client_id IS NULL OR NEW.client_id = '' THEN NEW.client_id := 'MA-CLIENT-' || lpad(nextval('public.client_seq')::text,3,'0'); END IF; RETURN NEW; END $$;
CREATE TRIGGER clients_set_id BEFORE INSERT ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_client_id();

CREATE OR REPLACE FUNCTION public.set_automation_id() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF NEW.automation_id IS NULL OR NEW.automation_id = '' THEN NEW.automation_id := 'MA-AUTO-' || lpad(nextval('public.automation_seq')::text,3,'0'); END IF; RETURN NEW; END $$;
CREATE TRIGGER automations_set_id BEFORE INSERT ON public.automations FOR EACH ROW EXECUTE FUNCTION public.set_automation_id();

CREATE OR REPLACE FUNCTION public.set_ticket_id() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF NEW.ticket_id IS NULL OR NEW.ticket_id = '' THEN NEW.ticket_id := 'MA-TKT-' || lpad(nextval('public.ticket_seq')::text,3,'0'); END IF; RETURN NEW; END $$;
CREATE TRIGGER tickets_set_id BEFORE INSERT ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_ticket_id();
