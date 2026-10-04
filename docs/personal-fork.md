# IPTV Fork Bootstrap

Prepared from the live `iptv-org/iptv` and `iptv-org/api` state observed after the 2026-10-04 upstream update (`43c6aae8d51430f4a813f43eb81865ce17f3510e`).

This fork extension is intentionally conservative: it does **not** claim any untested stream as production-ready. `fork/accepted.jsonl` starts empty; candidates must pass independent provenance and live media validation before promotion.

## Fork extension

The fork-specific overlay lives alongside upstream code without replacing the upstream README or making direct stream-file edits the long-term source of truth. Accepted custom entries live in `fork/accepted.jsonl`, are validated, and are materialized into upstream-style `streams/*.m3u` files only during CI/build.

## First promotion cycle

Start with the three strongest held candidates in `research/candidates.jsonl`:

1. Number 1 Turk
2. Power Plus
3. PowerTurk En Iyiler

Trace each exact manifest from an official player/configuration, promote only verified records into `fork/accepted.jsonl`, and let `fork-health.yml` perform repeated GET/segment validation before merge.
