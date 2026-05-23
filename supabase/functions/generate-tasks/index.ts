// Supabase Edge Function: Generate Task Instances
// Cron: 8:30 AM IST daily
// Creates task_instances from active task_templates for today

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  try {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][today.getDay()]
    const dayOfMonth = today.getDate()
    const isSunday = today.getDay() === 0

    // Skip Sundays
    if (isSunday) {
      return new Response(JSON.stringify({ message: 'Sunday — skipped', created: 0 }))
    }

    // Check if today is a company holiday
    const { data: holidays } = await supabase
      .from('holidays')
      .select('*')
      .eq('holiday_date', todayStr)
      .eq('scope', 'company')

    if (holidays && holidays.length > 0) {
      return new Response(JSON.stringify({ message: 'Company holiday — skipped', created: 0 }))
    }

    // Get active templates
    const { data: templates, error: tErr } = await supabase
      .from('task_templates')
      .select('*')
      .eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${todayStr}`)
      .or(`end_date.is.null,end_date.gte.${todayStr}`)

    if (tErr) throw tErr

    let created = 0
    const errors: string[] = []

    for (const tmpl of templates || []) {
      try {
        // Check if this template should generate today based on frequency
        let shouldGenerate = false
        const config = tmpl.frequency_config || {}

        switch (tmpl.frequency_type) {
          case 'daily':
            shouldGenerate = true
            break
          case 'weekly_days':
            shouldGenerate = (config.days || []).includes(dayOfWeek)
            break
          case 'monthly_date':
            shouldGenerate = dayOfMonth === (config.day_of_month || 1)
            break
          case 'monthly_nth_weekday': {
            const nth = config.nth || 1
            const targetDay = config.weekday || 'MON'
            if (dayOfWeek === targetDay) {
              const weekNum = Math.ceil(dayOfMonth / 7)
              shouldGenerate = weekNum === nth
            }
            break
          }
          case 'last_weekday_of_month': {
            const targetDay = config.weekday || 'FRI'
            if (dayOfWeek === targetDay) {
              const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
              shouldGenerate = dayOfMonth + 7 > lastDay
            }
            break
          }
          case 'one_time':
            shouldGenerate = config.date === todayStr
            break
        }

        if (!shouldGenerate) continue

        // Check department-specific holiday
        if (tmpl.department_id && tmpl.respect_holidays) {
          const { data: deptHolidays } = await supabase
            .from('holidays')
            .select('id')
            .eq('holiday_date', todayStr)
            .eq('scope', 'department')
            .eq('department_id', tmpl.department_id)

          if (deptHolidays && deptHolidays.length > 0) continue
        }

        const assignedTo = tmpl.default_assigned_to
        if (!assignedTo) {
          errors.push(`Template ${tmpl.id} has no assigned user`)
          continue
        }

        // Check if user is on leave
        const { data: attendance } = await supabase
          .from('attendance')
          .select('status')
          .eq('user_id', assignedTo)
          .eq('date', todayStr)
          .single()

        if (attendance && ['absent', 'leave'].includes(attendance.status)) {
          // Check for active reassignment
          const { data: reassignment } = await supabase
            .from('reassignments')
            .select('to_user_id')
            .eq('from_user_id', assignedTo)
            .eq('task_template_id', tmpl.id)
            .lte('from_date', todayStr)
            .gte('to_date', todayStr)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          const finalAssignee = reassignment?.to_user_id || assignedTo

          // Upsert to avoid duplicates
          const { error: iErr } = await supabase
            .from('task_instances')
            .upsert({
              task_template_id: tmpl.id,
              assigned_to: finalAssignee,
              due_date: todayStr,
              due_time: tmpl.due_time || '18:00',
              status: reassignment ? 'reassigned' : 'pending',
            }, { onConflict: 'task_template_id,assigned_to,due_date' })

          if (iErr) errors.push(`Template ${tmpl.id}: ${iErr.message}`)
          else created++
          continue
        }

        // Normal creation
        const { error: iErr } = await supabase
          .from('task_instances')
          .upsert({
            task_template_id: tmpl.id,
            assigned_to: assignedTo,
            due_date: todayStr,
            due_time: tmpl.due_time || '18:00',
            status: 'pending',
          }, { onConflict: 'task_template_id,assigned_to,due_date' })

        if (iErr) errors.push(`Template ${tmpl.id}: ${iErr.message}`)
        else created++

      } catch (e) {
        errors.push(`Template ${tmpl.id}: ${e.message}`)
      }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      action: 'generate_tasks',
      entity_type: 'system',
      new_value: { created, errors, date: todayStr }
    })

    return new Response(JSON.stringify({ created, errors, date: todayStr }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
