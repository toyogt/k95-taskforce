// Supabase Edge Function: Lock Missed Tasks & Calculate Daily Scores
// Cron: 6:00 PM - 7:00 PM IST (run at 6:30 PM)
// Locks pending tasks as missed_locked, then calculates daily scores

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0]

    // ─── STEP 1: Lock all pending tasks as missed ───
    const { data: pendingTasks, error: pErr } = await supabase
      .from('task_instances')
      .select('id, assigned_to')
      .eq('due_date', todayStr)
      .in('status', ['pending', 'reopened'])

    if (pErr) throw pErr

    let locked = 0
    for (const task of pendingTasks || []) {
      const { error } = await supabase
        .from('task_instances')
        .update({
          status: 'missed_locked',
          locked_at: new Date().toISOString(),
          locked_by: 'system',
        })
        .eq('id', task.id)
      if (!error) locked++
    }

    // ─── STEP 2: Calculate daily scores per user ───
    const { data: allTasks, error: aErr } = await supabase
      .from('task_instances')
      .select('id, assigned_to, status, is_score_excluded')
      .eq('due_date', todayStr)

    if (aErr) throw aErr

    const userScores: Record<string, {
      total: number; done_on_time: number; done_late: number;
      missed: number; excluded: number; earned: number; possible: number;
    }> = {}

    for (const t of allTasks || []) {
      const uid = t.assigned_to
      if (!userScores[uid]) {
        userScores[uid] = { total: 0, done_on_time: 0, done_late: 0, missed: 0, excluded: 0, earned: 0, possible: 0 }
      }
      const s = userScores[uid]
      s.total++

      if (t.is_score_excluded || ['skipped_approved', 'protected_pending', 'cancelled'].includes(t.status)) {
        s.excluded++
        continue
      }

      if (t.status === 'done_on_time') { s.done_on_time++; s.earned += 100; s.possible += 100 }
      else if (t.status === 'done_late') { s.done_late++; s.earned += 60; s.possible += 100 }
      else if (t.status === 'missed_locked') { s.missed++; s.possible += 100 }
      else { s.possible += 100 } // pending/reopened shouldn't exist after locking, but safety
    }

    let scored = 0
    for (const [userId, sc] of Object.entries(userScores)) {
      const pct = sc.possible > 0 ? Math.round((sc.earned / sc.possible) * 100 * 100) / 100 : 0

      const { error } = await supabase
        .from('score_logs')
        .upsert({
          user_id: userId,
          date: todayStr,
          total_tasks: sc.total,
          done_on_time: sc.done_on_time,
          done_late: sc.done_late,
          missed: sc.missed,
          excluded: sc.excluded,
          earned_score: sc.earned,
          possible_score: sc.possible,
          percentage: pct,
          calculated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,date' })

      if (!error) scored++
    }

    // Audit
    await supabase.from('audit_logs').insert({
      action: 'lock_tasks_and_score',
      entity_type: 'system',
      new_value: { locked, scored, date: todayStr }
    })

    return new Response(JSON.stringify({ locked, scored, date: todayStr }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
