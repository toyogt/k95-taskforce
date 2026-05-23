-- ============================================================
-- K95 TASKFORCE — Seed Data
-- Run AFTER the migration in Supabase SQL Editor
-- ============================================================

-- ─── ROLES ────────────────────────────────────────────
INSERT INTO public.roles (name, label, description) VALUES
  ('super_admin', 'Super Admin', 'Full system access, can manage everything including other admins'),
  ('admin', 'Admin', 'Company administrator, manages users, departments, templates, holidays'),
  ('pc', 'Process Coordinator', 'Monitors task completion, manages attendance, reassignments, tickets'),
  ('manager', 'Manager', 'Team lead, views team dashboard and scores'),
  ('md', 'Management', 'Executive view — company-wide compliance and trends'),
  ('doer', 'Doer', 'Default role — completes assigned tasks')
ON CONFLICT (name) DO NOTHING;

-- ─── DEFAULT SYSTEM SETTINGS ──────────────────────────
INSERT INTO public.system_settings (key, value) VALUES
  ('company_name', '"K95 Foods"'),
  ('default_office_start', '"10:00"'),
  ('default_office_end', '"18:00"'),
  ('task_lock_time', '"18:00"'),
  ('task_lock_grace_minutes', '60'),
  ('reminder_morning_time', '"10:30"'),
  ('reminder_noon_time', '"14:30"'),
  ('reminder_evening_time', '"17:00"'),
  ('score_done_on_time', '100'),
  ('score_done_late', '60'),
  ('score_missed', '0'),
  ('brevo_sender_name', '"K95 TaskForce"'),
  ('allow_self_signup', 'false'),
  ('max_undo_minutes', '5')
ON CONFLICT (key) DO NOTHING;

-- ─── SAMPLE DEPARTMENTS ──────────────────────────────
-- (Remove or modify these for your company)
INSERT INTO public.departments (name, description) VALUES
  ('Production', 'Kombucha brewing and production team'),
  ('Quality Control', 'QC checks and compliance'),
  ('Sales & Marketing', 'Sales, marketing, and social media'),
  ('Finance & Accounts', 'Billing, invoicing, and bookkeeping'),
  ('Operations', 'Logistics, inventory, and supply chain'),
  ('Admin & HR', 'Human resources and office admin')
ON CONFLICT (name) DO NOTHING;

-- ─── 2026 INDIAN HOLIDAYS (sample) ───────────────────
INSERT INTO public.holidays (name, holiday_date, scope) VALUES
  ('Republic Day', '2026-01-26', 'company'),
  ('Holi', '2026-03-04', 'company'),
  ('Good Friday', '2026-04-03', 'company'),
  ('Eid ul-Fitr', '2026-03-21', 'company'),
  ('Independence Day', '2026-08-15', 'company'),
  ('Janmashtami', '2026-08-25', 'company'),
  ('Gandhi Jayanti', '2026-10-02', 'company'),
  ('Dussehra', '2026-10-12', 'company'),
  ('Diwali', '2026-10-31', 'company'),
  ('Guru Nanak Jayanti', '2026-11-08', 'company'),
  ('Christmas', '2026-12-25', 'company')
ON CONFLICT DO NOTHING;

-- ============================================================
-- FIRST ADMIN SETUP INSTRUCTIONS:
-- ============================================================
-- After running this seed:
-- 1. Sign up a user in your app (or via Supabase Auth dashboard)
-- 2. Find the user's UUID in auth.users
-- 3. Run this to make them super_admin:
--
--    INSERT INTO public.user_roles (user_id, role_id)
--    SELECT '<YOUR-USER-UUID>', r.id
--    FROM public.roles r WHERE r.name = 'super_admin';
--
-- 4. Also give them admin role for redundancy:
--
--    INSERT INTO public.user_roles (user_id, role_id)
--    SELECT '<YOUR-USER-UUID>', r.id
--    FROM public.roles r WHERE r.name = 'admin';
-- ============================================================
