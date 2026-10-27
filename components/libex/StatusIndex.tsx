import { ReactNode, useState } from 'react'
import { MonitorState } from '@/types/config'
import { DayBars, Icon, Latency, STATUS_WORD } from './parts'
import { ago, Model, MonitorView, Notice, noticeWhen } from '@/util/libex'

export function Section({
  n,
  title,
  aside,
  children,
}: {
  n: number
  title: string
  aside?: string
  children: ReactNode
}) {
  const id = `c-s${n}`
  return (
    <section className="c-sec" aria-labelledby={id}>
      <div className="c-h">
        <h2 id={id}>
          <span className="c-n" aria-hidden="true">
            {String(n).padStart(2, '0')}
          </span>
          {title}
        </h2>
        {aside && <span className="c-aside">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

export function NoticeList({ notices }: { notices: Notice[] }) {
  return (
    <ul className="c-notes">
      {notices.map((x) => (
        <li key={x.kind + x.start + x.title} data-kind={x.kind}>
          <span className="c-tag">{x.kind === 'incident' ? 'Incident' : 'Maintenance'}</span>
          <div>
            <p className="c-note-title">{x.title}</p>
            <p className="c-note-when">{noticeWhen(x)}</p>
            {x.body && <p className="c-note-body">{x.body}</p>}
            {x.kind === 'maintenance' && x.monitors.length > 0 && (
              <p className="c-note-when">Affects {x.monitors.join(', ')}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ServiceEntry({
  m,
  state,
  open,
  onToggle,
}: {
  m: MonitorView
  state: MonitorState
  open: boolean
  onToggle: () => void
}) {
  return (
    <li data-status={m.status}>
      <div className="c-entry">
        <span className="c-name" title={m.tooltip}>
          {m.link ? <a href={m.link}>{m.name}</a> : m.name}
        </span>
        <span className="c-leader" aria-hidden="true" />
        <span className="c-state">
          <Icon name={m.status} size={13} />
          {STATUS_WORD[m.status]}
        </span>
        <span className="c-pct">{m.uptime.toFixed(2)}%</span>
      </div>
      <DayBars days={m.days} label={`${m.name}, last 90 days`} />
      <div className="c-meta">
        {m.error ? (
          <span className="c-err">{m.error}</span>
        ) : (
          <span>{m.latest !== null ? `${m.latest} ms now · ${m.avg} ms avg` : ''}</span>
        )}
        {!m.hideLatencyChart && (
          <button type="button" aria-expanded={open} onClick={onToggle}>
            {open ? 'Hide response time' : 'Response time'}
          </button>
        )}
      </div>
      {open && (
        <div className="c-detail">
          <p className="c-detail-h">Response time · {m.name} · last 12 hours</p>
          <Latency points={state.latency[m.id]} name={m.name} />
        </div>
      )}
    </li>
  )
}

// The status page as a book index: numbered sections with dotted leaders.
export default function StatusIndex({ model, state }: { model: Model; state: MonitorState }) {
  const [open, setOpen] = useState<string | null>(null)
  let n = 0
  return (
    <>
      <Section n={++n} title="Status">
        <p className="c-lede" data-overall={model.overall}>
          <strong>{model.headline}.</strong> {model.upCount} of {model.monitors.length} services
          answering.
        </p>
        <dl className="c-facts">
          <div>
            <dt>Services</dt>
            <dd>{model.monitors.length}</dd>
          </div>
          <div>
            <dt>Answering</dt>
            <dd>{model.upCount}</dd>
          </div>
          <div>
            <dt>Open incidents</dt>
            <dd>{model.notices.filter((x) => x.kind === 'incident').length}</dd>
          </div>
          <div>
            <dt>Last check</dt>
            <dd>{ago(model.updated)}</dd>
          </div>
        </dl>
      </Section>

      {model.notices.length > 0 && (
        <Section n={++n} title="Notices">
          <NoticeList notices={model.notices} />
        </Section>
      )}

      <Section n={++n} title="Services" aside="Uptime, last 90 days">
        <ol className="c-index">
          {model.monitors.map((m) => (
            <ServiceEntry
              key={m.id}
              m={m}
              state={state}
              open={open === m.id}
              onToggle={() => setOpen(open === m.id ? null : m.id)}
            />
          ))}
        </ol>
      </Section>

      {model.recent.length > 0 && (
        <Section n={++n} title="Past 30 days">
          <dl className="c-hist">
            {model.recent.map((x) => (
              <div key={x.title + x.start}>
                <dt>{x.title}</dt>
                <dd>{noticeWhen(x)}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}
    </>
  )
}
