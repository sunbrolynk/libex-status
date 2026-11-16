/// <reference types="node" />
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { workerConfig } from '../../uptime.config'
import { IncidentRecord, MonitorTarget } from '../../types/config'
import { buildModel, outageNotices, SLOW_MS } from '../../util/libex'
import { isOutage } from '../../util/outage'
import { statusPageProps } from '../../util/props'
import dataRoute from '../../pages/api/data'
import badgeRoute from '../../pages/api/badge'
import { downAlertDue, effectiveGrace, upAlertDue } from '../src/alerts'
import { CompactedMonitorStateWrapper } from '../src/store'
import { simulate } from './simulate'

const GRACE = workerConfig.notification!.gracePeriod!
const SEARCH = workerConfig.monitors.find((m) => m.id === 'libex-search')!
const API = workerConfig.monitors.find((m) => m.id === 'api')!

// The routes read the store through process.env, so a test points it at its own D1 stand-in
const realEnv = process.env
function useStore(env: { UPTIMEFLARE_D1: unknown }) {
  process.env = { ...realEnv, UPTIMEFLARE_D1: env.UPTIMEFLARE_D1 } as any
}
const storeOf = (state: string) => ({
  UPTIMEFLARE_D1: {
    prepare: () => ({ bind: () => ({ first: async () => ({ value: state }) }) }),
  },
})
const data = async () =>
  (await dataRoute(new Request('http://status.test/api/data') as any)).json() as Promise<any>
const badge = async (id: string) =>
  (
    (await (
      await badgeRoute(new Request(`http://status.test/api/badge?id=${id}`) as any)
    ).json()) as any
  ).message

// After every minute of a worker run, the page, its notices, /api/data and /api/badge must show a
// monitor down exactly while the worker has sent a down alert and no recovery since.
async function agreeEveryMinute(
  last: number,
  status: (url: string, minute: number) => number
): Promise<Record<string, string[]>> {
  const run = await simulate(last, status, undefined, async (minute, env, alertsFor) => {
    const state = new CompactedMonitorStateWrapper(
      await env.UPTIMEFLARE_D1.prepare()
        .bind('state')
        .first()
        .then((r: any) => r.value)
    ).uncompact()
    const model = buildModel(state, workerConfig.monitors, [], GRACE, minuteMs(minute))
    useStore(env)
    const api = await data()
    for (const m of workerConfig.monitors) {
      const downs = alertsFor(m.name, '🔴')
      const ups = alertsFor(m.name, '✅')
      const alerted = downs.length > ups.length
      const at = `${m.id} at minute ${minute}`
      assert.equal(model.monitors.find((v) => v.id === m.id)!.status === 'down', alerted, at)
      const open = outageNotices(state, workerConfig.monitors, GRACE).filter(
        (n) => n.monitorIds[0] === m.id && n.end === null
      )
      assert.equal(open.length, alerted ? 1 : 0, `${at}: open notice`)
      assert.equal(api.monitors[m.id].up, !alerted, `${at}: /api/data`)
      assert.equal(await badge(m.id), alerted ? 'DOWN' : 'UP', `${at}: /api/badge`)
    }
    assert.equal(api.down, model.monitors.filter((v) => v.status === 'down').length)
  })
  process.env = realEnv
  const sent: Record<string, string[]> = {}
  for (const m of workerConfig.monitors)
    sent[m.id] = [
      ...run.alertsFor(m.name, '🔴').map((x) => `down@${x}`),
      ...run.alertsFor(m.name, '✅').map((x) => `up@${x}`),
    ]
  return sent
}
const minuteMs = (minute: number) => (29_000_000 + minute) * 60000

test('Search failing 3 checks in a row sends one down and one up, and the page agrees', async () => {
  const sent = await agreeEveryMinute(22, (url, m) =>
    url === SEARCH.target && m >= 5 && m < 20 ? 503 : 200
  )
  assert.deepEqual(sent['libex-search'], ['down@10', 'up@20'])
})

test('a single failed Search check shows and sends nothing', async () => {
  const sent = await agreeEveryMinute(12, (url, m) =>
    url === SEARCH.target && m === 5 ? 503 : 200
  )
  assert.deepEqual(sent['libex-search'], [])
})

