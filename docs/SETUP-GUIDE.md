# K95 TaskForce — Complete Setup Guide

## Prerequisites
- Node.js 18+ installed
- A Supabase account (free tier works)
- A Brevo account (free tier — 300 emails/day)
- Your GoDaddy hosting (for k95foods.com/taskforce)

---

## Step 1: Create Supabase Project

1. Go to https://supabase.com → **New Project**
2. Choose org, name it **k95-taskforce**, set a strong DB password, pick **ap-south-1 (Mumbai)** region
3. Wait for project to provision (~2 min)
4. Go to **Settings → API** and copy:
   - **Project URL** (e.g., `https://abc123.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

## Step 2: Run Database Migration

1. In Supabase dashboard → **SQL Editor**
2. Click **New Query**
3. Paste the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Click **Run** — should complete with no errors
5. Create another query, paste `supabase/seed/seed.sql`, and run it

## Step 3: Configure Supabase Auth

1. Go to **Authentication → Providers**
2. **Email** should be enabled by default
3. Under **Email Templates**, customize:
   - Confirm signup: change site name to "K95 TaskForce"
   - Reset password: update redirect URL to `https://k95foods.com/taskforce/login`
4. Go to **Authentication → URL Configuration**:
   - Site URL: `https://k95foods.com/taskforce`
   - Redirect URLs: add `https://k95foods.com/taskforce/**`

## Step 4: Set Up Brevo (Free Email)

1. Go to https://www.brevo.com → Sign up (free)
2. Free tier gives you **300 emails/day** — enough for reminders
3. Emails will send FROM Brevo's domain (e.g., `noreply@smtp-brevo.com`)
4. Go to **SMTP & API → API Keys** → Generate a new key
5. Copy the API key

## Step 5: Configure Edge Function Secrets

In Supabase dashboard → **Edge Functions → Secrets**, add:

| Secret Name | Value |
|---|---|
| `BREVO_API_KEY` | Your Brevo API key |
| `BREVO_SENDER_EMAIL` | `noreply@smtp-brevo.com` (Brevo's default) |
| `BREVO_SENDER_NAME` | `K95 TaskForce` |

## Step 6: Deploy Edge Functions

Install Supabase CLI if not already:
```bash
npm install -g supabase
```

Link your project:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Deploy each function:
```bash
supabase functions deploy generate-tasks
supabase functions deploy send-reminders
supabase functions deploy lock-tasks
```

## Step 7: Set Up Cron Jobs

In Supabase dashboard → **SQL Editor**, run:

```sql
-- Install pg_cron extension (if not already)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 8:30 AM IST (3:00 AM UTC) — Generate daily tasks
SELECT cron.schedule(
  'generate-daily-tasks',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/generate-tasks',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  )$$
);

-- 10:30 AM IST (5:00 AM UTC) — Morning reminder
SELECT cron.schedule(
  'morning-reminder',
  '0 5 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/send-reminders',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{"reminder_type": "morning"}'::jsonb
  )$$
);

-- 2:30 PM IST (9:00 AM UTC) — Noon reminder
SELECT cron.schedule(
  'noon-reminder',
  '0 9 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/send-reminders',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{"reminder_type": "noon"}'::jsonb
  )$$
);

-- 5:00 PM IST (11:30 AM UTC) — Evening reminder
SELECT cron.schedule(
  'evening-reminder',
  '30 11 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/send-reminders',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{"reminder_type": "evening"}'::jsonb
  )$$
);

-- 6:30 PM IST (1:00 PM UTC) — Lock tasks + calculate scores
SELECT cron.schedule(
  'lock-and-score',
  '0 13 * * 1-6',
  $$SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/lock-tasks',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb
  )$$
);
```

**Replace** `YOUR_PROJECT` and `YOUR_ANON_KEY` with your actual values.

## Step 8: Build & Deploy the App

```bash
# Clone/copy the project
cd k95-taskforce

# Create .env file
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# Install dependencies
npm install

# Build for production
npm run build
```

This creates a `dist/` folder.

### Deploy to GoDaddy (k95foods.com/taskforce):

1. Connect to your GoDaddy hosting via **File Manager** or **FTP/SFTP**
2. Navigate to `public_html/`
3. Create a folder called `taskforce/`
4. Upload the entire contents of `dist/` into `taskforce/`
5. Create an `.htaccess` file inside `taskforce/` with:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /taskforce/
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /taskforce/index.html [L]
</IfModule>
```

This ensures React Router works with clean URLs.

## Step 9: Create Your First Admin User

1. Open `https://k95foods.com/taskforce/signup`
2. Sign up with your email
3. Go to Supabase → **Table Editor → auth.users** → copy your UUID
4. Go to **SQL Editor** and run:

```sql
-- Make yourself super_admin + admin
INSERT INTO public.user_roles (user_id, role_id)
SELECT 'YOUR-UUID-HERE', r.id
FROM public.roles r WHERE r.name IN ('super_admin', 'admin');
```

5. Refresh the app — you should now see Admin sidebar links

## Step 10: Add Users & Templates

1. **Admin → Users**: Add team members (or let them self-signup if enabled)
2. **Admin → Departments**: Verify/edit departments
3. **Admin → Task Templates**: Create your daily/weekly/monthly tasks
4. **Admin → Holidays**: Verify 2026 holidays, add any more

---

## PWA Installation

The app is a PWA. On mobile:
- **Android Chrome**: Tap menu → "Add to Home Screen"
- **iOS Safari**: Tap Share → "Add to Home Screen"

The app will work offline for viewing cached data.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Login fails | Check Supabase Auth settings, ensure email provider is enabled |
| Tasks not generating | Check cron jobs in pg_cron, verify edge function logs |
| Emails not sending | Verify Brevo API key in Supabase secrets, check Brevo dashboard for errors |
| 404 on page refresh | Ensure .htaccess is in taskforce/ folder |
| RLS errors | Make sure user has correct roles in user_roles table |
