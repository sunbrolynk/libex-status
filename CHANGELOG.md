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

### Removed

- The Chinese README and the issue translation workflow.
- The page translations. The page is in English to match Libex, which has no other languages.
- Mantine, Chart.js, moment, i18next and the Tabler icons. The page draws its own icons and
  charts, so it ships about half the JavaScript it did.
