// Supabase Edge Function: Send Task Reminders via Brevo (Sendinblue)
// Cron: 10:30 AM, 2:30 PM, 5:00 PM IST
// Sends email reminders for pending tasks

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
const BREVO_SENDER_EMAIL = Deno.env.get('BREVO_SENDER_EMAIL') || 'noreply@brevo.com'
const BREVO_SENDER_NAME = Deno.env.get('BREVO_SENDER_NAME') || 'K95 TaskForce'

async function sendBrevoEmail(to: string, toName: string, subject: string, htmlContent: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Brevo error: ${res.status} ${err}`)
  }
  return res.json()
}

Deno.serve(async (req) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0]

    // Determine reminder type from hour (IST = UTC+5:30)
    const nowUTC = new Date()
    const istHour = (nowUTC.getUTCHours() + 5 + Math.floor((nowUTC.getUTCMinutes() + 30) / 60)) % 24
    let reminderType = 'manual'
    if (istHour >= 10 && istHour < 12) reminderType = 'morning'
    else if (istHour >= 14 && istHour < 16) reminderType = 'noon'
    else if (istHour >= 16 && istHour < 18) reminderType = 'evening'

    // Or accept type from body
    try {
      const body = await req.json()
      if (body.reminder_type) reminderType = body.reminder_type
    } catch {}

    // Get all pending tasks for today
    const { data: tasks, error: tErr } = await supabase
      .from('task_instances')
      .select(`
        id, due_time, status,
        task_template:task_template_id (title),
        assigned_user:assigned_to (id, full_name, email)
      `)
      .eq('due_date', todayStr)
      .in('status', ['pending', 'reopened'])

    if (tErr) throw tErr

    // Group by user
    const userTasks: Record<string, { name: string; email: string; userId: string; tasks: any[] }> = {}
    for (const t of tasks || []) {
      const u = t.assigned_user
      if (!u?.email) continue
      if (!userTasks[u.id]) {
        userTasks[u.id] = { name: u.full_name, email: u.email, userId: u.id, tasks: [] }
      }
      userTasks[u.id].tasks.push(t)
    }

    let sent = 0, failed = 0
    const errors: string[] = []

    for (const [userId, data] of Object.entries(userTasks)) {
      if (data.tasks.length === 0) continue

      const taskList = data.tasks
        .map(t => `<li><strong>${t.task_template?.title || 'Task'}</strong> — Due by ${t.due_time || '6:00 PM'}</li>`)
        .join('')

      const subject = reminderType === 'evening'
        ? `⚠️ ${data.tasks.length} task(s) pending — Complete before EOD!`
        : `📋 You have ${data.tasks.length} pending task(s) for today`

      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <h2 style="color:#6366f1;">K95 TaskForce — ${reminderType.charAt(0).toUpperCase() + reminderType.slice(1)} Reminder</h2>
          <p>Hi ${data.name},</p>
          <p>You have <strong>${data.tasks.length}</strong> pending task(s) for today:</p>
          <ul>${taskList}</ul>
          <p>${reminderType === 'evening'
            ? '⏰ <strong>Tasks will be locked at 6:00 PM. Complete them now!</strong>'
            : 'Please complete them before end of day.'
          }</p>
          <p><a href="https://k95foods.com/taskforce/my-tasks" 
            style="display:inline-block;padding:10px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;">
            Open TaskForce
          </a></p>
          <p style="color:#888;font-size:12px;">— K95 TaskForce System</p>
        </div>
      `

      try {
        await sendBrevoEmail(data.email, data.name, subject, html)

        await supabase.from('reminder_logs').insert({
          user_id: userId,
          reminder_type: reminderType,
          channel: 'email',
          task_instance_ids: data.tasks.map(t => t.id),
          status: 'sent',
        })
        sent++
      } catch (e) {
        errors.push(`${data.email}: ${e.message}`)
        await supabase.from('reminder_logs').insert({
          user_id: userId,
          reminder_type: reminderType,
          channel: 'email',
          task_instance_ids: data.tasks.map(t => t.id),
          status: 'failed',
          error_message: e.message,
        })
        failed++
      }
    }

    return new Response(JSON.stringify({ sent, failed, errors, reminderType }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
