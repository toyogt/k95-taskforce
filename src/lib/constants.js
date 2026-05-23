// ─── ROLES ────────────────────────────────────────────
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  PC: 'pc',
  MANAGER: 'manager',
  MD: 'md',
  DOER: 'doer',
}

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  pc: 'Process Coordinator',
  manager: 'Manager',
  md: 'Management',
  doer: 'Doer',
}

export const ROLE_COLORS = {
  super_admin: '#dc2626',
  admin: '#ea580c',
  pc: '#7c3aed',
  manager: '#2563eb',
  md: '#0891b2',
  doer: '#16a34a',
}

// ─── TASK STATUS ──────────────────────────────────────
export const TASK_STATUS = {
  PENDING: 'pending',
  DONE_ON_TIME: 'done_on_time',
  DONE_LATE: 'done_late',
  MISSED_LOCKED: 'missed_locked',
  HELP_RAISED: 'help_raised',
  PROTECTED_PENDING: 'protected_pending',
  REASSIGNED: 'reassigned',
  SKIPPED_APPROVED: 'skipped_approved',
  REOPENED: 'reopened',
  CANCELLED: 'cancelled',
}

export const STATUS_LABELS = {
  pending: 'Pending',
  done_on_time: 'Done On Time',
  done_late: 'Done Late',
  missed_locked: 'Missed',
  help_raised: 'Help Raised',
  protected_pending: 'Protected',
  reassigned: 'Reassigned',
  skipped_approved: 'Skipped',
  reopened: 'Reopened',
  cancelled: 'Cancelled',
}

export const STATUS_COLORS = {
  pending: '#f59e0b',
  done_on_time: '#16a34a',
  done_late: '#ea580c',
  missed_locked: '#dc2626',
  help_raised: '#7c3aed',
  protected_pending: '#6366f1',
  reassigned: '#0891b2',
  skipped_approved: '#6b7280',
  reopened: '#f97316',
  cancelled: '#9ca3af',
}

// ─── FREQUENCY ────────────────────────────────────────
export const FREQUENCY_TYPES = {
  DAILY: 'daily',
  WEEKLY_DAYS: 'weekly_days',
  MONTHLY_DATE: 'monthly_date',
  MONTHLY_NTH_WEEKDAY: 'monthly_nth_weekday',
  LAST_WEEKDAY: 'last_weekday_of_month',
  ONE_TIME: 'one_time',
}

export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
export const WEEKDAY_LABELS = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday',
  THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday'
}

// ─── ATTENDANCE ───────────────────────────────────────
export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LEAVE: 'leave',
  HALF_DAY: 'half_day',
}

// ─── TICKET TYPES ─────────────────────────────────────
export const TICKET_TYPES = {
  TASK_DETAIL_CHANGE: 'task_detail_change',
  TIME_CHANGE: 'time_change',
  FREQUENCY_CHANGE: 'frequency_change',
  REASSIGNMENT_REQUEST: 'reassignment_request',
  BLOCKED_TASK: 'blocked_task',
  TASK_DELETION_REQUEST: 'task_deletion_request',
  GENERAL_QUERY: 'general_query',
}

export const TICKET_TYPE_LABELS = {
  task_detail_change: 'Task Detail Change',
  time_change: 'Time Change',
  frequency_change: 'Frequency Change',
  reassignment_request: 'Reassignment Request',
  blocked_task: 'Blocked Task',
  task_deletion_request: 'Task Deletion',
  general_query: 'General Query',
}

export const TICKET_STATUS = {
  OPEN: 'open',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
}

// ─── SCORING ──────────────────────────────────────────
export const SCORE_POINTS = {
  DONE_ON_TIME: 100,
  DONE_LATE: 60,
  MISSED: 0,
}

// ─── REMINDER ─────────────────────────────────────────
export const REMINDER_TYPES = {
  MORNING: 'morning',
  NOON: 'noon',
  EVENING: 'evening',
  OVERDUE: 'overdue',
  MANUAL: 'manual',
}

export const REMINDER_TIMES = {
  morning: '10:30',
  noon: '14:30',
  evening: '17:00',
}

// ─── DEFAULT OFFICE TIMING ───────────────────────────
export const DEFAULT_OFFICE_START = '10:00'
export const DEFAULT_OFFICE_END = '18:00'

// ─── HOLIDAY SCOPE ────────────────────────────────────
export const HOLIDAY_SCOPE = {
  COMPANY: 'company',
  DEPARTMENT: 'department',
}

// ─── REASSIGNMENT TYPES ──────────────────────────────
export const REASSIGNMENT_TYPES = {
  SINGLE_TASK: 'single_task',
  SPECIFIC_DATE: 'specific_date',
  DATE_RANGE: 'date_range',
  PERMANENT: 'permanent',
}
