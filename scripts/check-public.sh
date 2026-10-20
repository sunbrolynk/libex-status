#!/usr/bin/env bash
# Blocks anything that should never be in this repo. On a public repo that's home-network details
# (private addresses, LAN hostnames and paths, my node names), unexpected binary files and commit
# identities other than GitHub no-reply addresses. On every repo it's writing that isn't in my
# voice and AI attribution.
#
# Usage: check-public.sh             scan what is staged (pre-commit, CI)
#        check-public.sh --msg FILE  scan a commit message (commit-msg)
#        check-public.sh --history   scan every commit, message and identity on every ref (pre-push, CI)
#
# Two lists stay on my machine (gitignored), so neither ever lands here: .infra-names holds my
# node names (one per line, plain text) and .blocked-words holds wording I never publish (one
# extended regex per line). CI has no copy of either, so it runs every other check.
#
# The patterns are written so they never match their own source, which lets this file scan
# itself like any other: [x] brackets keep the literal words out.
set -euo pipefail

public_repo=true

repo_root="$(git rev-parse --show-toplevel)"
names="$repo_root/.infra-names"
words="$repo_root/.blocked-words"

octet='[0-9]{1,3}'
ip="(10\.$octet|192\.168|172\.(1[6-9]|2[0-9]|3[01])|100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])|169\.254)\.$octet\.$octet"
ula='(^|[^0-9a-f:])(f[cd][0-9a-f]{2}|fe[89ab][0-9a-f]):[0-9a-f]{0,4}:'
host='[a-z0-9-]+\.(local|localdomain|lan|home|home\.arpa|internal|corp|ts\.net)([^a-z0-9-]|$)'
# A dotless host after a network scheme. UptimeFlare's own worker:// and globalping:// proxy
# schemes name a region, not a host, so they are left out.
bare_url='(https?|wss?|ftps?|ssh|smb|nfs|rtsp|tcp)://([^/@ ]*@)?[a-z0-9-]{2,}([^a-z0-9.@-]|$)'
lan_path='(^|[^a-z0-9_.~-])/(mnt|srv|media|home|Users)/|\\\\[a-z0-9.-]+\\|[a-z]:\\U[s]ers\\'
voice="(^|[^a-z'])(w[e]|w[e]'re|w[e]'ve|w[e]'ll|o[u]r|o[u]rs|o[u]rselves)([^a-z']|$)"
attribution='c[o]-authored-by|c[l]aude|a[n]thropic|g[e]nerated (with|by) .*(a[i]|c[l]aude|c[o]pilot|c[h]atgpt)'

# Upstream UptimeFlare files whose sample data trips the infra patterns (an airport list, example
# configs, a stock .gitignore). They are lyc8503's and never carry my details.
upstream_noise=(':!util/iata.ts' ':!uptime.config.full.ts' ':!worker/.gitignore')
# The files I write. Everything else is upstream UptimeFlare code in lyc8503's own words.
mine=(README.md CHANGELOG.md SECURITY.md NOTICE uptime.config.ts scripts .github/CODEOWNERS
      .github/dependabot.yml .github/workflows/checks.yml .gitleaks.toml)

found=0
hit() { echo "Blocked ($1):" >&2; sed 's/^/    /' >&2; found=1; }

# Each mode defines search (grep flags in, matching lines out); scan runs the infra patterns through it.
check() { local out; out="$(search "${@:2}" || true)"; [[ -z "$out" ]] || hit "$1" <<< "$out"; }
scan() {
    [[ "$public_repo" == true ]] || return 0
    check "private or link-local IP" -iE -e "$ip" -e "$ula"
    check "home-network hostname" -iE -e "$host" -e "$bare_url"
    check "LAN or home path" -iE -e "$lan_path"
    if [[ -s "$names" ]]; then check "node name from .infra-names" -iwF -f "$names"; fi
}
voice_check() {
    check "writing that isn't mine" -iE -e "$voice"
    if [[ -s "$words" ]]; then check "wording from .blocked-words" -iE -f "$words"; fi
}
attribution_check() { check "AI attribution" -iE -e "$attribution"; }

case "${1:-}" in
    --msg)
        msg="$(grep -v '^#' "$2" || true)"
        search() { grep -n "$@" <<< "$msg"; }
        scan
        voice_check
        attribution_check
        ;;
    --history)
        history="$(git log --all -p --format='commit %H%n%B' -- . "${upstream_noise[@]}")"
        search() { grep -n "$@" <<< "$history"; }
        scan
        messages="$(git log --all --format='commit %H%n%B')"
        search() { grep -n "$@" <<< "$messages"; }
        attribution_check
        if [[ "$public_repo" == true ]]; then
            # GitHub's own merge commits are committed by noreply@github.com; everything else is mine or a bot's no-reply.
            identities="$(git log --all --format='%h author %ae%n%h committer %ce' | grep -vE ' ([0-9]+\+)?[a-z0-9-]+(\[bot\])?@users\.noreply\.github\.com$| noreply@github\.com$' || true)"
            [[ -z "$identities" ]] || hit "commit email that isn't a GitHub no-reply address" <<< "$identities"
        fi
        ;;
    "")
        search() { git grep --cached -nI "$@" -- . "${upstream_noise[@]}"; }
        scan
        search() { git grep --cached -nI "$@" -- "${mine[@]}"; }
        voice_check
        attribution_check
        if [[ "$public_repo" == true ]]; then
            # git grep -I skips binary files, so nothing above can see inside them; only the page images belong here.
            binaries="$(comm -23 <(git grep --cached -l -e '' | sort) <(git grep --cached -I -l -e '' | sort) | grep -vE '^(public|docs)/([a-z0-9_-]+/)*[a-z0-9_-]+\.png$' || true)"
            [[ -z "$binaries" ]] || hit "binary file (the text checks can't read it)" <<< "$binaries"
        fi
        ;;
    *) echo "usage: check-public.sh [--msg FILE | --history]" >&2; exit 2 ;;
esac

exit "$found"
