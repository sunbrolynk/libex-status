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
    // Discord webhook from the DISCORD_WEBHOOK_URL repo secret, inlined when deploy.yml builds the worker
    webhook: process.env.DISCORD_WEBHOOK_URL
      ? {
          url: process.env.DISCORD_WEBHOOK_URL,
          payloadType: 'json',
          payload: { content: '$MSG' },
          timeout: 10000,
        }
      : undefined,
    timeZone: 'America/Denver',
    gracePeriod: 5,
    // Down and recovery only, not every change of error text while it's down
    skipErrorChangeNotification: true,
  },
}

const maintenances: MaintenanceConfig[] = []

// Don't edit this line
export { maintenances, pageConfig, workerConfig }