test('a 1-minute outage alerts at 3 minutes, saved inside the write cooldown; a blip shows nothing', async () => {
  // Search's check at minute 5 saves state, so the alert at minute 6 is saved only by forcing it
  const sent = await agreeEveryMinute(16, (url, m) =>
    url === API.target && ((m >= 3 && m < 9) || m === 12 || m === 13) ? 503 : 200
  )
  assert.deepEqual(sent.api, ['down@6', 'up@9'])
})

test('the grace period lands on a check of a monitor checked every few minutes', () => {
  assert.equal(effectiveGrace(3, undefined), 3)
  assert.equal(effectiveGrace(3, 1), 3)
  assert.equal(effectiveGrace(3, 5), 5)
  assert.equal(effectiveGrace(5, 5), 5)
  assert.equal(effectiveGrace(6, 5), 10)
  assert.equal(effectiveGrace(undefined, 5), undefined)
  assert.equal(effectiveGrace(GRACE, SEARCH.intervalMinutes), 5)
})

test('down is due from 150 s and recovery from 210 s, or 270 s and 330 s for Search', () => {
  const at = (s: number) => ({ start: [1000 - s] })
  for (const [grace, due, sent] of [
    [3, 150, 210],
    [effectiveGrace(GRACE, SEARCH.intervalMinutes)!, 270, 330],
  ]) {
    assert.equal(downAlertDue(at(due - 1), 1000, false, grace, true), false)
    assert.equal(downAlertDue(at(due), 1000, false, grace, true), true)
    // Past the window with nothing changed, the down alert has already gone out
    assert.equal(downAlertDue(at(sent - 1), 1000, false, grace, true), true)
    assert.equal(downAlertDue(at(sent), 1000, false, grace, true), false)
    assert.equal(upAlertDue(at(sent - 1), 1000, grace), false)
    assert.equal(upAlertDue(at(sent), 1000, grace), true)
  }
})

// Replays one check a minute through the alert rules. Each entry is an error, or null for up.
function alerts(checks: (string | null)[], graceMin: number | null = 3, skip = true) {
  const grace = graceMin ?? undefined
  const sent: string[] = []
  let inc: { start: number[]; error: string[] } | null = null
  checks.forEach((err, minute) => {
    const now = 1_800_000_000 + minute * 60
    if (err === null) {
      if (inc && upAlertDue(inc, now, grace)) sent.push(`up@${minute}`)
      inc = null
      return
    }
    let changed = false
    if (!inc) {
      inc = { start: [now], error: [err] }
      changed = true
    } else if (inc.error[inc.error.length - 1] !== err) {
      inc.start.push(now)
      inc.error.push(err)
      changed = true
    }
    if (downAlertDue(inc, now, changed, grace, skip)) sent.push(`down@${minute}`)
  })
  return sent
}
const down = (n: number, err = 'HTTP 502') => Array<string | null>(n).fill(err)
const T = 'Timeout after 10000ms'

test('a change of error text sends the down alert on the grace check and nothing after', () => {
  assert.deepEqual(alerts([null, ...down(3), ...down(3, T), null]), ['down@4', 'up@7'])
  assert.deepEqual(alerts([null, ...down(2), ...down(4, T), null]), ['down@4', 'up@7'])
  assert.deepEqual(alerts([null, ...down(4), ...down(3, T), null]), ['down@4', 'up@8'])
  assert.deepEqual(alerts([null, ...down(4), ...down(3, T), null], 3, false), [
    'down@4',
    'down@5',
    'up@8',
  ])
  assert.deepEqual(alerts([null, ...down(1), null], null), ['down@1', 'up@2'])
})

