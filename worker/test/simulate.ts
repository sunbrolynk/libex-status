/// <reference types="node" />
import Worker from '../src/index'
import { workerConfig } from '../../uptime.config'
import { CompactedMonitorStateWrapper } from '../src/store'

const HOOK = 'https://hook.test/'
export const BASE = 29_000_000 // a minute divisible by 5

workerConfig.notification!.webhook = {
  url: HOOK,
  method: 'POST',
  payloadType: 'json',
  payload: { content: '$MSG' },
}

type Alerts = (name: string, kind: '🔴' | '✅') => number[]

// Runs the worker once a minute for minutes 0..last. status(url, minute) gives each target's HTTP
// code, and each(minute, env, alertsFor) runs after every minute's run.
export async function simulate(
  last: number,
  status: (url: string, minute: number) => number = () => 200,
  seed?: string,
  each?: (minute: number, env: any, alertsFor: Alerts) => void | Promise<void>
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
  const alertsFor: Alerts = (name, kind) =>
    alerts.filter((a) => a.text.startsWith(`${kind} ${name} `)).map((a) => a.minute)
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
      await each?.(minute, env, alertsFor)
    }
  } finally {
    globalThis.fetch = realFetch
    Date.now = realNow
    console.log = realLog
  }
  const state = new CompactedMonitorStateWrapper(db.state).uncompact()
  return { calls, state, searchIncidents, alertsFor }
}
