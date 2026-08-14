/** Small display-format helpers. Locale follows the active Panel document language. */
function localeTag(): string {
  if (typeof document !== 'undefined') {
    const lang = document.documentElement.lang.toLowerCase()
    if (lang.startsWith('en')) return 'en-US'
    if (lang.startsWith('zh')) return 'zh-CN'
  }
  return 'zh-CN'
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(localeTag(), { dateStyle: 'medium', timeStyle: 'medium', hour12: false }).format(d)
}

export function timeAgo(iso?: string): string {
  if (!iso) return '—'
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return '—'
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000))
  const rtf = new Intl.RelativeTimeFormat(localeTag(), { numeric: 'auto' })
  if (seconds < 60) return rtf.format(-seconds, 'second')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  return rtf.format(-Math.floor(hours / 24), 'day')
}

export function formatDuration(secs?: number): string {
  if (secs == null) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function formatNumber(n: number | undefined | null): string {
  if (n == null) return '—'
  return n.toLocaleString(localeTag())
}
