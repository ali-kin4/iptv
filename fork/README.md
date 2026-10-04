# Custom Stream Overlay

`accepted.jsonl` is intentionally empty at bootstrap.

Candidates are not promoted simply because they are plausible or technically reachable. Promotion requires both provenance approval and live technical validation.

Each accepted JSONL record should minimally contain:

```json
{
  "channel_id": "ExampleTV.us",
  "feed_id": "SD",
  "country_file": "us.m3u",
  "name": "Example TV",
  "quality": "720p",
  "stream_url": "https://example.com/live/playlist.m3u8",
  "official_website": "https://example.com/",
  "official_live_page": "https://example.com/watch-live",
  "provenance_state": "VERIFIED_OFFICIAL",
  "technical_state": "PASS",
  "geo_blocked": false,
  "not_24_7": false,
  "http_referrer": null,
  "http_user_agent": null,
  "validated_at": "2026-10-04T00:00:00Z"
}
```