// At every check the page counts a failure as an outage exactly when the worker has sent its down
// alert, and once it clears, keeps it exactly when the worker sent a recovery alert
test('the page counts an outage exactly when the worker alerts, every minute or every 5', () => {
  for (const every of [1, 5]) {
    const grace = effectiveGrace(3, every === 1 ? undefined : every)
    for (let checks = 1; checks <= 6; checks++) {
      const start = 1_800_000_000
      const inc: IncidentRecord = { start: [start], end: null, error: ['HTTP 502'] }
      let alerted = false
      for (let c = 0; c < checks; c++) {
        const t = start + c * every * 60
        if (downAlertDue(inc, t, c === 0, grace, true)) alerted = true
        assert.equal(
          isOutage(inc, t, grace),
          alerted,
          `every ${every}, ${checks} checks, check ${c}`
        )
      }
      const end = start + checks * every * 60
      const recovered = upAlertDue(inc, end, grace)
      assert.equal(recovered, alerted, `every ${every}, ${checks} checks: recovery follows down`)
      assert.equal(isOutage({ ...inc, end }, end, grace), recovered, `every ${every}, closed`)
    }
  }
})

// A page model as of `now`, for one monitor whose readings are a few minutes apart
const now = 1_800_000_000
const marker: IncidentRecord = {
  start: [now - 10 * 86400],
  end: now - 10 * 86400,
  error: ['dummy'],
}
function view(
  incidents: IncidentRecord[],
  pings = [400, 420],
  monitor: Partial<MonitorTarget> = {},
  graceMin: number | null = 3
) {
  const grace = graceMin ?? undefined
  const state = {
    lastUpdate: now,
    overallUp: 1,
    overallDown: 0,
    incident: { m: [marker, ...incidents] },
    latency: {
      m: pings.map((ping, i) => ({ loc: 'DEN', ping, time: now - (pings.length - 1 - i) * 180 })),
    },
  }
  const monitors = [{ id: 'm', name: 'M', ...monitor } as MonitorTarget]
  const model = buildModel(state, monitors, [], grace, now * 1000)
  return { v: model.monitors[0], model, notices: outageNotices(state, monitors, grace) }
}
const failingFor = (sec: number): IncidentRecord => ({ start: [now - sec], end: null, error: [T] })
const failedFor = (sec: number, ago = 3600): IncidentRecord => ({
  start: [now - ago],
  end: now - ago + sec,
  error: ['HTTP 502'],
})

test('an open failure is down from 150 s, or 270 s for a monitor checked every 5 minutes', () => {
  assert.equal(view([failingFor(149)], [400, 10000]).v.status, 'up')
  assert.equal(view([failingFor(150)], [400, 10000]).v.status, 'down')
  const five = { intervalMinutes: 5 }
  assert.equal(view([failingFor(269)], [400, 10000], five).v.status, 'up')
  assert.equal(view([failingFor(270)], [400, 10000], five).v.status, 'down')
})

test('a closed failure stays on the page from 210 s, or 330 s every 5 minutes', () => {
  assert.equal(view([failedFor(209)]).notices.length, 0)
  assert.equal(view([failedFor(210)]).notices.length, 1)
  assert.equal(view([failedFor(329)], undefined, { intervalMinutes: 5 }).notices.length, 0)
  assert.equal(view([failedFor(330)], undefined, { intervalMinutes: 5 }).notices.length, 1)
})

test('a failure inside the grace period leaves no mark and no reading', () => {
  const { v, notices } = view([failingFor(120)], [400, 10000])
  assert.equal(v.status, 'up')
  assert.equal(notices.length, 0)
  assert.equal(v.uptime, 100)
  assert.equal(v.latest, null)
  assert.ok(v.days.every((d) => d.downSec === 0))
})

test('an outage is down and noticed from its first failed check', () => {
  const { v, notices } = view([failingFor(180)], [400, 10000])
  assert.equal(v.status, 'down')
  assert.equal(notices[0].start, (now - 180) * 1000)
  assert.ok(v.uptime < 100)
})

test('with no grace period every failure counts', () => {
  assert.equal(view([failingFor(0)], [400, 10000], {}, null).v.status, 'down')
})

test('one slow reading is jitter, two in a row are degraded', () => {
  assert.equal(view([], [8000]).v.status, 'up')
  assert.equal(view([], [400, 400, 8000]).v.status, 'up')
  assert.equal(view([], [400, 3500, 8000]).v.status, 'degraded')
  assert.equal(view([], [SLOW_MS, SLOW_MS]).v.status, 'up')
  assert.equal(view([], [SLOW_MS + 1, SLOW_MS + 1]).v.status, 'degraded')
})

