# K95 TaskForce

Daily accountability and task management PWA for K95 Foods.

## Features

- **Task Templates & Instances** — Create recurring tasks with flexible frequency (daily, weekly, monthly, nth weekday, specific dates). Tasks auto-generate each morning via cron.
- **Smart Holiday Logic** — Tasks falling on holidays/Sundays automatically shift to the next working day. If that crosses a month boundary, they shift to the previous working day instead.
- **Multi-Role Access** — Users can hold multiple roles: Doer, PC (Process Controller), Manager, Admin, MD, Super Admin. Each role sees a tailored dashboard.
- **Scoring System** — Automatic scoring: 100 for on-time completion, 60 for late, 0 for missed. Daily/weekly/monthly score tracking per user and department.
- **Help Tickets** — Doers can raise help tickets on tasks, which PCs can resolve, escalate, or reassign.
- **Attendance Tracking** — Daily attendance marking with leave types and impact on task generation.
- **Email Reminders** — Automated reminders at 10:30 AM, 2:30 PM, and 5:00 PM via Brevo (free tier).
- **PWA** — Installable on mobile, works offline for cached data.

## Tech Stack

- React 18 + Vite (frontend)
- Supabase (database, auth, edge functions, RLS)
- Brevo (email delivery)
- GoDaddy shared hosting (static deployment)

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your Supabase credentials
npm run dev
```

## Deployment

See [docs/SETUP-GUIDE.md](docs/SETUP-GUIDE.md) for the complete 10-step setup guide covering Supabase project creation, database migration, auth configuration, Brevo setup, edge function deployment, cron scheduling, and GoDaddy deployment.

## Project Structure

```
src/
├── components/   — Auth guards, layout (sidebar, app shell)
├── contexts/     — AuthContext with multi-role support
├── lib/          — Supabase client, constants, helpers
├── pages/        — Role-based pages (auth, doer, pc, admin, md)
└── styles/       — Dark theme CSS

supabase/
├── migrations/   — Database schema (22 tables, RLS, triggers)
├── seed/         — Default roles, settings, departments, holidays
└── functions/    — Edge functions (generate-tasks, send-reminders, lock-tasks)
```

## License

Private — K95 Foods internal use only.
