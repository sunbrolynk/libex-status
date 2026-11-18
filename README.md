<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/logo-dark.png">
  <img src="docs/readme/logo.png" alt="Libex" width="400">
</picture>

[![API status](https://img.shields.io/endpoint?url=https%3A%2F%2Fstatus.libexdb.com%2Fapi%2Fbadge%3Fid%3Dapi%26label%3Dservice%26up%3Donline%26down%3Ddown)](https://status.libexdb.com)
[![Powered by UptimeFlare](https://img.shields.io/badge/powered%20by-UptimeFlare-blue)](https://github.com/lyc8503/UptimeFlare)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)
[![Checks](https://github.com/sunbrolynk/libex-status/actions/workflows/checks.yml/badge.svg?branch=dev)](https://github.com/sunbrolynk/libex-status/actions/workflows/checks.yml)

[![Books](https://libexdb.com/db/stats/badge/books.svg)](https://libexdb.com/db/stats)
[![Authors](https://libexdb.com/db/stats/badge/authors.svg)](https://libexdb.com/db/stats)
[![Series](https://libexdb.com/db/stats/badge/series.svg)](https://libexdb.com/db/stats)

The status page for the public Libex instance.

</div>

---

This is the uptime page for [Libex](https://github.com/LibexHQ/Libex)'s public instance at
[libexdb.com](https://libexdb.com), live at [status.libexdb.com](https://status.libexdb.com). It
runs on [UptimeFlare](https://github.com/lyc8503/UptimeFlare) by lyc8503: a Cloudflare Worker
checks the targets every minute and a Cloudflare Pages site shows the history.

## What it watches

| Monitor | id | URL | Up when |
|---|---|---|---|
| API | `api` | https://libexdb.com/ | it answers 200 |
| API health | `health` | https://libexdb.com/health | it answers 200 with `"status":"ok"` |
| Search | `libex-search` | https://libexdb.com/search?region=us&title=the%20hobbit&limit=1 | it answers 200 within 20 seconds |
| Database stats | `db_stats` | https://libexdb.com/db/stats | it answers 200 |

Search is checked every 5 minutes, not every minute, because each check is a live Audible search.
Its `intervalMinutes: 5` makes the worker skip it on the other minutes, and between checks it keeps
its last state, so a skipped minute never shows as down. Every Search check is saved, so its
response-time chart gets a point every 5 minutes.

## What counts as a problem

A failed check only becomes an outage once the monitor has kept failing for 3 minutes, which is
`notification.gracePeriod`, with 30 seconds of slack for the cron's timing. Until then the page
shows it as up and logs nothing, and a failure that clears inside the 3 minutes never shows on the
status, the 90-day strip, the notices, the incidents page, `/api/data` or `/api/badge`. Once it
reaches 3 minutes it shows as down from its first failed check, on the same check that sends the
down alert. The stored history keeps every failure either way.

A monitor checked every few minutes waits for its next check instead: its grace period is rounded
up to a whole number of its intervals, so the down alert lands on a check. Search's is 5 minutes,
so one failed Search check shows nothing and two in a row are an outage. With 3 minutes it would
never alert, because that moment falls between its checks.

A monitor is Slow when its last two stored readings are both slower than 3000 ms, or its own
`slowMs`. One slow answer is jitter and colours nothing. Only readings since the last failure
ended count, so a failure's timeout reading never does. The API, its health check and the
database stats answer in about 0.2 to 0.3 s and under 0.8 s at their slowest. Search is a live
Audible search that answers in about 1.5 to 2 s and up to about 3.3 s while working, so it gets
`slowMs: 6000`. The overall state reads "Some services are slow" when one is Slow and none is
down.

## Adding or removing a monitor

Monitors live in the `monitors` list in `uptime.config.ts`. To add one, copy an entry and give
it a new `id`, a `name` and a `target` URL. To remove one, delete its entry;
the worker then drops its history, and renaming an `id` does the same. The `id` is what keeps a
monitor's history, so I never reuse an old one for a different URL. Edits go through a
PR into `dev` like any other change.

## Alerts

Downtime and recovery alerts go to a Discord channel and to Gotify through webhooks, on the same
rule as the page: after 3 minutes, or 5 for Search. A failure that clears sooner sends nothing,
and only an outage that sent a down alert sends a recovery one. Slow answers don't send alerts.
Changes in the error text while it's still down don't send another alert. Each webhook is skipped
when any of its secrets isn't set.

The down alert goes out on the one check that lands at the grace period. If Cloudflare skips that
cron run, no down alert is sent for that outage, though the page still shows it as down and the
recovery alert still comes.

A new monitor with `intervalMinutes` gets its first check at once, on whatever minute it was
added, so it shows on the page straight away. If that first check fails, the outage starts off
the monitor's schedule, so its down alert can miss the grace period and its recovery alert can
come on its own. Every later check lands on the interval.

The search monitors catch what the health check can't: `/health` stays ok when Audible blocks
the API's VPN exit, while every search fails.

## Secrets

| Secret | What it is |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare token with Workers, Pages and D1 edit rights |
| `CLOUDFLARE_ACCOUNT_ID` | Optional; looked up from the token when it's missing |
| `DISCORD_WEBHOOK_URL` | Discord webhook for alerts |
| `GOTIFY_URL` | Gotify message URL with no token, `https://<gotify>/message` |
| `GOTIFY_TOKEN` | Gotify app token, sent in the `X-Gotify-Key` header |

These secrets are inlined into the worker bundle at build time with `wrangler --define`, so they
never sit in the repo and never reach the page. The worker logs only a webhook's host and path,
never its query string or headers.

## Deploying

`dev` is the work branch and changes land on it by PR. Merging the `dev` to `main` PR runs
`.github/workflows/deploy.yml`, which builds the worker and the page and applies them with
Terraform and wrangler.

On a first deploy, Cloudflare can take up to about 10 minutes to start a new cron trigger. Until
the worker's first run, the page says the monitor state isn't defined yet.

## Custom domain

`status.libexdb.com` is a custom domain on the `uptimeflare-libex` Pages project. It's set in
the Cloudflare dashboard under Workers & Pages, then the project, then Custom domains. The page
is also at `uptimeflare-libex.pages.dev`.

## Cloudflare names

Every resource name here comes from one prefix, `uptimeflare-libex`, instead of upstream's fixed
`uptimeflare` names, so it can share a Cloudflare account with my other projects:

| Resource | Name |
|---|---|
| Worker | `uptimeflare-libex_worker` |
| D1 database | `uptimeflare-libex_d1` |
| Pages project | `uptimeflare-libex` |
| Old KV namespace the migration looks for | `uptimeflare-libex_kv` |

The prefix is `TF_VAR_UF_PREFIX` at the top of `deploy.yml`. These files carry the rename:

- `.github/workflows/deploy.yml`: the prefix, the Durable Object lookup, the Terraform imports
  and the Pages upload
- `deploy.tf`: the `UF_PREFIX` variable and the D1, Worker and Pages names
- `deploy/init_d1.py` and `deploy/migrate_kv.py`: the D1 and KV names
- `wrangler.toml`, `worker/wrangler.toml` and `entrypoint.sh`: the same names written out, for
  local builds and Docker

## Upstream updates

UptimeFlare's Upstream Sync workflow is disabled. It replaces everything except
`uptime.config.ts`, which would undo the rename and the repo checks, and the branch rules stop
it pushing to `main` anyway. I bring upstream changes in by hand: diff the new UptimeFlare
release against this repo on a branch off `dev`, take the changes, re-apply the rename to the
files above, and open a PR into `dev`.

## Working on it

```sh
bash scripts/install-hooks.sh
```

That installs the commit and push checks: gitleaks, a public-repo check for home-network
details, and a changelog check. `npm test` in `worker` runs the worker's tests, which run the
real worker once a minute against an in-memory store and check that the page, `/api/data` and
`/api/badge` agree with the alerts it sends.

---

## Credits and licence

Built on [UptimeFlare](https://github.com/lyc8503/UptimeFlare) by
[lyc8503](https://github.com/lyc8503), under the Apache License 2.0. My changes are under the
same licence; see [LICENSE](LICENSE) and [NOTICE](NOTICE).
