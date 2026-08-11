import { beforeEach, describe, expect, it } from 'vitest'
import { clearWindowGeometry, DEFAULT_GEOMETRY, loadWindowGeometry, saveWindowGeometry } from '~/utils/window-geometry'

describe('window geometry (device-local, §22.5)', () => {
  beforeEach(() => {
    globalThis.localStorage.clear()
  })

  it('returns defaults when nothing is stored', () => {
    expect(loadWindowGeometry('a')).toEqual(DEFAULT_GEOMETRY)
  })

  it('round-trips a saved geometry', () => {
    saveWindowGeometry('a', { x: 12, y: 34, width: 500, height: 400 })
    expect(loadWindowGeometry('a')).toEqual({ x: 12, y: 34, width: 500, height: 400 })
  })

  it('is namespaced per window id', () => {
    saveWindowGeometry('a', { x: 1, y: 2, width: 300, height: 200 })
    expect(loadWindowGeometry('b')).toEqual(DEFAULT_GEOMETRY)
  })

  it('clamps degenerate sizes back to sane ranges', () => {
    saveWindowGeometry('a', { x: 0, y: 0, width: 10, height: 5000 })
    const g = loadWindowGeometry('a')
    expect(g.width).toBeGreaterThanOrEqual(240)
    expect(g.height).toBeLessThanOrEqual(900)
  })

  it('falls back to defaults on corrupt JSON', () => {
    globalThis.localStorage.setItem('panel:desktop-window:geometry:bad', '{not json')
    expect(loadWindowGeometry('bad')).toEqual(DEFAULT_GEOMETRY)
  })

  it('clear removes the stored geometry', () => {
    saveWindowGeometry('a', { x: 1, y: 2, width: 300, height: 200 })
    clearWindowGeometry('a')
    expect(loadWindowGeometry('a')).toEqual(DEFAULT_GEOMETRY)
  })
})
