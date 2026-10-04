#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const input = process.argv[2] || path.join(ROOT, 'fork/accepted.jsonl')
const output = process.argv[3] || path.join(ROOT, 'research/validation-results.jsonl')
const timeoutMs = Number(process.env.IPTV_PROBE_TIMEOUT_MS || 15000)
const retries = Math.max(1, Number(process.env.IPTV_PROBE_RETRIES || 2))
const allowUnverifiedResearch = process.env.IPTV_ALLOW_UNVERIFIED_RESEARCH === '1'

const TOKEN_KEYS = /(?:^|[?&])(token|auth|signature|sig|hdnts|hdnea|expires?|exp|wmsAuthSign|session|jwt|key)=[^&]+/i
const CREDENTIAL_PATH = /:\/\/[^/@\s]+:[^/@\s]+@/i
const XTREAM_PATH = /\/(live|movie|series)\/[^/]+\/[^/]+\//i
const HTMLISH = /^\s*(?:<!doctype\s+html|<html\b)/i
const DRM_MARKERS = /(?:widevine|playready|fairplay|com\.apple\.streamingkeydelivery|urn:uuid:edef8ba9|urn:uuid:9a04f079)/i

async function readJsonl(file) {
  const text = await fs.readFile(file, 'utf8').catch(err => {
    if (err.code === 'ENOENT') return ''
    throw err
  })
  return text.split(/\r?\n/).filter(Boolean).map((line, i) => {
    try { return JSON.parse(line) }
    catch (err) { throw new Error(`${file}:${i + 1}: invalid JSON: ${err.message}`) }
  })
}

function normalizedUrl(raw) {
  const u = new URL(raw)
  u.hash = ''
  for (const key of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) u.searchParams.delete(key)
  }
  u.hostname = u.hostname.toLowerCase()
  return u.toString()
}

function staticPolicy(record) {
  const url = String(record.stream_url || record.candidate_stream_url || '')
  const issues = []
  if (!url) issues.push('missing_stream_url')
  else {
    try { new URL(url) } catch { issues.push('invalid_url') }
    if (TOKEN_KEYS.test(url)) issues.push('tokenized_or_expiring_query')
    if (CREDENTIAL_PATH.test(url)) issues.push('embedded_credentials')
    if (XTREAM_PATH.test(url)) issues.push('xtream_style_path')
  }
  if (!allowUnverifiedResearch && !['VERIFIED_OFFICIAL', 'VERIFIED_AUTHORIZED_DISTRIBUTOR'].includes(record.provenance_state)) {
    issues.push('provenance_not_verified')
  }
  return issues
}

async function fetchWithTimeout(url, options = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, {
      redirect: 'follow',
      ...options,
      signal: ctrl.signal,
      headers: {
        'User-Agent': options.headers?.['User-Agent'] || 'Mozilla/5.0 IPTV-Fork-Validator/1.0',
        ...(options.headers || {})
      }
    })
  } finally {
    clearTimeout(timer)
  }
}

function resolveUri(base, candidate) {
  return new URL(candidate, base).toString()
}

