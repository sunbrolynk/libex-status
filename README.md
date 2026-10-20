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
checks each target every minute and a Cloudflare Pages site shows the history.

## What it watches

| Monitor | id | URL | Up when |
|---|---|---|---|
| API | `api` | https://libexdb.com/ | it answers 200 |
| API health | `health` | https://libexdb.com/health | it answers 200 with `"status":"ok"` |
| Database stats | `db_stats` | https://libexdb.com/db/stats | it answers 200 |

## Adding or removing a monitor

Monitors live in the `monitors` list in `uptime.config.ts`. To add one, copy an entry and give
it a new `id`, a `name` and a `target` URL. To remove one, delete its entry. The `id` is what
keeps a monitor's history, so I never reuse an old one for a different URL. Edits go through a
PR into `dev` like any other change.

## Alerts

Downtime and recovery alerts go to a Discord channel through a webhook, after a monitor has been
down for 5 minutes. Changes in the error text while it's still down don't send another alert.
With no `DISCORD_WEBHOOK_URL` secret set, no alerts are sent.

## Secrets

| Secret | What it is |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare token with Workers, Pages and D1 edit rights |
| `CLOUDFLARE_ACCOUNT_ID` | Optional; looked up from the token when it's missing |
| `DISCORD_WEBHOOK_URL` | Discord webhook for alerts |

The webhook URL is inlined into the worker bundle at build time with `wrangler --define`, so it
never sits in the repo and never reaches the page.

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
details, and a changelog check.

---

## Credits and licence

Built on [UptimeFlare](https://github.com/lyc8503/UptimeFlare) by
[lyc8503](https://github.com/lyc8503), under the Apache License 2.0. My changes are under the
same licence; see [LICENSE](LICENSE) and [NOTICE](NOTICE).
