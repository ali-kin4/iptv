#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const acceptedPath = process.argv[2] || path.join(ROOT, 'fork/accepted.jsonl')
const streamsDir = process.argv[3] || path.join(ROOT, 'streams')

async function readJsonl(file) {
  const text = await fs.readFile(file, 'utf8')
  return text.split(/\r?\n/).filter(Boolean).map((line, i) => {
    try { return JSON.parse(line) }
    catch (err) { throw new Error(`${file}:${i+1}: ${err.message}`) }
  })
}

function required(r, key) {
  if (r[key] === undefined || r[key] === null || r[key] === '') throw new Error(`${r.channel_id || r.name}: missing ${key}`)
  return r[key]
}

function extinf(record) {
  const feed = record.feed_id ? `@${record.feed_id}` : ''
  const id = `${required(record,'channel_id')}${feed}`
  let title = required(record,'name')
  if (record.quality) title += ` (${record.quality})`
  const labels = []
  if (record.geo_blocked) labels.push('Geo-blocked')
  if (record.not_24_7) labels.push('Not 24/7')
  if (labels.length) title += ` [${labels.join('; ')}]`
  return `#EXTINF:-1 tvg-id="${id}",${title}`
}

const rows = await readJsonl(acceptedPath)
const changed = []
for (const r of rows) {
  if (!['VERIFIED_OFFICIAL','VERIFIED_AUTHORIZED_DISTRIBUTOR'].includes(r.provenance_state)) throw new Error(`${r.channel_id}: provenance not verified`)
  if (r.technical_state !== 'PASS') throw new Error(`${r.channel_id}: technical_state must be PASS`)
  const filename = required(r,'country_file')
  if (!/^[a-z0-9_-]+\.m3u$/i.test(filename)) throw new Error(`${r.channel_id}: unsafe country_file`)
  const target = path.join(streamsDir, filename)
  let content = await fs.readFile(target, 'utf8')
  const eol = content.includes('\r\n') ? '\r\n' : '\n'
  if (content.includes(r.stream_url)) continue
  const idNeedle = `tvg-id="${r.channel_id}${r.feed_id ? '@'+r.feed_id : ''}"`
  const channelIdAlreadyPresent = content.includes(idNeedle)
  const block = [
    extinf(r),
    ...(r.http_referrer ? [`#EXTVLCOPT:http-referrer=${r.http_referrer}`] : []),
    ...(r.http_user_agent ? [`#EXTVLCOPT:http-user-agent=${r.http_user_agent}`] : []),
    required(r,'stream_url')
  ].join(eol)
  if (!content.endsWith(eol)) content += eol
  content += block + eol
  await fs.writeFile(target, content, 'utf8')
  changed.push({file:filename, channel_id:r.channel_id, channel_id_already_present:channelIdAlreadyPresent})
}
console.log(JSON.stringify({materialized:changed.length, changed}, null, 2))
