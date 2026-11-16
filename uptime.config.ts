// Don't edit this line
import { MaintenanceConfig, PageConfig, WorkerConfig } from './types/config'

const pageConfig: PageConfig = {
  title: 'Libex Status',
  links: [
    { link: 'https://libexdb.com', label: 'Libex' },
    { link: 'https://github.com/LibexHQ/Libex', label: 'GitHub', highlight: true },
  ],
  favicon: '/favicon.png',
  logo: '/logo.png',
  customFooter:
    'Status for the public <a href="https://libexdb.com">Libex</a> instance, powered by <a href="https://github.com/lyc8503/UptimeFlare">UptimeFlare</a>.',
}

const workerConfig: WorkerConfig = {
  monitors: [
    {
      id: 'api',
      name: 'API',
      method: 'GET',
      target: 'https://libexdb.com/',
      statusPageLink: 'https://libexdb.com/',
      expectedCodes: [200],
      timeout: 10000,
    },
    {
      id: 'health',
      name: 'API health',
      method: 'GET',
      target: 'https://libexdb.com/health',
      expectedCodes: [200],
      responseKeyword: '"status":"ok"',
      timeout: 10000,
    },
    {
      id: 'libex-search-us',
      name: 'Search (US)',
      method: 'GET',
      target: 'https://libexdb.com/search?region=us&title=the%20hobbit&limit=1',
      expectedCodes: [200],
      timeout: 20000,
    },
    {
      id: 'libex-search-uk',
      name: 'Search (UK)',
      method: 'GET',
      target: 'https://libexdb.com/search?region=uk&title=the%20hobbit&limit=1',
      expectedCodes: [200],
      timeout: 20000,
    },
    {
      id: 'db_stats',
      name: 'Database stats',
      method: 'GET',
      target: 'https://libexdb.com/db/stats',
      statusPageLink: 'https://libexdb.com/db/stats',
      expectedCodes: [200],
      timeout: 15000,
    },
  ],
  notification: {
    // Discord and Gotify webhooks from the DISCORD_WEBHOOK_URL and GOTIFY_WEBHOOK_URL repo secrets,
    // inlined when deploy.yml builds the worker; each is skipped when its secret is unset
    webhook: [
      process.env.DISCORD_WEBHOOK_URL
        ? {
            url: process.env.DISCORD_WEBHOOK_URL,
            payloadType: 'json' as const,
            payload: { content: '$MSG' },
            timeout: 10000,
          }
        : undefined,
      process.env.GOTIFY_WEBHOOK_URL
        ? {
            url: process.env.GOTIFY_WEBHOOK_URL,
            method: 'POST' as const,
            payloadType: 'json' as const,
            payload: { title: 'Libex status', message: '$MSG', priority: 8 },
            timeout: 10000,
          }
        : undefined,
    ].filter((w) => w !== undefined),
    timeZone: 'America/Denver',
    gracePeriod: 5,
    // Down and recovery only, not every change of error text while it's down
    skipErrorChangeNotification: true,
  },
}

const maintenances: MaintenanceConfig[] = []

// Don't edit this line
export { maintenances, pageConfig, workerConfig }
