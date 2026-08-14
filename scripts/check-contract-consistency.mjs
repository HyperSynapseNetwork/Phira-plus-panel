#!/usr/bin/env node
/**
 * Panel runtime contract-consistency gate.
 *
 * The scanner deliberately walks the runtime source tree rather than a fragile
 * directory allowlist. R4 modularisation moved API calls into feature-domain api modules;
 * a directory whitelist made the old gate report 4/0/0 while ~69 calls existed.
 *
 * Gate guarantees:
 *   1. every detected runtime HTTP/WS call resolves in frozen PPB OpenAPI/allowlist;
 *   2. features/ is definitely scanned;
 *   3. total call count cannot silently collapse below the reviewed baseline;
 *   4. an internal synthetic unknown endpoint MUST be rejected by the matcher.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join, relative, sep } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const OPENAPI_URL = process.env.PPB_OPENAPI_URL
  || 'https://raw.githubusercontent.com/HyperSynapseNetwork/Phira-plus-Backend/main/contracts/openapi.json'
const SCAN_RE = /\.(ts|tsx|vue|mjs|js)$/
const EXCLUDED_DIRS = new Set([
  'node_modules', '.nuxt', '.output', 'dist', '.git', 'coverage',
  'contracts', 'types', 'scripts', 'docs', 'public', '.github',
])
const EXCLUDED_FILES = new Set(['nuxt.config.ts'])
const baseline = JSON.parse(readFileSync(resolve(ROOT, 'scripts/contract-scan-baseline.json'), 'utf8'))

function indexFromJson(openapi) {
  const entries = []
  for (const [path, ops] of Object.entries(openapi.paths ?? {})) {
    const segments = path.split('/').filter(Boolean).map(s => (s.startsWith('{') ? '{param}' : s))
    const methods = new Set(Object.keys(ops).filter(m => /^(get|post|put|patch|delete|options|head)$/.test(m)))
    entries.push({ path, segments, methods })
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
    entries.push({ path: m[1], segments, methods })
  }
  return entries
}

async function loadIndex() {
  if (process.env.PPB_OPENAPI)
    return indexFromJson(JSON.parse(readFileSync(process.env.PPB_OPENAPI, 'utf8')))

  const cached = resolve(ROOT, 'contracts/openapi.json')
  if (existsSync(cached))
    return indexFromJson(JSON.parse(readFileSync(cached, 'utf8')))

  try {
    const res = await fetch(OPENAPI_URL)
    if (res.ok)
      return indexFromJson(await res.json())
  }
  catch {
    // Offline CI/dev falls through to the generated mirror.
  }

  const mirror = resolve(ROOT, 'types/generated.ts')
  if (existsSync(mirror))
    return indexFromTypes(readFileSync(mirror, 'utf8'))
  throw new Error('no OpenAPI source available (set PPB_OPENAPI or run scripts/gen-types.sh)')
}

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
  for (const m of src.matchAll(/\.(get|post|put|patch|delete)\(\s*([`'"])([^`'"]*)\2/g)) {
    const path = normalizePath(m[3])
    if (path)
      calls.push({ method: m[1].toUpperCase(), path, index: m.index })
  }
  for (const m of src.matchAll(/\.fetch\(\s*([`'"])([^`'"]*)\1([\s\S]{0,220}?)\)/g)) {
    const path = normalizePath(m[2])
    if (!path)
      continue
    const method = m[3].match(/method:\s*['"]([A-Za-z]+)['"]/)?.[1] ?? 'GET'
    calls.push({ method: method.toUpperCase(), path, index: m.index })
  }
  for (const m of src.matchAll(/\$fetch\(\s*([`'"])([^`'"]*)\1([\s\S]{0,220}?)\)/g)) {
    const path = normalizePath(m[2])
    if (!path)
      continue
    const method = m[3].match(/method:\s*['"]([A-Za-z]+)['"]/)?.[1] ?? 'GET'
    calls.push({ method: method.toUpperCase(), path, index: m.index })
  }
  return calls
}

function findMatch(entries, call) {
  const callSegs = call.path.split('/').filter(Boolean)
  for (const e of entries) {
    if (e.segments.length !== callSegs.length)
      continue
    let ok = true
    for (let i = 0; i < e.segments.length; i++) {
      if (e.segments[i] !== '{param}' && e.segments[i] !== callSegs[i]) {
        ok = false
        break
      }
    }
    if (ok && e.methods.has(call.method.toLowerCase()))
      return e
  }
  return null
}

function collectRuntimeFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry))
      continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectRuntimeFiles(full, out)
      continue
    }
    if (!SCAN_RE.test(entry) || EXCLUDED_FILES.has(entry) || entry === 'generated.ts')
      continue
    out.push(full)
  }
  return out
}

const allowlist = JSON.parse(readFileSync(resolve(ROOT, 'scripts/contract-allowlist.json'), 'utf8'))
function isAllowed(method, path) {
  return allowlist.allowed.some(a => a.method === method && a.path === path)
}

function selfTest(index) {
  const synthetic = `api.get('/api/v1/__contract_checker_self_test__')`
  const calls = extractCalls(synthetic)
  if (calls.length !== 1)
    throw new Error(`self-test failed: extractor found ${calls.length} synthetic calls`)
  if (findMatch(index, calls[0]))
    throw new Error('self-test failed: nonexistent endpoint unexpectedly matched OpenAPI')

  const known = index.find(e => e.methods.has('get') && e.path.startsWith('/api/v1/'))
  if (!known)
    throw new Error('self-test failed: OpenAPI has no GET endpoint to validate matcher')
  const concrete = '/' + known.segments.map((s, i) => s === '{param}' ? `selftest-${i}` : s).join('/')
  if (!findMatch(index, { method: 'GET', path: concrete }))
    throw new Error(`self-test failed: known endpoint matcher failed for ${known.path}`)
}

async function main() {
  const index = await loadIndex()
  selfTest(index)

  const files = collectRuntimeFiles(ROOT)
  let hits = 0
  let allowed = 0
  let scannedCalls = 0
  let featureCalls = 0
  const misses = []
  const byTop = new Map()

  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    const rel = relative(ROOT, file)
    const top = rel.split(sep)[0]
    const calls = extractCalls(src)
    if (calls.length)
      byTop.set(top, (byTop.get(top) ?? 0) + calls.length)
    scannedCalls += calls.length
    if (top === 'features')
      featureCalls += calls.length

    for (const call of calls) {
      const loc = `${rel}:${lineAt(src, call.index)}`
      if (call.path.startsWith('/ws/v1')) {
        if (allowlist.ws.some(p => p === call.path))
          allowed++
        else
          misses.push({ loc, method: call.method, path: call.path, why: 'WS endpoint not registered' })
        continue
      }
      if (findMatch(index, call))
        hits++
      else if (isAllowed(call.method, call.path))
        allowed++
      else
        misses.push({ loc, method: call.method, path: call.path, why: 'not in PPB OpenAPI' })
    }
  }

  console.log(`contract-consistency: ${hits} hit, ${allowed} allowed, ${misses.length} FAIL; scanned ${scannedCalls} runtime calls`)
  console.log(`contract-consistency: source distribution ${[...byTop.entries()].sort().map(([k, v]) => `${k}=${v}`).join(', ')}`)
  console.log('contract-consistency: synthetic unknown-endpoint self-test PASS')

  for (const miss of misses)
    console.log(`  FAIL ${miss.loc}  ${miss.method} ${miss.path} — ${miss.why}`)

  if (featureCalls < baseline.minimumFeatureCalls) {
    misses.push({ loc: 'features/**', method: '*', path: '*', why: `feature call-count collapse: ${featureCalls} < ${baseline.minimumFeatureCalls}` })
    console.error(`contract-consistency: FAIL — feature scan collapsed to ${featureCalls}; minimum is ${baseline.minimumFeatureCalls}`)
  }
  if (scannedCalls < baseline.minimumRuntimeCalls) {
    misses.push({ loc: '.', method: '*', path: '*', why: `runtime call-count collapse: ${scannedCalls} < ${baseline.minimumRuntimeCalls}` })
    console.error(`contract-consistency: FAIL — total scan collapsed to ${scannedCalls}; minimum is ${baseline.minimumRuntimeCalls}`)
  }

  if (misses.length > 0) {
    console.error('contract-consistency: FAIL — fix the endpoint/allowlist or the scanner coverage; never lower baselines to hide missing coverage.')
    process.exit(1)
  }
  console.log('contract-consistency: OK')
}

main().catch((err) => {
  console.error(`contract-consistency: error — ${err.message}`)
  process.exit(1)
})
