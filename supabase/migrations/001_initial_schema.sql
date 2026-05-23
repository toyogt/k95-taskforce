-- ============================================================
-- K95 TASKFORCE — Full Database Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── PROFILES ────────────────────────────────────────
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  department_id UUID,
  is_active BOOLEAN DEFAULT true,
  office_start_time TIME DEFAULT '10:00',
  office_end_time TIME DEFAULT '18:00',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── ROLES ────────────────────────────────────────────
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL, -- super_admin, admin, pc, manager, md, doer
  label TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── USER ROLES (multi-role) ─────────────────────────
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- ─── DEPARTMENTS ──────────────────────────────────────
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  head_user_id UUID REFERENCES public.profiles(id),
  office_start_time TIME DEFAULT '10:00',
  office_end_time TIME DEFAULT '18:00',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add FK from profiles to departments
ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_department
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

-- ─── HOLIDAYS ─────────────────────────────────────────
CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  scope TEXT NOT NULL DEFAULT 'company', -- company | department
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  is_recurring BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(holiday_date, scope, department_id)
);

-- ─── OFFICE TIME RULES ───────────────────────────────
-- Priority: task > user > role > department > company
CREATE TABLE public.office_time_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope TEXT NOT NULL, -- company | department | role | user | task
  scope_ref_id UUID, -- FK to the relevant entity
  start_time TIME NOT NULL DEFAULT '10:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── TASK TEMPLATES ───────────────────────────────────
CREATE TABLE public.task_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  default_assigned_to UUID REFERENCES public.profiles(id),
  frequency_type TEXT NOT NULL DEFAULT 'daily',
    -- daily | weekly_days | monthly_date | monthly_nth_weekday | last_weekday_of_month | one_time
  frequency_config JSONB DEFAULT '{}',
    -- weekly_days: {"days": ["MON","WED","FRI"]}
    -- monthly_date: {"day_of_month": 15}
    -- monthly_nth_weekday: {"nth": 2, "weekday": "TUE"}
    -- last_weekday_of_month: {"weekday": "FRI"}
    -- one_time: {"date": "2026-06-15"}
  due_time TIME DEFAULT '18:00',
  priority TEXT DEFAULT 'medium', -- low | medium | high | critical
  priority_multiplier NUMERIC(3,2) DEFAULT 1.00,
  is_scoreable BOOLEAN DEFAULT true,
  respect_holidays BOOLEAN DEFAULT true,
  requires_attachment BOOLEAN DEFAULT false,
  requires_remarks BOOLEAN DEFAULT false,
  instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── TASK INSTANCES ───────────────────────────────────
CREATE TABLE public.task_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_template_id UUID NOT NULL REFERENCES public.task_templates(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES public.profiles(id),
  due_date DATE NOT NULL,
  due_time TIME DEFAULT '18:00',
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending | done_on_time | done_late | missed_locked | help_raised
    -- protected_pending | reassigned | skipped_approved | reopened | cancelled
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  remarks TEXT,
  score_earned INTEGER DEFAULT 0,
  is_score_excluded BOOLEAN DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by TEXT, -- 'system' or user_id
  original_due_date DATE, -- if moved due to holiday
  reopened_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES public.profiles(id),
  reopen_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_template_id, assigned_to, due_date)
);

CREATE INDEX idx_task_instances_user_date ON public.task_instances(assigned_to, due_date);
CREATE INDEX idx_task_instances_status ON public.task_instances(status);
CREATE INDEX idx_task_instances_template ON public.task_instances(task_template_id);
CREATE INDEX idx_task_instances_due ON public.task_instances(due_date);

