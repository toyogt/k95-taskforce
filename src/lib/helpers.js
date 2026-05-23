import { format, parseISO, isToday, isBefore, isAfter, addDays, subDays, 
  startOfMonth, endOfMonth, getDay, setDay, addWeeks, lastDayOfMonth,
  differenceInMinutes, startOfWeek, endOfWeek, isSameMonth, isSunday } from 'date-fns'

// ─── DATE HELPERS ─────────────────────────────────────

export function formatDate(d) {
  if (!d) return '—'
  return format(typeof d === 'string' ? parseISO(d) : d, 'dd MMM yyyy')
}

export function formatTime(t) {
  if (!t) return '—'
  const [h, m] = t.split(':')
  const hr = parseInt(h)
  const ampm = hr >= 12 ? 'PM' : 'AM'
  const h12 = hr % 12 || 12
  return `${h12}:${m} ${ampm}`
}

export function formatDateTime(d) {
  if (!d) return '—'
  return format(typeof d === 'string' ? parseISO(d) : d, 'dd MMM yyyy, hh:mm a')
}

export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function nowISO() {
  return new Date().toISOString()
}

// ─── HOLIDAY / SUNDAY CHECKS ──────────────────────────

export function isHolidayOrSunday(date, holidays = []) {
  if (isSunday(date)) return true
  const dateStr = format(date, 'yyyy-MM-dd')
  return holidays.some(h => h.holiday_date === dateStr)
}

export function findNextWorkingDay(date, holidays = []) {
  let next = addDays(date, 1)
  while (isHolidayOrSunday(next, holidays)) {
    next = addDays(next, 1)
  }
  return next
}

export function findPreviousWorkingDay(date, holidays = []) {
  let prev = subDays(date, 1)
  while (isHolidayOrSunday(prev, holidays)) {
    prev = subDays(prev, 1)
  }
  return prev
}

export function adjustForHoliday(date, holidays = []) {
  if (!isHolidayOrSunday(date, holidays)) return date
  const next = findNextWorkingDay(date, holidays)
  if (isSameMonth(date, next)) return next
  return findPreviousWorkingDay(date, holidays)
}

// ─── FREQUENCY ENGINE ─────────────────────────────────

export function generateDatesForMonth(year, month, freqType, freqConfig, holidays = []) {
  const dates = []
  const monthStart = startOfMonth(new Date(year, month - 1))
  const monthEnd = endOfMonth(monthStart)

  switch (freqType) {
    case 'daily': {
      let d = new Date(monthStart)
      while (d <= monthEnd) {
        if (!isSunday(d)) {
          const adjusted = adjustForHoliday(d, holidays)
          if (adjusted.getMonth() === month - 1) dates.push(format(adjusted, 'yyyy-MM-dd'))
        }
        d = addDays(d, 1)
      }
      break
    }
    case 'weekly_days': {
      const dayMap = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 }
      const days = freqConfig.days || []
      let d = new Date(monthStart)
      while (d <= monthEnd) {
        const dayName = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][getDay(d)]
        if (days.includes(dayName)) {
          const adjusted = adjustForHoliday(d, holidays)
          if (adjusted.getMonth() === month - 1) dates.push(format(adjusted, 'yyyy-MM-dd'))
        }
        d = addDays(d, 1)
      }
      break
    }
    case 'monthly_date': {
      const dayOfMonth = freqConfig.day_of_month || 1
      const target = new Date(year, month - 1, Math.min(dayOfMonth, monthEnd.getDate()))
      const adjusted = adjustForHoliday(target, holidays)
      if (adjusted.getMonth() === month - 1) dates.push(format(adjusted, 'yyyy-MM-dd'))
      break
    }
    case 'monthly_nth_weekday': {
      const nth = freqConfig.nth || 1
      const weekday = freqConfig.weekday || 'MON'
      const dayMap = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 }
      const targetDay = dayMap[weekday]
      
      let first = new Date(monthStart)
      while (getDay(first) !== targetDay) first = addDays(first, 1)
      const target = addWeeks(first, nth - 1)
      
      if (target <= monthEnd) {
        const adjusted = adjustForHoliday(target, holidays)
        if (adjusted.getMonth() === month - 1) dates.push(format(adjusted, 'yyyy-MM-dd'))
      }
      break
    }
    case 'last_weekday_of_month': {
      const weekday = freqConfig.weekday || 'FRI'
      const dayMap = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 }
      const targetDay = dayMap[weekday]
      
      let d = new Date(monthEnd)
      while (getDay(d) !== targetDay) d = subDays(d, 1)
      const adjusted = adjustForHoliday(d, holidays)
      if (adjusted.getMonth() === month - 1) dates.push(format(adjusted, 'yyyy-MM-dd'))
      break
    }
    case 'one_time': {
      if (freqConfig.date) {
        const target = parseISO(freqConfig.date)
        if (target >= monthStart && target <= monthEnd) {
          const adjusted = adjustForHoliday(target, holidays)
          if (adjusted.getMonth() === month - 1) dates.push(format(adjusted, 'yyyy-MM-dd'))
        }
      }
      break
    }
  }

  return [...new Set(dates)].sort()
}

// ─── SCORE CALC ───────────────────────────────────────

export function calcScore(tasks) {
  let earned = 0, possible = 0
  tasks.forEach(t => {
    if (t.is_score_excluded || t.status === 'skipped_approved' || t.status === 'protected_pending' || t.status === 'cancelled') return
    if (t.status === 'done_on_time') { earned += 100; possible += 100 }
    else if (t.status === 'done_late') { earned += 60; possible += 100 }
    else if (t.status === 'missed_locked') { earned += 0; possible += 100 }
    else if (t.status === 'pending' || t.status === 'reopened') { possible += 100 }
  })
  return { earned, possible, pct: possible > 0 ? Math.round((earned / possible) * 100) : 0 }
}

// ─── MISC HELPERS ─────────────────────────────────────

export function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function truncate(str, len = 50) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}

export function classNames(...args) {
  return args.filter(Boolean).join(' ')
}