function parseHlsNextUris(manifest, base) {
  const lines = manifest.split(/\r?\n/).map(x => x.trim()).filter(Boolean)
  const out = []
  let expectVariant = false
  for (const line of lines) {
    if (line.startsWith('#EXT-X-KEY:')) {
      if (/METHOD=(?!NONE)/i.test(line)) out.push({type:'key', uri:(line.match(/URI="([^"]+)"/i)||[])[1] || null})
    }
    if (line.startsWith('#EXT-X-STREAM-INF:')) { expectVariant = true; continue }
    if (!line.startsWith('#')) {
      out.push({type: expectVariant ? 'variant' : 'segment', uri: resolveUri(base, line)})
      expectVariant = false
    }
  }
  return out
}

async function probeRecord(record) {
  const url = String(record.stream_url || record.candidate_stream_url || '')
  const headers = {}
  if (record.http_referrer) headers.Referer = record.http_referrer
  if (record.http_user_agent) headers['User-Agent'] = record.http_user_agent
  const started = Date.now()
  const res = await fetchWithTimeout(url, {headers})
  const finalUrl = res.url
  const contentType = (res.headers.get('content-type') || '').toLowerCase()
  const body = await res.text()
  const result = {
    http_status: res.status,
    final_url: finalUrl,
    content_type: contentType,
    elapsed_ms: Date.now() - started,
    manifest_kind: null,
    segment_status: null,
    drm_markers: DRM_MARKERS.test(body),
    cookie_set: Boolean(res.headers.get('set-cookie'))
  }
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), {probe: result})
  if (HTMLISH.test(body) || contentType.includes('text/html')) throw Object.assign(new Error('HTML returned instead of media manifest'), {probe: result})

  if (body.includes('#EXTM3U')) {
    result.manifest_kind = 'HLS'
    const uris = parseHlsNextUris(body, finalUrl)
    const key = uris.find(x => x.type === 'key' && x.uri)
    if (key && result.drm_markers) throw Object.assign(new Error('DRM marker detected'), {probe: result})
    let media = uris.find(x => x.type === 'segment')
    if (!media) {
      const variant = uris.find(x => x.type === 'variant')
      if (!variant) throw Object.assign(new Error('HLS manifest has no variant or media segment'), {probe: result})
      const vr = await fetchWithTimeout(variant.uri, {headers})
      const vbody = await vr.text()
      if (!vr.ok || !vbody.includes('#EXTM3U')) throw Object.assign(new Error('HLS variant did not return a valid manifest'), {probe: result})
      media = parseHlsNextUris(vbody, vr.url).find(x => x.type === 'segment')
    }
    if (!media) throw Object.assign(new Error('No media segment found'), {probe: result})
    const sr = await fetchWithTimeout(media.uri, {headers:{...headers, Range:'bytes=0-65535'}})
    result.segment_status = sr.status
    if (!(sr.ok || sr.status === 206)) throw Object.assign(new Error(`media segment HTTP ${sr.status}`), {probe: result})
    await sr.body?.cancel().catch(()=>{})
    return result
  }

  if (/<MPD[\s>]/i.test(body)) {
    result.manifest_kind = 'DASH'
    if (result.drm_markers) throw Object.assign(new Error('DRM marker detected'), {probe: result})
    // Fail closed: a DASH manifest alone is not enough. Promotion requires a real media-segment probe.
    result.segment_status = 'DASH_MEDIA_PROBE_REQUIRED'
    throw Object.assign(new Error('DASH media-segment probing is not implemented; refusing production pass'), {probe: result})
  }

  throw Object.assign(new Error('Response is not recognizable HLS or DASH'), {probe: result})
}

const rows = await readJsonl(input)
const seen = new Map()
const results = []
for (const record of rows) {
  const url = String(record.stream_url || record.candidate_stream_url || '')
  const staticIssues = staticPolicy(record)
  if (url) {
    try {
      const n = normalizedUrl(url)
      if (seen.has(n)) staticIssues.push(`duplicate_of:${seen.get(n)}`)
      else seen.set(n, record.channel_id || record.name || n)
    } catch {}
  }
  const result = {
    channel_id: record.channel_id || null,
    name: record.name || null,
    url,
    checked_at: new Date().toISOString(),
    static_issues: staticIssues,
    attempts: [],
    pass: false
  }
  if (staticIssues.length) {
    results.push(result)
    continue
  }
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const probe = await probeRecord(record)
      result.attempts.push({attempt, ok:true, ...probe})
    } catch (err) {
      result.attempts.push({attempt, ok:false, error:String(err.message || err), ...(err.probe || {})})
    }
    if (attempt < retries) await new Promise(r => setTimeout(r, 1500))
  }
  result.pass = result.attempts.length === retries && result.attempts.every(x => x.ok)
  results.push(result)
}
await fs.mkdir(path.dirname(output), {recursive:true})
await fs.writeFile(output, results.map(x => JSON.stringify(x)).join('\n') + (results.length ? '\n' : ''), 'utf8')
console.log(JSON.stringify({input, output, checked:results.length, passed:results.filter(x=>x.pass).length, failed:results.filter(x=>!x.pass).length}, null, 2))
