import { useEffect, useState } from 'react'
import { MonitorTarget } from '@/types/config'
import { maintenances } from '@/uptime.config'
import { maintenanceNotice } from '@/util/libex'
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
  return new Date(year, m - 1).toLocaleDateString([], { month: 'long', year: 'numeric' })
}

export default function IncidentsPage({ monitors }: { monitors: MonitorTarget[] }) {
  const [monitor, setMonitor] = useState('')
  const [month, setMonth] = useState(selectedMonth)

  useEffect(() => {
    const onHashChange = () => setMonth(selectedMonth())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const notices = maintenances
    .filter(
      (m) =>
        monthKey(new Date(m.start)) === month && (!monitor || (m.monitors ?? []).includes(monitor))
    )
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
    .map((m) => maintenanceNotice(m, monitors))

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

export async function getServerSideProps() {
  const { workerConfig } = await import('@/uptime.config')
  // Only these values reach the client
  const monitors = workerConfig.monitors.map((monitor) => ({ id: monitor.id, name: monitor.name }))
  return { props: { monitors } }
}
