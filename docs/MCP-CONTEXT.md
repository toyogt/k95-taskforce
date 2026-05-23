# K95 TaskForce — MCP Context

## Project Overview
K95 TaskForce is a Progressive Web App (PWA) for daily accountability and task management at K95 Foods, a kombucha company. It replaces a legacy system built on Google Sheets + Apps Script + Looker Studio + Google Forms.

**Live URL:** https://k95foods.com/taskforce
**Company Site:** https://k95foods.com

## Tech Stack
- **Frontend:** React 18 + Vite, deployed as static files to GoDaddy shared hosting
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions + RLS + pg_cron)
- **Email:** Brevo (Sendinblue) free tier — sends from Brevo's domain
- **Hosting:** GoDaddy (subdirectory `/taskforce/`)
- **PWA:** vite-plugin-pwa, installable on mobile

## Architecture
- React SPA with `react-router-dom` (basename `/taskforce`)
- Supabase client-side SDK for all data operations
- Row Level Security (RLS) on every table
- Three Supabase Edge Functions triggered by pg_cron:
  1. `generate-tasks` — 8:30 AM IST: creates daily task instances from templates
  2. `send-reminders` — 10:30 AM, 2:30 PM, 5:00 PM IST: Brevo email reminders
  3. `lock-tasks` — 6:30 PM IST: locks missed tasks, calculates daily scores

## Key Design Decisions
- **Multi-role users:** A user can hold multiple roles (doer, pc, manager, admin, md, super_admin)
- **Office hours priority:** Task → User → Role → Department → Company (default 10AM–6PM IST)
- **Holiday logic:** Tasks on holidays/Sundays move to next working day; if that crosses month boundary, move to previous working day instead
- **Frequency types:** daily, weekly, monthly_date, monthly_weekday, nth_weekday, specific_dates
- **Scoring:** 100 (on time), 60 (late), 0 (missed)
- **Task statuses:** pending, done_on_time, done_late, missed_locked, help_raised, protected_pending, reassigned, skipped_approved, reopened, cancelled

## Database (22 tables)
Core: profiles, roles, user_roles, departments, holidays, office_time_rules, task_templates, task_instances, task_attachments, help_tickets, ticket_comments, attendance, reassignments, score_logs, reminder_logs, audit_logs, system_settings

## File Structure
```
k95-taskforce/
├── src/
│   ├── components/auth/   — ProtectedRoute
│   ├── components/layout/ — Sidebar, AppLayout
│   ├── contexts/          — AuthContext (session, profile, roles)
│   ├── lib/               — supabase.js, constants.js, helpers.js
│   ├── pages/auth/        — Login, Signup, ForgotPassword
│   ├── pages/doer/        — MyTasks, MyScore, HelpTickets
│   ├── pages/pc/          — PCDashboard, Attendance, Reassignments
│   ├── pages/admin/       — Dashboard, Users, Depts, Templates, Holidays, AuditLogs
│   ├── pages/md/          — MDDashboard
│   └── styles/global.css  — Dark theme, DM Sans font
├── supabase/
│   ├── migrations/001_initial_schema.sql (502 lines)
│   ├── seed/seed.sql
│   └── functions/{generate-tasks,send-reminders,lock-tasks}/index.ts
├── docs/SETUP-GUIDE.md
└── public/ — PWA manifest, icons
```

## Release Phases
- **Release 1 (current):** Core accountability — tasks, templates, frequency engine, scoring, attendance, help tickets, dashboards, email reminders
- **Release 2 (planned):** WhatsApp integration, personal vault (encrypted passwords), bond scores, streaks, badges
- **Release 3 (planned):** AI-powered features

## Related Projects
- **K95 Batch Lifecycle Management System** — separate Supabase project for production batch tracking

## Development Notes
- Dark theme with indigo/violet accent (#6366f1 / #8b5cf6)
- Font: DM Sans (Google Fonts)
- All times are IST; cron jobs configured in UTC
- Supabase region: ap-south-1 (Mumbai)
- `.htaccess` required in GoDaddy for SPA routing
