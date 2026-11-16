import { maintenances, workerConfig } from '@/uptime.config'
import { NextRequest } from 'next/server'
import { CompactedMonitorStateWrapper, getFromStore } from '@/worker/src/store'
import { effectiveGrace } from '@/worker/src/alerts'
import { isDownNow } from '@/util/outage'

export const runtime = 'edge'

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default async function handler(req: NextRequest): Promise<Response> {
  const compactedState = new CompactedMonitorStateWrapper(
    await getFromStore(process.env as any, 'state')
  )

  if (compactedState.data.lastUpdate === 0) {
    return new Response(JSON.stringify({ error: 'No data available' }), {
      status: 500,
      headers,
    })
  }

  let monitors: any = {}

  for (let monitor of workerConfig.monitors) {
    const lastIncident = compactedState.getIncident(
      monitor.id,
      compactedState.incidentLen(monitor.id) - 1
    )

    const isUp = !isDownNow(
      lastIncident,
      compactedState.data.lastUpdate,
      effectiveGrace(workerConfig.notification?.gracePeriod, monitor.intervalMinutes)
    )
    const latency = compactedState.getLastLatency(monitor.id)
    monitors[monitor.id] = {
      up: isUp,
      // A failure inside the grace period has no real reading, only its timeout
      latency: lastIncident.end === null ? null : latency.ping,
      location: latency.loc,
      message: isUp ? 'OK' : lastIncident?.error[lastIncident.error.length - 1],
    }
  }

  // Counted on the same grace rule as each monitor, not the worker's raw check results
  const ups = Object.values(monitors).filter((m: any) => m.up).length
  let ret = {
    up: ups,
    down: workerConfig.monitors.length - ups,
    updatedAt: compactedState.data.lastUpdate,
    monitors,
    maintenances,
  }

  return new Response(JSON.stringify(ret), {
    headers,
  })
}
