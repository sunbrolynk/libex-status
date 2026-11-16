import { getFromStore } from '@/worker/src/store'

// Server-side props for the status and incidents pages
export async function statusPageProps() {
  const { workerConfig } = await import('@/uptime.config')
  // Read state as a string from storage, to stay inside the server-side cpu limit
  const compactedStateStr = await getFromStore(process.env as any, 'state')

  // Only these values reach the client
  const monitors = workerConfig.monitors.map((monitor) => ({
    id: monitor.id,
    name: monitor.name,
    tooltip: monitor.tooltip ?? null,
    statusPageLink: monitor.statusPageLink ?? null,
    hideLatencyChart: monitor.hideLatencyChart ?? null,
    intervalMinutes: monitor.intervalMinutes ?? null,
    slowMs: monitor.slowMs ?? null,
  }))

  // Props must be JSON, so an unset grace period travels as null
  const graceMin = workerConfig.notification?.gracePeriod ?? null
  return { props: { compactedStateStr, monitors, graceMin } }
}
