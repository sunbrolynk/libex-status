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

### Removed

- The Chinese README and the issue translation workflow.
