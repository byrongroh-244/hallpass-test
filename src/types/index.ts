export type ScheduleDay = 'red' | 'black'
export type StartType = 'regular' | 'late'

export interface Period {
  name: string
  startTime: string
  endTime: string
  students: string[]
}

export interface ScheduleConfig {
  red:   { regular: Period[]; late: Period[] }
  black: { regular: Period[]; late: Period[] }
}

export interface StudentRecord {
  name: string
  period: string
  schedule: string
  status: 'in' | 'out'
  timestamp: number
  outTimestamp: number | null
}

export interface LogEntry {
  studentName: string
  period: string
  schedule: string
  action: 'out' | 'in' | 'manual-in' | 'manual-out' | 'auto-reset' | 'stale-reset'
  timestamp: number
  date: string
  outTime: number | null
  inTime: number | null
  duration: number | null
}

export interface NormalizedLog {
  logId: string
  date: string
  period: string
  periodName: string
  schedule: string
  scheduleDay: ScheduleDay
  startType: StartType
  studentName: string
  action: LogEntry['action']
  timestamp: number
  duration: number
  outTime: number | null
  inTime: number | null
}
