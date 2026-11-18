import { IncidentRecord } from '@/types/config'
import { downAlertAfter, downAlertSentAfter } from '@/worker/src/alerts'

// A failure counts as an outage only once the worker has sent its down alert for it: still open
// past the grace period at the last check, or closed after lasting long enough to have alerted.
// graceMin is the monitor's effective grace period, from effectiveGrace.
export function isOutage(inc: IncidentRecord, lastUpdate: number, graceMin?: number) {
  if (graceMin === undefined) return true
  return inc.end === null
    ? lastUpdate - inc.start[0] >= downAlertAfter(graceMin)
    : inc.end - inc.start[0] >= downAlertSentAfter(graceMin)
}

// Down at the last check: failing, and for long enough to count as an outage
export const isDownNow = (inc: IncidentRecord, lastUpdate: number, graceMin?: number) =>
  inc.end === null && isOutage(inc, lastUpdate, graceMin)
