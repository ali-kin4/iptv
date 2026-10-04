# Provenance Policy

## Core principle

A public URL is not automatically an authorized public distribution. Technical reachability and distribution authorization are separate gates.

## Strong evidence

Prefer, in descending order:

1. the broadcaster's official live/watch page directly loads the candidate manifest;
2. an official broadcaster-owned app/API/configuration references the candidate manifest;
3. an authorized distributor page references the manifest and the broadcaster/distributor relationship is independently documented;
4. a CDN relationship is established from the official player/configuration even when the CDN hostname differs from the broadcaster domain.

## Leads only

These may be used to discover candidates, but are not sufficient proof:

- third-party IPTV playlists;
- forums or Reddit;
- search snippets;
- GitHub issues submitted by users;
- naked CDN/IP URLs without an official-player trace.

## Automatic rejection or hold

Reject, or hold out of production pending stronger evidence, when a candidate is:

- DRM protected;
- authentication/paywall dependent;
- tokenized or session-bound;
- an Xtream/Stalker/credentialed portal;
- a temporary YouTube/Dailymotion/Twitch session manifest;
- a naked residential/ISP/IP endpoint with no official relationship;
- the same endpoint claimed for multiple unrelated channels;
- a premium channel whose free/public distribution cannot be demonstrated;
- a static promo or looping clip rather than the advertised live service.

## Evidence recording

Every accepted record should keep:

- official website and live page;
- exact candidate stream URL;
- discovery source;
- short provenance explanation;
- discovery and validation timestamps;
- final resolved URL/host after redirects;
- token/DRM/auth findings;
- geo restriction;
- technical probe results;
- reviewer decision and reason.
