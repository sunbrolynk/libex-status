import { useState } from 'react'
import { LatencyRecord } from '@/types/config'
import { codeToCountry } from '@/util/iata'
import { Day, Status, clock, describeDay } from '@/util/libex'

const paths = {
  up: 'M5 12.5l4.2 4.2L19 7',
  down: 'M7 7l10 10M17 7L7 17',
  maintenance:
    'M14.7 6.3a4 4 0 0 0-5.4 5.1L4 16.7 7.3 20l5.3-5.3a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
  sun: 'M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  moon: 'M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z',
}

export function Icon({ name, size = 16 }: { name: keyof typeof paths; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}

export const STATUS_WORD: Record<Status, string> = {
  up: 'Operational',
  down: 'Down',
  maintenance: 'Maintenance',
}

export function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="lx-theme"
      onClick={onToggle}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
    </button>
  )
}

// 90 days as one keyboard- and pointer-scrubbable strip, styled through .lx-days and its <i> cells.
export function DayBars({ days, label }: { days: Day[]; label: string }) {
  const [active, setActive] = useState<number | null>(null)
  const rough = days.filter((d) => d.downSec > 0).length
  const summary =
    rough === 0
      ? 'No downtime in 90 days'
      : `${rough} ${rough === 1 ? 'day' : 'days'} with downtime in 90 days`
  const pick = (x: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    setActive(
      Math.min(days.length - 1, Math.max(0, Math.floor(((x - r.left) / r.width) * days.length)))
    )
  }
  const day = active === null ? null : days[active]
  return (
    <div className="lx-daywrap">
      <div
        className="lx-days"
        role="group"
        tabIndex={0}
        aria-label={`${label}, ${summary}. Use the arrow keys to read each day.`}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
        onPointerLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setActive(Math.max(0, (active ?? days.length) - 1))
          else if (e.key === 'ArrowRight')
            setActive(Math.min(days.length - 1, (active ?? days.length - 2) + 1))
          else if (e.key === 'Escape') setActive(null)
          else return
          e.preventDefault()
        }}
      >
        {days.map((d, i) => (
          <i
            key={d.start}
            data-level={d.level}
            data-active={i === active || undefined}
            style={{ ['--pct' as string]: d.pct === null ? 0 : d.pct / 100 }}
          />
        ))}
      </div>
      {day && (
        <div
          className="lx-tip"
          role="status"
          style={{ ['--x' as string]: `${((active as number) + 0.5) / days.length}` }}
        >
          <strong>{describeDay(day).split(': ')[0]}</strong>
          <span>{describeDay(day).split(': ')[1]}</span>
          {day.notes.slice(0, 2).map((n, i) => (
            <span key={i} className="lx-tip-note">
              {n}
            </span>
          ))}
        </div>
      )}
      <span className="lx-sr" aria-live="polite">
        {day ? describeDay(day) : ''}
      </span>
    </div>
  )
}

// Last 12 hours of response time as an inline SVG trace.
export function Latency({ points, name }: { points: LatencyRecord[]; name: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 640
  const H = 120
  const pings = points.map((p) => p.ping)
  const max = Math.max(1, ...pings)
  const valid = pings.filter((p) => p > 0)
  const avg = valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : 0
  const sorted = [...valid].sort((a, b) => a - b)
  const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 0
  const x = (i: number) => (i / Math.max(1, points.length - 1)) * W
  const y = (p: number) => H - 6 - (p / max) * (H - 16)
  const line = points
    .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.ping).toFixed(1)}`)
    .join('')
  const pt = hover === null ? null : points[hover]
  return (
    <div className="lx-lat">
      <dl className="lx-lat-stats">
        <div>
          <dt>Average</dt>
          <dd>{avg} ms</dd>
        </div>
        <div>
          <dt>95th pct</dt>
          <dd>{p95} ms</dd>
        </div>
        <div>
          <dt>Peak</dt>
          <dd>{max} ms</dd>
        </div>
      </dl>
      <div className="lx-lat-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`Response time for ${name} over the last 12 hours: average ${avg} ms, peak ${max} ms`}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setHover(Math.round(((e.clientX - r.left) / r.width) * (points.length - 1)))
          }}
          onPointerLeave={() => setHover(null)}
        >
          <path className="area" d={`${line}L${W},${H}L0,${H}Z`} />
          <path className="trace" d={line} vectorEffect="non-scaling-stroke" />
          {pt && (
            <line
              className="cursor"
              x1={x(hover as number)}
              x2={x(hover as number)}
              y1={0}
              y2={H}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <div className="lx-lat-axis" aria-hidden="true">
          <span>12 h ago</span>
          <span>
            {pt
              ? `${clock(pt.time * 1000)} · ${pt.ping ? `${pt.ping} ms` : 'no response'} · ${
                  codeToCountry(pt.loc) ?? pt.loc
                }`
              : ''}
          </span>
          <span>now</span>
        </div>
      </div>
    </div>
  )
}
