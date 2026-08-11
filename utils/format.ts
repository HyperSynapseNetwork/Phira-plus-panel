/** Small display-format helpers (time, durations). */

export function formatDateTime(iso?: string): string {
  if (!iso)
    return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime()))
    return iso
  return d.toLocaleString('zh-CN', { hour12: false })
}

export function timeAgo(iso?: string): string {
  if (!iso)
    return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t))
    return '—'
  const secs = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (secs < 5)
    return '刚刚'
  if (secs < 60)
    return `${secs} 秒前`
  const mins = Math.floor(secs / 60)
  if (mins < 60)
    return `${mins} 分钟前`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)
    return `${hrs} 小时前`
  return `${Math.floor(hrs / 24)} 天前`
}

export function formatDuration(secs?: number): string {
  if (secs == null)
    return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0)
    return `${h}h ${m}m`
  if (m > 0)
    return `${m}m ${s}s`
  return `${s}s`
}

export function formatNumber(n: number | undefined | null): string {
  if (n == null)
    return '—'
  return n.toLocaleString('zh-CN')
}