-- ─── TASK ATTACHMENTS ────────────────────────────────
CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_instance_id UUID NOT NULL REFERENCES public.task_instances(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── HELP TICKETS ────────────────────────────────────
CREATE TABLE public.help_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_instance_id UUID REFERENCES public.task_instances(id) ON DELETE SET NULL,
  raised_by UUID NOT NULL REFERENCES public.profiles(id),
  ticket_type TEXT NOT NULL DEFAULT 'general_query',
    -- task_detail_change | time_change | frequency_change | reassignment_request
    -- blocked_task | task_deletion_request | general_query
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
    -- open | in_review | approved | rejected | resolved | closed
  priority TEXT DEFAULT 'medium',
  assigned_to UUID REFERENCES public.profiles(id), -- PC who picks it up
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── TICKET COMMENTS ─────────────────────────────────
CREATE TABLE public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES public.help_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── ATTENDANCE ───────────────────────────────────────
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present', -- present | absent | leave | half_day
  marked_by UUID REFERENCES public.profiles(id),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- ─── REASSIGNMENTS ───────────────────────────────────
CREATE TABLE public.reassignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reassignment_type TEXT NOT NULL DEFAULT 'single_task',
    -- single_task | specific_date | date_range | permanent
  task_instance_id UUID REFERENCES public.task_instances(id),
  task_template_id UUID REFERENCES public.task_templates(id),
  from_user_id UUID NOT NULL REFERENCES public.profiles(id),
  to_user_id UUID NOT NULL REFERENCES public.profiles(id),
  from_date DATE,
  to_date DATE,
  reason TEXT,
  reassigned_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── SCORE LOGS ───────────────────────────────────────
CREATE TABLE public.score_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_tasks INTEGER DEFAULT 0,
  done_on_time INTEGER DEFAULT 0,
  done_late INTEGER DEFAULT 0,
  missed INTEGER DEFAULT 0,
  excluded INTEGER DEFAULT 0,
  earned_score INTEGER DEFAULT 0,
  possible_score INTEGER DEFAULT 0,
  percentage NUMERIC(5,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- ─── REMINDER LOGS ───────────────────────────────────
CREATE TABLE public.reminder_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  reminder_type TEXT NOT NULL, -- morning | noon | evening | overdue | manual
  channel TEXT NOT NULL DEFAULT 'email', -- email | whatsapp
  task_instance_ids UUID[] DEFAULT '{}',
  status TEXT DEFAULT 'sent', -- sent | failed | skipped
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- ─── AUDIT LOGS ───────────────────────────────────────
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- task_instance | task_template | profile | department | ...
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- ─── SYSTEM SETTINGS ──────────────────────────────────
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  -- Assign default 'doer' role
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT NEW.id, r.id FROM public.roles r WHERE r.name = 'doer';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_departments_updated BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_task_templates_updated BEFORE UPDATE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_task_instances_updated BEFORE UPDATE ON public.task_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_help_tickets_updated BEFORE UPDATE ON public.help_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Score update trigger: when task status changes, update score_earned
CREATE OR REPLACE FUNCTION public.update_task_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done_on_time' THEN NEW.score_earned := 100;
  ELSIF NEW.status = 'done_late' THEN NEW.score_earned := 60;
  ELSIF NEW.status = 'missed_locked' THEN NEW.score_earned := 0;
  ELSE NEW.score_earned := 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_task_score BEFORE INSERT OR UPDATE OF status ON public.task_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_task_score();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_time_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reassignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Helper: check if user has a role
CREATE OR REPLACE FUNCTION public.user_has_role(check_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = check_role
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_is_admin_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_is_pc_or_above()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name IN ('pc', 'admin', 'super_admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- PROFILES
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (public.user_is_admin_or_above());
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE USING (public.user_is_admin_or_above());

-- ROLES
CREATE POLICY "Anyone can view roles" ON public.roles FOR SELECT USING (true);
CREATE POLICY "Admins manage roles" ON public.roles FOR ALL USING (public.user_is_admin_or_above());

-- USER ROLES
CREATE POLICY "Anyone can view user_roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "Admins manage user_roles" ON public.user_roles FOR ALL USING (public.user_is_admin_or_above());

-- DEPARTMENTS
CREATE POLICY "Anyone can view departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Admins manage departments" ON public.departments FOR ALL USING (public.user_is_admin_or_above());

-- HOLIDAYS
CREATE POLICY "Anyone can view holidays" ON public.holidays FOR SELECT USING (true);
CREATE POLICY "Admins manage holidays" ON public.holidays FOR ALL USING (public.user_is_admin_or_above());

-- OFFICE TIME RULES
CREATE POLICY "Anyone can view office_time_rules" ON public.office_time_rules FOR SELECT USING (true);
CREATE POLICY "Admins manage office_time_rules" ON public.office_time_rules FOR ALL USING (public.user_is_admin_or_above());

-- TASK TEMPLATES
CREATE POLICY "Anyone can view active templates" ON public.task_templates FOR SELECT USING (true);
CREATE POLICY "Admins manage templates" ON public.task_templates FOR ALL USING (public.user_is_admin_or_above());

-- TASK INSTANCES
CREATE POLICY "Users can view own tasks" ON public.task_instances FOR SELECT
  USING (assigned_to = auth.uid() OR public.user_is_pc_or_above());
CREATE POLICY "Users can update own tasks" ON public.task_instances FOR UPDATE
  USING (assigned_to = auth.uid() OR public.user_is_pc_or_above());
CREATE POLICY "System/Admin can insert tasks" ON public.task_instances FOR INSERT
  WITH CHECK (public.user_is_pc_or_above());
CREATE POLICY "Admins can delete tasks" ON public.task_instances FOR DELETE
  USING (public.user_is_admin_or_above());

-- TASK ATTACHMENTS
CREATE POLICY "View attachments for accessible tasks" ON public.task_attachments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.task_instances ti
    WHERE ti.id = task_instance_id AND (ti.assigned_to = auth.uid() OR public.user_is_pc_or_above())
  ));
CREATE POLICY "Upload attachments to own tasks" ON public.task_attachments FOR INSERT
  WITH CHECK (uploaded_by = auth.uid() OR public.user_is_pc_or_above());

-- HELP TICKETS
CREATE POLICY "Users view own tickets or PC/Admin view all" ON public.help_tickets FOR SELECT
  USING (raised_by = auth.uid() OR assigned_to = auth.uid() OR public.user_is_pc_or_above());
CREATE POLICY "Anyone can create tickets" ON public.help_tickets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "PC/Admin can update tickets" ON public.help_tickets FOR UPDATE
  USING (raised_by = auth.uid() OR public.user_is_pc_or_above());

-- TICKET COMMENTS
CREATE POLICY "View comments on accessible tickets" ON public.ticket_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.help_tickets ht
    WHERE ht.id = ticket_id AND (ht.raised_by = auth.uid() OR ht.assigned_to = auth.uid() OR public.user_is_pc_or_above())
  ));
