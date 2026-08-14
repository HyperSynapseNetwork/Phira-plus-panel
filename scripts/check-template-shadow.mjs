import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const reserved = new Set(['t', 'route', 'router', 'locale', 'notice', 'api'])
const ignored = new Set(['node_modules', '.nuxt', '.output', 'dist', 'coverage'])

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name))
      continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory())
      walk(full, out)
    else if (entry.isFile() && entry.name.endsWith('.vue'))
      out.push(full)
  }
  return out
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length
}

function aliasesFromVFor(lhs) {
  const clean = lhs.trim().replace(/^\(/, '').replace(/\)$/, '')
  return clean.split(',').map(x => x.trim()).filter(Boolean)
}

function scanText(text, label) {
  const errors = []
  const vfor = /v-for\s*=\s*["']\s*(\([^"']+?\)|[A-Za-z_$][\w$]*)\s+(?:in|of)\s+/g
  for (const m of text.matchAll(vfor)) {
    for (const alias of aliasesFromVFor(m[1])) {
      if (reserved.has(alias))
        errors.push(`${label}:${lineOf(text, m.index)}: v-for alias '${alias}' shadows a reserved composable name`)
    }
  }
  const slots = /(?:v-slot(?::[\w-]+)?|#[\w-]+)\s*=\s*["']\s*\{([^"']+)\}\s*["']/g
  for (const m of text.matchAll(slots)) {
    for (const raw of m[1].split(',')) {
      const alias = raw.split(':').pop()?.trim().split('=')[0].trim()
      if (alias && reserved.has(alias))
        errors.push(`${label}:${lineOf(text, m.index)}: slot alias '${alias}' shadows a reserved composable name`)
    }
  }
  return errors
}

// Keep a built-in negative fixture so the checker cannot silently stop seeing
// the regression it was introduced for.
if (scanText('<tr v-for="t in tasks">{{ t(\'x\') }}</tr>', 'fixture.vue').length !== 1)
  throw new Error('template-shadow self-test failed')

const errors = walk(root).flatMap(file => scanText(fs.readFileSync(file, 'utf8'), path.relative(root, file)))
if (errors.length) {
  console.error(`FAIL template shadowing:\n  ${errors.join('\n  ')}`)
  process.exit(1)
}
console.log(`template-shadow gate passed: ${walk(root).length} Vue files; reserved aliases clear`)
