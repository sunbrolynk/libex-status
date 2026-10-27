import { MaintenanceConfig, MonitorState, MonitorTarget } from '@/types/config'

export type Level = 'up' | 'minor' | 'major' | 'down' | 'none'
export type Status = 'up' | 'down' | 'maintenance'
export type Overall = 'up' | 'partial' | 'down'

export type Day = {
  start: number
  level: Level
  pct: number | null
  downSec: number
  notes: string[]
}

export type MonitorView = {
  id: string
  name: string
  link?: string
  tooltip?: string
  hideLatencyChart?: boolean
  status: Status
  uptime: number
  latest: number | null
  avg: number | null
  days: Day[]
  downSince?: number
  error?: string
}

export type Notice = {
  kind: 'incident' | 'maintenance'
  title: string
  body?: string
  monitorIds: string[]
  monitors: string[]
  start: number
  end: number | null
}

export type Model = {
  monitors: MonitorView[]
  overall: Overall
  headline: string
  upCount: number
  notices: Notice[]
  recent: Notice[]
  updated: number
}

const DAY = 86400
const overlap = (a1: number, a2: number, b1: number, b2: number) =>
  Math.max(0, Math.min(a2, b2) - Math.max(a1, b1))

export function levelOf(pct: number | null): Level {
  if (pct === null) return 'none'
  if (pct >= 99.9) return 'up'
  if (pct >= 99) return 'minor'
  if (pct >= 95) return 'major'
  return 'down'
}

export function duration(sec: number) {
  const m = Math.max(1, Math.round(sec / 60))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
  return h % 24 ? `${Math.floor(h / 24)} d ${h % 24} h` : `${Math.floor(h / 24)} d`
}

export const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
export const dayLabel = (ms: number) =>
  new Date(ms).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })

export function describeDay(d: Day) {
  const when = dayLabel(d.start * 1000)
  if (d.pct === null) return `${when}: not monitored yet`
  if (d.downSec === 0) return `${when}: no downtime`
  return `${when}: ${d.pct.toFixed(2)}% up, down ${duration(d.downSec)}`
}

export function maintenanceNotice(m: MaintenanceConfig, monitors: MonitorTarget[]): Notice {
  return {
    kind: 'maintenance',
    title: m.title ?? 'Scheduled maintenance',
    body: m.body,
    monitorIds: m.monitors ?? [],
    monitors: (m.monitors ?? []).map((id) => monitors.find((t) => t.id === id)?.name ?? id),
    start: new Date(m.start).getTime(),
    end: m.end ? new Date(m.end).getTime() : null,
  }
}

export function buildModel(
  state: MonitorState,
  monitors: MonitorTarget[],
  maintenances: MaintenanceConfig[],
  nowMs = Date.now()
): Model {
  const now = Math.round(nowMs / 1000)
  const midnight = new Date(nowMs)
  midnight.setHours(0, 0, 0, 0)
  const today = Math.round(midnight.getTime() / 1000)

  const active = maintenances.filter(
    (m) => nowMs >= new Date(m.start).getTime() && (!m.end || nowMs <= new Date(m.end).getTime())
  )
  const resting = new Set(active.flatMap((m) => m.monitors ?? []))

  const views: MonitorView[] = monitors
    .filter((m) => state.incident[m.id]?.length && state.latency[m.id])
    .map((m) => {
      const incidents = state.incident[m.id]
      const born = incidents[0].start[0]
      const days: Day[] = []
      for (let i = 89; i >= 0; i--) {
        const start = today - i * DAY
        const end = start + DAY
        const watched = overlap(start, end, born, now)
        let downSec = 0
        const notes: string[] = []
        for (const inc of incidents) {
          if (inc.error[0] === 'dummy') continue
          const o = overlap(start, end, inc.start[0], inc.end ?? now)
          downSec += o
          if (o > 0) notes.push(inc.error[inc.error.length - 1])
        }
        const pct = watched > 0 ? ((watched - downSec) / watched) * 100 : null
        days.push({ start, level: levelOf(pct), pct, downSec, notes })
      }
      let down = 0
      for (const inc of incidents)
        if (inc.error[0] !== 'dummy') down += (inc.end ?? now) - inc.start[0]
      const last = incidents[incidents.length - 1]
      const isDown = last.end === null
      const pings = state.latency[m.id].map((p) => p.ping).filter((p) => p > 0)
      return {
        id: m.id,
        name: m.name,
        link: m.statusPageLink,
        tooltip: m.tooltip,
        hideLatencyChart: m.hideLatencyChart,
        status: resting.has(m.id) ? 'maintenance' : isDown ? 'down' : 'up',
        uptime: Math.floor(((now - born - down) / (now - born)) * 10000) / 100,
        latest: isDown ? null : pings[pings.length - 1] ?? null,
        avg: pings.length ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : null,
        days,
        downSince: isDown ? last.start[0] * 1000 : undefined,
        error: isDown ? last.error[last.error.length - 1] : undefined,
      }
    })

  const outages = outageNotices(state, monitors)
  const planned = maintenances
    .filter((m) => !m.end || new Date(m.end).getTime() >= nowMs)
    .map((m) => maintenanceNotice(m, monitors))

  const downCount = views.filter((v) => v.status === 'down').length
  const overall: Overall = downCount === 0 ? 'up' : downCount === views.length ? 'down' : 'partial'
  return {
    monitors: views,
    overall,
    headline:
      overall === 'up'
        ? 'All systems operational'
        : overall === 'down'
        ? 'Major outage'
        : 'Partial outage',
    upCount: views.length - downCount,
    notices: [...outages.filter((o) => o.end === null), ...planned],
    recent: outages.filter((o) => o.end !== null && nowMs - o.end < 30 * DAY * 1000).slice(0, 4),
    updated: state.lastUpdate * 1000,
  }
}

// Every finished or open outage in the monitor state, newest first
export function outageNotices(state: MonitorState, monitors: MonitorTarget[]): Notice[] {
  const out: Notice[] = []
  for (const m of monitors) {
    for (const inc of state.incident[m.id] ?? []) {
      if (inc.error[0] === 'dummy') continue
      out.push({
        kind: 'incident',
        title: `${m.name} unreachable`,
        body: inc.error[inc.error.length - 1],
        monitorIds: [m.id],
        monitors: [m.name],
        start: inc.start[0] * 1000,
        end: inc.end === null ? null : inc.end * 1000,
      })
    }
  }
  return out.sort((a, b) => b.start - a.start)
}

export const ago = (ms: number) => `${duration(Math.max(60, (Date.now() - ms) / 1000))} ago`

export function noticeWhen(n: Notice) {
  const sameDay = n.end !== null && dayLabel(n.end) === dayLabel(n.start)
  const until =
    n.end === null
      ? ', until further notice'
      : `–${sameDay ? '' : `${dayLabel(n.end)}, `}${clock(n.end)}`
  const span = `${dayLabel(n.start)}, ${clock(n.start)}${until}`
  if (n.kind === 'incident') {
    if (n.end === null) return `Ongoing for ${duration((Date.now() - n.start) / 1000)}`
    return `${span} · lasted ${duration((n.end - n.start) / 1000)}`
  }
  if (n.start > Date.now()) return `Planned for ${span}`
  return n.end !== null && n.end < Date.now() ? span : `In progress since ${clock(n.start)}`
}
