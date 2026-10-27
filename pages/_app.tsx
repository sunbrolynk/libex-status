import type { AppProps } from 'next/app'
import NoSsr from '@/components/NoSsr'
import '@/styles/libex.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <NoSsr>
      <Component {...pageProps} />
    </NoSsr>
  )
}
