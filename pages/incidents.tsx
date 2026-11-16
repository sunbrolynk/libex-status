import { useEffect, useState } from 'react'
import { MonitorTarget } from '@/types/config'
import { maintenances } from '@/uptime.config'
import { CompactedMonitorStateWrapper } from '@/worker/src/store'
import { statusPageProps } from '@/util/props'
import { maintenanceNotice, outageNotices } from '@/util/libex'
import Shell from '@/components/libex/Shell'
import { NoticeList, Section } from '@/components/libex/StatusIndex'

export const runtime = 'experimental-edge'

const monthKey = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')

function selectedMonth() {
  const hash = window.location.hash.replace('#', '')
  return hash ? hash.split('-').slice(0, 2).join('-') : monthKey(new Date())
}

function shiftMonth(month: string, by: number) {
  const [year, m] = month.split('-').map(Number)
  return monthKey(new Date(year, m - 1 + by))
}

function monthLabel(month: string) {
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m - 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })
}

export default function IncidentsPage({
  compactedStateStr,
  monitors,
  graceMin,
}: {
  compactedStateStr: string
  monitors: MonitorTarget[]
  graceMin: number | null
}) {
  const state = new CompactedMonitorStateWrapper(compactedStateStr).uncompact()
  const [monitor, setMonitor] = useState('')
  const [month, setMonth] = useState(selectedMonth)

  useEffect(() => {
    const onHashChange = () => setMonth(selectedMonth())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Outages from the monitor state beside the configured maintenance, for the chosen month
  const notices = [
    ...outageNotices(state, monitors, graceMin ?? undefined),
    ...maintenances.map((m) => maintenanceNotice(m, monitors)),
  ]
    .filter(
      (n) => monthKey(new Date(n.start)) === month && (!monitor || n.monitorIds.includes(monitor))
    )
    .sort((a, b) => b.start - a.start)

  return (
    <Shell>
      <Section n={1} title="Incidents and maintenance" aside={monthLabel(month)}>
        <div className="c-controls">
          <div className="c-months">
            <button type="button" onClick={() => (window.location.hash = shiftMonth(month, -1))}>
              ← Earlier
            </button>
            <span aria-live="polite">{monthLabel(month)}</span>
            <button type="button" onClick={() => (window.location.hash = shiftMonth(month, 1))}>
              Later →
            </button>
          </div>
          <label>
            <span className="lx-sr">Service</span>
            <select value={monitor} onChange={(e) => setMonitor(e.target.value)}>
              <option value="">All services</option>
              {monitors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {notices.length === 0 ? (
          <p className="c-empty">Nothing recorded for {monthLabel(month)}.</p>
        ) : (
          <NoticeList notices={notices} />
        )}
      </Section>
    </Shell>
  )
}

export const getServerSideProps = statusPageProps
