/// <reference types="node" />
import assert from 'node:assert/strict'
import { test } from 'node:test'
import Worker from '../src/index'
import { workerConfig } from '../../uptime.config'
import { CompactedMonitorStateWrapper } from '../src/store'

const SEARCH = workerConfig.monitors.find((m) => m.id === 'libex-search')!
const API = workerConfig.monitors.find((m) => m.id === 'api')!
const HOOK = 'https://hook.test/'
const BASE = 29_000_000 // a minute divisible by 5

workerConfig.notification!.webhook = {
  url: HOOK,
  method: 'POST',
  payloadType: 'json',
  payload: { content: '$MSG' },
}

// Runs the worker once a minute for minutes 0..last. status(url, minute) gives each target's HTTP code.
async function simulate(
  last: number,
  status: (url: string, minute: number) => number = () => 200,
  seed?: string
) {
  const db: Record<string, string> = seed ? { state: seed } : {}
  const env = {
    UPTIMEFLARE_D1: {
      prepare: () => ({
        bind: (key: string, value?: string) => ({
          first: async () => (db[key] ? { value: db[key] } : null),
          run: async () => void (db[key] = value!),
        }),
      }),
    },
  } as any
  const calls: string[][] = []
  const alerts: { minute: number; text: string }[] = []
  const searchIncidents: string[] = []
  let minute = 0
  const realFetch = globalThis.fetch
  const realNow = Date.now
  const realLog = console.log
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.includes('cdn-cgi/trace')) return new Response('colo=TST\n')
    if (url === HOOK) {
      alerts.push({ minute, text: JSON.parse(String(init!.body)).content })
      return new Response('')
    }
    calls[minute].push(url)
    return new Response('{"status":"ok"}', { status: status(url, minute) })
  }) as typeof fetch
  console.log = () => {}
  try {
    for (minute = 0; minute <= last; minute++) {
      calls[minute] = []
      Date.now = () => (BASE + minute) * 60000
      await Worker.scheduled({ scheduledTime: (BASE + minute) * 60000 } as any, env, {} as any)
      const state = new CompactedMonitorStateWrapper(db.state).uncompact()
      searchIncidents[minute] = JSON.stringify(state.incident['libex-search'])
    }
  } finally {
    globalThis.fetch = realFetch
    Date.now = realNow
    console.log = realLog
  }
  const state = new CompactedMonitorStateWrapper(db.state).uncompact()
  const alertsFor = (name: string, kind: '🔴' | '✅') =>
    alerts.filter((a) => a.text.startsWith(`${kind} ${name} `)).map((a) => a.minute)
  return { calls, state, searchIncidents, alertsFor }
}

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
  // The grace period is 5 minutes from the first failed check
  assert.deepEqual(run.alertsFor(API.name, '🔴'), [8])
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
  assert.deepEqual(run.alertsFor(API.name, '🔴'), [8])
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
