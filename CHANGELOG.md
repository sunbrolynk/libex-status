# Changelog

All notable changes to the Libex status page are recorded here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Monitors for the API, its health check and the database stats.
- Libex's logo, favicon and palette on the page, with links to libexdb.com and GitHub.
- Discord alerts for downtime and recovery, from the `DISCORD_WEBHOOK_URL` repo secret.
- Commit and push hooks and a Checks workflow for secrets, home-network details and the changelog.
- Dependabot for npm and GitHub Actions, one PR per package after a 14-day cooldown.
- A search monitor, which goes down when Audible blocks the API's searches while its health check
  still says ok. Each check is a live Audible search, so it runs every 5 minutes instead of every
  minute.
- A monitor can set `intervalMinutes` to be checked only on minutes divisible by it. Between its
  checks it keeps its last state, so the minutes it skips never count as down.
- `npm test` in `worker` runs the worker's tests, and the Checks workflow runs them too.
- Gotify alerts for downtime and recovery, from the `GOTIFY_URL` and `GOTIFY_TOKEN` repo secrets.
  The token goes in the `X-Gotify-Key` header, not the URL.
- A Slow status for a monitor whose last two readings are both over 3000 ms, or its own `slowMs`
  (6000 ms for Search, which answers in about 1.5 to 2 s), with "Some services are slow" as the
  overall state when none is down. One slow answer colours nothing.

### Changed

- The README badge shows the API's live status, and the README covers adding monitors, alerts,
  deploying, the custom domain, the first run and upstream updates.
- Security reports go through GitHub's private vulnerability reporting.
- The Upstream Sync workflow is disabled.
- Every Cloudflare resource name comes from the `uptimeflare-libex` prefix, so this page can share
  an account with my other projects.
- Every GitHub Action is pinned by commit.
- The status page and the incidents page are rebuilt as a book index: numbered sections for the
  status, notices, services and the past 30 days, a 90-day strip per service with a tooltip for each
  day, a response-time panel per service, and a light and dark theme that follows the system and
  remembers a manual switch.
- The logo has a lighter version for the dark theme.
- The incidents page lists each month's outages from the monitors' history, with their start, end,
  length and service, beside the scheduled maintenance.
- The worker drops the stored history of a monitor removed from the config, so it no longer
  reaches every visitor of the page.
- A failure only counts as an outage once it has lasted 3 minutes, on the page, the incidents
  page, `/api/data`, `/api/badge` and the alerts, instead of every failed check showing as down
  and logging an incident. Down alerts come at 3 minutes instead of 5.
- Search's grace period rounds up to its next check, 5 minutes, so its down alert lands on a check
  instead of falling between them. One failed Search check shows and sends nothing.
- `/api/data` reports a monitor's latency as `null` while its last incident is open, instead of the
  failed check's timeout, and counts `up` and `down` on the same rule as each monitor.

### Removed

- The Chinese README and the issue translation workflow.
- The page translations. The page is in English to match Libex, which has no other languages.
- Mantine, Chart.js, moment, i18next and the Tabler icons. The page draws its own icons and
  charts, so it ships about half the JavaScript it did.

### Fixed

- Down alerts now send when a monitor is still down at the end of the grace period. Before, with
  error-change alerts turned off, every down alert was dropped and only the recovery arrived.
- The check that sends a down alert is always saved, even inside the write cooldown, so the page
  shows the outage the alert announces.

### Security

- Webhook alerts log only the webhook's host and path, never its headers, so the Discord and
  Gotify tokens stay out of the worker logs.
