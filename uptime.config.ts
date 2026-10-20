// Don't edit this line
import { MaintenanceConfig, PageConfig, WorkerConfig } from './types/config'

// Libex's palette over Mantine's variables: orange accent, Libex's dark navy surfaces.
const theme = `<style>
:root:root { --mantine-color-blue-filled: #f79320; --mantine-color-blue-filled-hover: #e0821a; --mantine-color-anchor: #d97a10; --mantine-primary-color-filled: #f79320; --mantine-primary-color-filled-hover: #e0821a; }
:root:root[data-mantine-color-scheme='dark'] { --mantine-color-body: #0f1720; --mantine-color-dark-7: #0f1720; --mantine-color-dark-6: #111b26; --mantine-color-dark-5: #1a2633; --mantine-color-dark-4: #1a2633; --mantine-color-dark-0: #e6edf3; --mantine-color-anchor: #f79320; }
</style>`

const pageConfig: PageConfig = {
  title: 'Libex Status',
  links: [
    { link: 'https://libexdb.com', label: 'Libex' },
    { link: 'https://github.com/LibexHQ/Libex', label: 'GitHub', highlight: true },
  ],
  favicon: '/favicon.png',
  logo: '/logo.png',
  customFooter:
    theme +
    '<p style="text-align: center; font-size: 12px; margin-top: 10px;">Status for the public <a href="https://libexdb.com">Libex</a> instance, powered by <a href="https://github.com/lyc8503/UptimeFlare" target="_blank">UptimeFlare</a>.</p>',
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
