/**
 * Desktop Window geometry persistence (§22.5).
 *
 * `enabled` lives in the cross-device `panel` account preference; x/y/w/h is a
 * **device** preference — stored only on this machine (localStorage), never in
 * account prefs. This module is the single read/write point so the behaviour is
 * testable and consistent across windows.
 */

export interface WindowGeometry {
  x: number
  y: number
  width: number
  height: number
}

const STORAGE_PREFIX = 'panel:desktop-window:geometry:'

export const DEFAULT_GEOMETRY: WindowGeometry = { x: 80, y: 80, width: 420, height: 300 }

/** Clamp within a sane range so a mis-saved value cannot hide the window off-screen. */
function sanitize(g: Partial<WindowGeometry>): WindowGeometry {
  const fallback = DEFAULT_GEOMETRY
  return {
    x: Number.isFinite(g.x) ? g.x! : fallback.x,
    y: Number.isFinite(g.y) ? g.y! : fallback.y,
    width: Math.max(240, Math.min(1200, Number.isFinite(g.width) ? g.width! : fallback.width)),
    height: Math.max(160, Math.min(900, Number.isFinite(g.height) ? g.height! : fallback.height)),
  }
}

export function loadWindowGeometry(id: string): WindowGeometry {
  try {
    const raw = globalThis.localStorage?.getItem(`${STORAGE_PREFIX}${id}`)
    if (!raw)
      return { ...DEFAULT_GEOMETRY }
    return sanitize(JSON.parse(raw) as Partial<WindowGeometry>)
  }
  catch {
    return { ...DEFAULT_GEOMETRY }
  }
}

export function saveWindowGeometry(id: string, geometry: WindowGeometry): void {
  try {
    globalThis.localStorage?.setItem(`${STORAGE_PREFIX}${id}`, JSON.stringify(sanitize(geometry)))
  }
  catch {
    // storage unavailable (private mode / non-browser) — ignore, in-memory only
  }
}

export function clearWindowGeometry(id: string): void {
  try {
    globalThis.localStorage?.removeItem(`${STORAGE_PREFIX}${id}`)
  }
  catch {
    // ignore
  }
}