test("Search's normal 1.5 to 3.3 s isn't slow, past its own 6 s it is", () => {
  const search = { slowMs: SEARCH.slowMs }
  assert.equal(SEARCH.slowMs, 6000)
  assert.equal(view([], [3300, 3313], search).v.status, 'up')
  assert.equal(view([], [6500, 7000], search).v.status, 'degraded')
})

test("a failure's timeout reading never counts toward slow", () => {
  assert.equal(view([failingFor(60)], [10000, 10000]).v.status, 'up')
  // Readings at -3 min (the blip's timeout) and now; the blip ended 2 minutes ago
  assert.equal(view([failedFor(60, 180)], [10000, 6000], { slowMs: 5000 }).v.status, 'up')
  assert.equal(view([failedFor(60, 600)], [6000, 6000], { slowMs: 5000 }).v.status, 'degraded')
  // The check that recovers is stored at the failure's end and counts
  assert.equal(
    view([failedFor(60, 240)], [10000, 6000, 6000], { slowMs: 5000 }).v.status,
    'degraded'
  )
})

test('the overall state is degraded when a service is slow and none is down', () => {
  const { model } = view([], [4000, 4000])
  assert.equal(model.overall, 'degraded')
  assert.equal(model.upCount, 1)
  assert.equal(view([failingFor(180)], [4000, 4000]).model.overall, 'down')
})

// The routes on a stored state where `api` has the given incidents and every other monitor is up
async function routes(incidents: IncidentRecord[]) {
  const w = new CompactedMonitorStateWrapper(null)
  for (const m of workerConfig.monitors) {
    for (const inc of [marker, ...(m.id === 'api' ? incidents : [])]) w.appendIncident(m.id, inc)
    const open = m.id === 'api' && incidents[incidents.length - 1]?.end === null
    w.appendLatency(m.id, { loc: 'DEN', ping: open ? 10000 : 400, time: now })
  }
  w.data.lastUpdate = now
  useStore(storeOf(w.getCompactedStateStr()))
  try {
    return { d: await data(), badge: await badge('api') }
  } finally {
    process.env = realEnv
  }
}

test('/api/data and /api/badge call a failure down only past the grace period', async () => {
  const total = workerConfig.monitors.length
  let r = await routes([failingFor(149)])
  assert.deepEqual(
    [r.d.monitors.api.up, r.d.monitors.api.latency, r.d.down, r.badge],
    [true, null, 0, 'UP']
  )
  r = await routes([failingFor(150)])
  assert.deepEqual([r.d.monitors.api.up, r.d.down, r.d.up, r.badge], [false, 1, total - 1, 'DOWN'])
  assert.equal(r.d.monitors.api.latency, null)
  r = await routes([failedFor(600, 900)])
  assert.deepEqual(
    [r.d.monitors.api.up, r.d.monitors.api.latency, r.d.down, r.badge],
    [true, 400, 0, 'UP']
  )
})

test("both pages' props carry each monitor's interval, slow limit and the grace period", async () => {
  useStore(storeOf('stored state'))
  try {
    const { props } = await statusPageProps()
    assert.equal(props.compactedStateStr, 'stored state')
    assert.equal(props.graceMin, GRACE)
    for (const m of workerConfig.monitors) {
      const sent = props.monitors.find((p) => p.id === m.id)!
      assert.equal(sent.intervalMinutes, m.intervalMinutes ?? null, m.id)
      assert.equal(sent.slowMs, m.slowMs ?? null, m.id)
    }
    // The pages pull in Next's fonts and components, which don't load outside Next, so their
    // wiring to these props is checked in their source
    for (const page of ['index', 'incidents'])
      assert.match(
        readFileSync(`../pages/${page}.tsx`, 'utf8'),
        /^export const getServerSideProps = statusPageProps$/m,
        page
      )
    const search = props.monitors.find((p) => p.id === SEARCH.id)!
    assert.deepEqual([search.intervalMinutes, search.slowMs], [5, 6000])
  } finally {
    process.env = realEnv
  }
})
