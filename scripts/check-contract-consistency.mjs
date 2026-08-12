#!/usr/bin/env node
/**
 * Panel contract-consistency check (spec: DESIGN/CONTRACT_CONSISTENCY_TEST.md).
 *
 * Scans panel source for HTTP/WS call tuples (method, path) and asserts every
 * call resolves in the PPB OpenAPI contract (same method, same path, with
 * `{param}` wildcard matching for dynamic segments). A miss is a FAIL and the
 * CI step exits non-zero — forcing contract registration before consumption.
 *
 * OpenAPI source priority:
 *   1. $PPB_OPENAPI         — local openapi.json (dev override)
 *   2. ./contracts/openapi.json — vendored cache
 *   3. PPB GitHub raw URL   — `contracts/openapi.json` (authoritative once published)
 *   4. ./types/generated.ts — openapi-typescript mirror of the PPB contract (local cache)
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const OPENAPI_URL = process.env.PPB_OPENAPI_URL
  || 'https://raw.githubusercontent.com/HyperSynapseNetwork/Phira-plus-Backend/main/contracts/openapi.json'

const SCAN_DIRS = ['api', 'composables', 'pages', 'stores', 'utils']
const SCAN_RE = /\.(ts|vue|mjs)$/
// types/*.ts are pure type declarations; types/generated.ts IS the contract.
const SCAN_TYPES = false

// ---------------------------------------------------------------------------
// OpenAPI index
// ---------------------------------------------------------------------------
function indexFromJson(openapi) {
  const entries = []
  for (const [path, ops] of Object.entries(openapi.paths ?? {})) {
    const segments = path.split('/').filter(Boolean).map(s => (s.startsWith('{') ? '{param}' : s))
    const methods = new Set(Object.keys(ops).filter(m => /^(get|post|put|patch|delete|options|head)$/.test(m)))
    entries.push({ segments, methods })
  }
  return entries
}

function indexFromTypes(src) {
  const entries = []
  const pathRe = /^\s{4}"(\/api\/v1[^"]+|\/ws\/v1[^"]+)":\s*\{([\s\S]*?)\n\s{4}\};/gm
  for (const m of src.matchAll(pathRe)) {
    const segments = m[1].split('/').filter(Boolean).map(s => (s.startsWith('{') ? '{param}' : s))
    const methods = new Set()
    for (const mm of m[2].matchAll(/^\s{8}(get|post|put|patch|delete|options|head):\s*(?!never)/gm))
      methods.add(mm[1])
    entries.push({ segments, methods })
  }
  return entries
}

async function loadIndex() {
  // 1. env override
  if (process.env.PPB_OPENAPI) {
    return indexFromJson(JSON.parse(readFileSync(process.env.PPB_OPENAPI, 'utf8')))
  }
  // 2. vendored cache
  const cached = resolve(ROOT, 'contracts/openapi.json')
  if (existsSync(cached)) {
    return indexFromJson(JSON.parse(readFileSync(cached, 'utf8')))
  }
  // 3. PPB raw URL
  try {
    const res = await fetch(OPENAPI_URL)
    if (res.ok) {
      return indexFromJson(await res.json())
    }
  }
  catch {
    // fall through to the local mirror
  }
  // 4. types/generated.ts mirror
  const mirror = resolve(ROOT, 'types/generated.ts')
  if (existsSync(mirror)) {
    return indexFromTypes(readFileSync(mirror, 'utf8'))
  }
  throw new Error('no OpenAPI source available (set PPB_OPENAPI or run scripts/gen-types.sh)')
}

// ---------------------------------------------------------------------------
// Call extraction
// ---------------------------------------------------------------------------
function normalizePath(p) {
  if (!p || !p.startsWith('/'))
    return null
  let path = p.split('?')[0]
  path = path.replace(/\$\{[^}]+\}/g, '{param}').replace(/\{[^}]+\}/g, '{param}')
  if (!path.startsWith('/api/v1') && !path.startsWith('/ws/v1'))
    path = `/api/v1${path}`
  if (path === '/api/v1' || path === '/ws/v1')
    return null
  return path
}

function lineAt(src, index) {
  let line = 1
  for (let i = 0; i < index && i < src.length; i++) {
    if (src[i] === '\n')
      line++
  }
  return line
}

function extractCalls(src) {
  const calls = []
  // method-chained client calls: .get/.post/.put/.patch/.delete('path' | `path`)
  for (const m of src.matchAll(/\.(get|post|put|patch|delete)\(\s*([`'"])([^`'"]*)\2/g)) {
    const path = normalizePath(m[3])
    if (path)
      calls.push({ method: m[1].toUpperCase(), path, index: m.index })
  }
  // .fetch('path', { method: 'X' })
  for (const m of src.matchAll(/\.fetch\(\s*([`'"])([^`'"]*)\1([\s\S]{0,220}?)\)/g)) {
    const path = normalizePath(m[2])
    if (!path)
      continue
    const method = m[3].match(/method:\s*['"]([A-Za-z]+)['"]/)?.[1] ?? 'GET'
    calls.push({ method: method.toUpperCase(), path, index: m.index })
  }
  // $fetch('path', { method: 'X' })
  for (const m of src.matchAll(/\$fetch\(\s*([`'"])([^`'"]*)\1([\s\S]{0,220}?)\)/g)) {
    const path = normalizePath(m[2])
    if (!path)
      continue
    const method = m[3].match(/method:\s*['"]([A-Za-z]+)['"]/)?.[1] ?? 'GET'
    calls.push({ method: method.toUpperCase(), path, index: m.index })
  }
  return calls
}

// ---------------------------------------------------------------------------
// Matching + allowlist
// ---------------------------------------------------------------------------
function findMatch(entries, call) {
  const callSegs = call.path.split('/').filter(Boolean)
  for (const e of entries) {
    if (e.segments.length !== callSegs.length)
      continue
    let ok = true
    for (let i = 0; i < e.segments.length; i++) {
      const es = e.segments[i]
      if (es === '{param}')
        continue
      if (es !== callSegs[i]) {
        ok = false
        break
      }
    }
    if (ok && e.methods.has(call.method.toLowerCase()))
      return e
  }
  return null
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function collectFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...collectFiles(full))
    }
    else if (SCAN_RE.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const allowlist = JSON.parse(readFileSync(resolve(ROOT, 'scripts/contract-allowlist.json'), 'utf8'))

function isAllowed(method, path) {
  return allowlist.allowed.some(a => a.method === method && a.path === path)
}

async function main() {
  const index = await loadIndex()
  let hits = 0
  let allowed = 0
  const misses = []

  for (const dir of SCAN_DIRS) {
    const abs = resolve(ROOT, dir)
    if (!existsSync(abs))
      continue
    for (const file of collectFiles(abs)) {
      const src = readFileSync(file, 'utf8')
      const rel = relative(ROOT, file)
      for (const call of extractCalls(src)) {
        const loc = `${rel}:${lineAt(src, call.index)}`
        if (call.path.startsWith('/ws/v1')) {
          if (allowlist.ws.some(p => p === call.path)) {
            allowed++
          }
          else {
            misses.push({ loc, method: call.method, path: call.path, why: 'WS endpoint not registered' })
          }
          continue
        }
        if (findMatch(index, call)) {
          hits++
        }
        else if (isAllowed(call.method, call.path)) {
          allowed++
        }
        else {
          misses.push({ loc, method: call.method, path: call.path, why: 'not in PPB OpenAPI' })
        }
      }
    }
  }

  console.log(`contract-consistency: ${hits} hit, ${allowed} allowed, ${misses.length} FAIL`)
  for (const miss of misses) {
    console.log(`  FAIL ${miss.loc}  ${miss.method} ${miss.path} — ${miss.why}`)
  }
  if (misses.length > 0) {
    console.error('contract-consistency: FAIL — unregistered calls found. Register them in PPB OpenAPI or add to scripts/contract-allowlist.json.')
    process.exit(1)
  }
  console.log('contract-consistency: OK')
}

main().catch((err) => {
  console.error(`contract-consistency: error — ${err.message}`)
  process.exit(1)
})
