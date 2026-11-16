/// <reference types="node" />
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { workerConfig } from '../../uptime.config'
import { CompactedMonitorStateWrapper } from '../src/store'
import { BASE, simulate } from './simulate'

const SEARCH = workerConfig.monitors.find((m) => m.id === 'libex-search')!
const API = workerConfig.monitors.find((m) => m.id === 'api')!
test('libex-search runs every 5 minutes, the rest every minute, skips leave incidents alone', async () => {
  // Search fails on its minute-5 check only
  const run = await simulate(20, (url, m) => (url === SEARCH.target && m === 5 ? 503 : 200))
  for (let m = 0; m <= 20; m++) {
    const due = m % 5 === 0
    assert.equal(run.calls[m].includes(SEARCH.target), due, `search on minute ${m}`)
    for (const mon of workerConfig.monitors)
      if (mon !== SEARCH) assert.ok(run.calls[m].includes(mon.target), `${mon.id} on minute ${m}`)
    if (!due)
      assert.equal(run.searchIncidents[m], run.searchIncidents[m - 1], `skipped minute ${m}`)
    const open = JSON.parse(run.searchIncidents[m]).at(-1).end === null
    assert.equal(open, m >= 5 && m < 10, `search open incident on minute ${m}`)
  }
  // Every Search check is saved, despite the write cooldown
  const saved = run.state.latency['libex-search'].map((p) => p.time / 60 - BASE)
  assert.deepEqual(saved, [0, 5, 10, 15, 20])
})

test('a 1-minute monitor down for 12 minutes sends one down alert and one recovery', async () => {
  const run = await simulate(16, (url, m) => (url === API.target && m >= 3 && m < 15 ? 503 : 200))
  // The grace period is 3 minutes from the first failed check
  assert.deepEqual(run.alertsFor(API.name, '🔴'), [6])
  assert.deepEqual(run.alertsFor(API.name, '✅'), [15])
})

test('Search down for 3 checks in a row sends one down alert and one recovery', async () => {
  const run = await simulate(21, (url, m) =>
    url === SEARCH.target && m >= 5 && m < 20 ? 503 : 200
  )
  assert.deepEqual(run.alertsFor(SEARCH.name, '🔴'), [10])
  assert.deepEqual(run.alertsFor(SEARCH.name, '✅'), [20])
})

test('a change of error reason mid-incident sends no extra alert', async () => {
  assert.ok(workerConfig.notification?.skipErrorChangeNotification)
  const run = await simulate(14, (url, m) =>
    url === API.target && m >= 3 && m < 13 ? (m < 9 ? 503 : 502) : 200
  )
  assert.equal(run.state.incident.api.at(-1)!.error.length, 2)
  assert.deepEqual(run.alertsFor(API.name, '🔴'), [6])
  assert.deepEqual(run.alertsFor(API.name, '✅'), [13])
})

test('history of a monitor removed from the config is dropped', async () => {
  const seed = new CompactedMonitorStateWrapper(null)
  seed.appendIncident('removed', { start: [1], end: 1, error: ['dummy'] })
  seed.appendLatency('removed', { loc: 'TST', ping: 1, time: 1 })
  const run = await simulate(0, undefined, seed.getCompactedStateStr())
  assert.equal(run.state.incident.removed, undefined)
  assert.equal(run.state.latency.removed, undefined)
  assert.ok(run.state.incident.api)
})
