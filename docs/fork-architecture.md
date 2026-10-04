# Fork Architecture

## Goal

Keep the personal fork close to `iptv-org/iptv` while maintaining a separately auditable set of custom, provenance-reviewed stream additions.

## Decision: overlay, not permanent direct edits

Custom additions live in `fork/accepted.jsonl` as the source of truth. CI materializes them into the upstream-style `streams/*.m3u` files only inside the build workspace before running the upstream validators/generator.

This design deliberately avoids making `streams/*.m3u` the long-lived source of truth for custom entries. Upstream changes those files frequently; a small append-only overlay makes upstream synchronization much less conflict-prone and keeps provenance metadata beside every custom addition.

## Data flow

1. New discoveries enter `research/candidates.jsonl`.
2. Provenance review promotes only strong candidates to `fork/accepted.jsonl`.
3. `scripts/fork/validate-candidates.mjs` performs technical GET-based validation and writes a machine-readable validation report.
4. `scripts/fork/materialize-overlay.mjs` appends only accepted, technically passing, non-duplicate entries to an ephemeral checkout of `streams/*.m3u`.
5. Upstream scripts run against the materialized checkout:
   - `npm run playlist:format`
   - `npm run playlist:lint`
   - `npm run playlist:validate -- --log-level=error`
   - `npm run playlist:generate`
6. The generated public playlists are sanitized for obvious tokenized/credential-style URLs and published to the fork's normal `generated` branch. GitHub Pages is not required.

## Why the upstream update workflow must not be copied blindly

The live upstream `.github/workflows/update.yml` uses upstream-specific GitHub App secrets and deploys to the hard-coded repositories `iptv-org/iptv` and `iptv-org/api`. A personal fork must not attempt those writes.

The provided fork workflows use only the fork's `GITHUB_TOKEN`, never upstream App credentials, and open a synchronization PR rather than silently mutating the default branch.

## Acceptance gates

An entry may reach `fork/accepted.jsonl` only when all of these are true:

- channel/feed ID is valid in the iptv-org data model;
- channel is not blocklisted;
- official broadcaster or demonstrably authorized distributor relationship is documented;
- URL is not dependent on login, stolen/session cookies, paid credentials, or DRM circumvention;
- URL is not a short-lived tokenized/session manifest;
- GET request returns a real HLS/DASH manifest, not HTML;
- at least one media segment is reachable;
- repeated probes do not show immediate expiry or instability;
- no equivalent stream already exists upstream or in the overlay;
- geo restrictions and required public referrer/user-agent are recorded.

## State model

Research records use one of:

- `VERIFIED_OFFICIAL`
- `VERIFIED_AUTHORIZED_DISTRIBUTOR`
- `PROBABLE_BUT_UNCONFIRMED`
- `UNKNOWN`
- `REJECTED`

Technical state is separate from provenance state. A technically working URL is not accepted merely because it returns HTTP 200.
