#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(process.argv[2] || '.gh-pages')
const JWT = /[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/
const TOKEN_QUERY = /(?:^|[?&])(token|auth|signature|sig|hdnts|hdnea|expires?|exp|wmsAuthSign|session|jwt|key|akes)=[^&]+/i
const EMBEDDED_CREDS = /:\/\/[^/@\s]+:[^/@\s]+@/i
const XTREAM_PATH = /\/(live|movie|series)\/[^/]+\/[^/]+\//i

async function walk(dir) {
  const out = []
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...await walk(full))
    else if (ent.isFile() && ent.name.endsWith('.m3u')) out.push(full)
  }
  return out
}

function unsafe(line) {
  const s = line.trim()
  if (!/^https?:\/\//i.test(s)) return false
  return JWT.test(s) || TOKEN_QUERY.test(s) || EMBEDDED_CREDS.test(s) || XTREAM_PATH.test(s)
}

function sanitizeM3u(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  const output = []
  let block = []
  let removed = 0

  const flush = () => {
    if (!block.length) return
    const shouldDrop = block.some(unsafe)
    if (shouldDrop) removed += 1
    else output.push(...block)
    block = []
  }

  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      flush()
      block = [line]
    } else if (block.length) {
      block.push(line)
    } else {
      output.push(line)
    }
  }
  flush()

  while (output.length && output.at(-1) === '') output.pop()
  return { text: output.join(eol) + eol, removed }
}

const files = await walk(root)
let totalRemoved = 0
let changedFiles = 0

for (const file of files) {
  const before = await fs.readFile(file, 'utf8')
  const result = sanitizeM3u(before)
  if (result.removed) {
    await fs.writeFile(file, result.text, 'utf8')
    changedFiles += 1
    totalRemoved += result.removed
  }
}

console.log(JSON.stringify({
  root,
  files_checked: files.length,
  files_changed: changedFiles,
  unsafe_entries_removed: totalRemoved
}, null, 2))
