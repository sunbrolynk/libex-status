// When the worker sends a down or recovery alert, and so when the page counts a failure as an
// outage. Times are in seconds, with 30 seconds of slack for cron drift.
type Incident = { start: number[] }

const DRIFT = 30

// A monitor checked every few minutes needs a grace period that lands on one of its checks, or
// the one-minute window for the down alert falls between them and it never alerts
export const effectiveGrace = (graceMin: number | undefined, intervalMinutes?: number) =>
  graceMin === undefined || !intervalMinutes
    ? graceMin
    : Math.ceil(graceMin / intervalMinutes) * intervalMinutes

// How long a failure has lasted when its down alert is due
export const downAlertAfter = (graceMin: number) => graceMin * 60 - DRIFT
// How long a failure must have lasted for its down alert to have gone out
export const downAlertSentAfter = (graceMin: number) => (graceMin + 1) * 60 - DRIFT

// Down: once the failure reaches the grace period, even if its error text changes on that check,
// or on any change with no grace period. A later change of error text only alerts when
// error-change alerts are on.
export function downAlertDue(
  incident: Incident,
  now: number,
  changed: boolean,
  graceMin: number | undefined,
  skipErrorChange: boolean | undefined
): boolean {
  const elapsed = now - incident.start[0]
  const graceDue =
    graceMin !== undefined && elapsed >= downAlertAfter(graceMin) && elapsed < graceMin * 60 + DRIFT
  if (graceDue) return true
  const errorChange = incident.start.length > 1 && incident.start[incident.start.length - 1] === now
  return (
    changed &&
    (graceMin === undefined || elapsed >= downAlertSentAfter(graceMin)) &&
    !(errorChange && skipErrorChange)
  )
}

// Recovery: only for a failure that lasted long enough to have sent its down alert
export function upAlertDue(incident: Incident, now: number, graceMin: number | undefined): boolean {
  return graceMin === undefined || now - incident.start[0] >= downAlertSentAfter(graceMin)
}
