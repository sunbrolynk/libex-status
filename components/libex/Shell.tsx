import { ReactNode, useEffect, useState } from 'react'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from 'next/font/google'
import { pageConfig } from '@/uptime.config'
import { Status } from '@/util/libex'
import { ThemeToggle } from './parts'

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--f-mono',
  display: 'swap',
})
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--f-plex',
  display: 'swap',
})
const newsreader = Newsreader({ subsets: ['latin'], variable: '--f-news', display: 'swap' })

export const fontVars = `${plexMono.variable} ${plexSans.variable} ${newsreader.variable}`

const SPINE_H = [44, 52, 38, 48, 56, 41, 50, 46, 54, 40, 49]

function readTheme(): boolean {
  try {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
  } catch {}
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Page frame: fonts, light/dark theme, the shelf header and the footer. A shelf spine per service shows its status.
export default function Shell({
  statuses = [],
  children,
}: {
  statuses?: Status[]
  children: ReactNode
}) {
  const [dark, setDark] = useState(readTheme)
  useEffect(() => {
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])
  const toggle = () => {
    setDark(!dark)
    try {
      localStorage.setItem('theme', dark ? 'light' : 'dark')
    } catch {}
  }
  const spines: string[] = [...statuses, ...Array(Math.max(3, 11 - statuses.length)).fill('shelf')]
  const links = [{ label: 'Incidents', link: '/incidents' }, ...(pageConfig.links ?? [])]
  return (
    <div className={`lx lx-c ${fontVars}`} data-theme={dark ? 'dark' : 'light'}>
      <Head>
        <title>{pageConfig.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href={pageConfig.favicon ?? '/favicon.png'} />
      </Head>
      <div className="c-page">
        <header className="c-head">
          <svg className="c-shelf" viewBox={`0 0 ${spines.length * 14} 60`} aria-hidden="true">
            {spines.map((s, i) => (
              <rect
                key={i}
                className={`c-spine c-spine-${s}`}
                x={i * 14 + 1}
                y={60 - SPINE_H[i % SPINE_H.length]}
                width={11}
                height={SPINE_H[i % SPINE_H.length]}
                rx={1.5}
              />
            ))}
            <rect className="c-plank" x={0} y={58} width={spines.length * 14} height={2} />
          </svg>
          <div className="c-titlebar">
            <Link href="/" className="c-home">
              <h1>
                <Image
                  src={dark ? '/logo-dark.png' : '/logo.png'}
                  alt=""
                  width={26}
                  height={26}
                  unoptimized
                />
                Libex <span>Status</span>
              </h1>
            </Link>
            <nav>
              {links.map((l) =>
                l.link.startsWith('/') ? (
                  <Link key={l.link} href={l.link}>
                    {l.label}
                  </Link>
                ) : (
                  <a key={l.link} href={l.link}>
                    {l.label}
                  </a>
                )
              )}
              <ThemeToggle dark={dark} onToggle={toggle} />
            </nav>
          </div>
        </header>
        <main>{children}</main>
        {pageConfig.customFooter && (
          <footer
            className="c-foot"
            dangerouslySetInnerHTML={{ __html: pageConfig.customFooter }}
          />
        )}
      </div>
    </div>
  )
}
