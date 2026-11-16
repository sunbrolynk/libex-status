import { useState } from 'react'
import { MonitorTarget } from '@/types/config'
import { maintenances } from '@/uptime.config'
import { CompactedMonitorStateWrapper } from '@/worker/src/store'
import { statusPageProps } from '@/util/props'
import { buildModel } from '@/util/libex'
import Shell, { fontVars } from '@/components/libex/Shell'
import StatusIndex, { ServiceEntry } from '@/components/libex/StatusIndex'

export const runtime = 'experimental-edge'

export default function Home({
  compactedStateStr,
  monitors,
  graceMin,
}: {
  compactedStateStr: string
  monitors: MonitorTarget[]
  graceMin: number | null
}) {
  const state = new CompactedMonitorStateWrapper(compactedStateStr).uncompact()
  const [open, setOpen] = useState(true)

  if (state.lastUpdate === 0) {
    return (
      <Shell>
        <p className="c-empty">
          No checks have run yet. The first results appear a few minutes after the worker starts.
        </p>
      </Shell>
    )
  }

  const model = buildModel(state, monitors, maintenances, graceMin ?? undefined)

  // A monitor id in the URL hash shows just that monitor, for embedding in an iframe
  const monitorId = window.location.hash.substring(1)
  if (monitorId) {
    const m = model.monitors.find((v) => v.id === monitorId)
    return (
      <div
        className={`lx lx-c c-embed ${fontVars}`}
        data-theme={window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'}
      >
        {m ? (
          <ol className="c-index">
            <ServiceEntry m={m} state={state} open={open} onToggle={() => setOpen(!open)} />
          </ol>
        ) : (
          <p className="c-empty">No monitor called {monitorId}.</p>
        )}
      </div>
    )
  }

  return (
    <Shell statuses={model.monitors.map((m) => m.status)}>
      <StatusIndex model={model} state={state} />
    </Shell>
  )
}

export const getServerSideProps = statusPageProps
