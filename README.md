<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/readme/logo-dark.png">
  <img src="docs/readme/logo.png" alt="Libex" width="400">
</picture>

[![Status](https://img.shields.io/badge/status-status.libexdb.com-f79320)](https://status.libexdb.com)
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

| Monitor | URL | Up when |
|---|---|---|
| API | https://libexdb.com/ | it answers 200 |
| API health | https://libexdb.com/health | it answers 200 with `"status":"ok"` |
| Database stats | https://libexdb.com/db/stats | it answers 200 |

Downtime and recovery alerts go to Discord. Everything is set in `uptime.config.ts`.

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds the worker and the page and
applies them with Terraform and wrangler. It needs these repository secrets:

| Secret | What it is |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare token with Workers, Pages and D1 edit rights |
| `CLOUDFLARE_ACCOUNT_ID` | Optional; looked up from the token when it's missing |
| `DISCORD_WEBHOOK_URL` | Discord webhook for alerts; with none set, no alerts are sent |

The webhook URL is inlined into the worker bundle at build time with `wrangler --define`, so it
never sits in the repo and never reaches the page.

## Cloudflare names

Three status pages share one Cloudflare account, so every resource name here comes from one
prefix, `uptimeflare-libex`, instead of upstream's fixed `uptimeflare` names:

| Resource | Name |
|---|---|
| Worker | `uptimeflare-libex_worker` |
| D1 database | `uptimeflare-libex_d1` |
| Pages project | `uptimeflare-libex` (`uptimeflare-libex.pages.dev`) |
| Old KV namespace the migration looks for | `uptimeflare-libex_kv` |

The prefix is `TF_VAR_UF_PREFIX` at the top of `deploy.yml`. These files carry the rename:

- `.github/workflows/deploy.yml`: the prefix, the Durable Object lookup, the Terraform imports
  and the Pages upload
- `deploy.tf`: the `UF_PREFIX` variable and the D1, Worker and Pages names
- `deploy/init_d1.py` and `deploy/migrate_kv.py`: the D1 and KV names
- `wrangler.toml`, `worker/wrangler.toml` and `entrypoint.sh`: the same names written out, for
  local builds and Docker

UptimeFlare's Upstream Sync workflow replaces everything except `uptime.config.ts`, which would
undo the rename and the repo checks, and the branch rules stop it pushing to `main` anyway. I
bring upstream changes in by hand on a branch and re-apply the rename to the files above.

## Custom domain

`status.libexdb.com` is a custom domain on the `uptimeflare-libex` Pages project, added in the
Cloudflare dashboard under Workers & Pages, then the project's Custom domains tab.

## Working on it

`dev` is the work branch and changes land on it by PR. `main` deploys, and `dev` reaches it by PR.

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