CREATE POLICY "Add comments" ON public.ticket_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ATTENDANCE
CREATE POLICY "Users view own attendance" ON public.attendance FOR SELECT
  USING (user_id = auth.uid() OR public.user_is_pc_or_above());
CREATE POLICY "PC marks attendance" ON public.attendance FOR INSERT
  WITH CHECK (public.user_is_pc_or_above());
CREATE POLICY "PC updates attendance" ON public.attendance FOR UPDATE
  USING (public.user_is_pc_or_above());

-- REASSIGNMENTS
CREATE POLICY "View reassignments" ON public.reassignments FOR SELECT
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid() OR public.user_is_pc_or_above());
CREATE POLICY "PC creates reassignments" ON public.reassignments FOR INSERT
  WITH CHECK (public.user_is_pc_or_above());

-- SCORE LOGS
CREATE POLICY "View own or all scores" ON public.score_logs FOR SELECT
  USING (user_id = auth.uid() OR public.user_is_pc_or_above());
CREATE POLICY "System inserts scores" ON public.score_logs FOR INSERT
  WITH CHECK (public.user_is_pc_or_above());
CREATE POLICY "System updates scores" ON public.score_logs FOR UPDATE
  USING (public.user_is_pc_or_above());

-- REMINDER LOGS
CREATE POLICY "PC+ view reminders" ON public.reminder_logs FOR SELECT
  USING (public.user_is_pc_or_above());
CREATE POLICY "System inserts reminders" ON public.reminder_logs FOR INSERT
  WITH CHECK (public.user_is_pc_or_above());

-- AUDIT LOGS
CREATE POLICY "Admin view audits" ON public.audit_logs FOR SELECT
  USING (public.user_is_admin_or_above());
CREATE POLICY "System inserts audits" ON public.audit_logs FOR INSERT
  WITH CHECK (true); -- Service role only in practice

-- SYSTEM SETTINGS
CREATE POLICY "Anyone can view settings" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage settings" ON public.system_settings FOR ALL USING (public.user_is_admin_or_above());


-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth users upload attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);
CREATE POLICY "Auth users view attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'attachments' AND auth.uid() IS NOT NULL);
