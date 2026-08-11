import type { PermissionManifestEntry } from '~/types/admin'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePermissionsStore } from '~/stores/permissions'

const fetchManifest = vi.hoisted(() => vi.fn())

vi.mock('~/api/admin', () => ({
  fetchPermissionManifest: fetchManifest,
}))

const MANIFEST: PermissionManifestEntry[] = [
  { id: 'room:view', group: 'room', label: '查看房间', description: '', root_only: false, risk: 'low' },
  { id: 'room:kick', group: 'room', label: '踢出玩家', description: '', root_only: false, risk: 'medium' },
  { id: 'server:update', group: 'server', label: '更新服务器', description: '', root_only: false, risk: 'high' },
  { id: '*:*', group: 'root', label: 'Root 全权限', description: '', root_only: true, risk: 'critical' },
]

describe('permissions store (manifest-driven)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fetchManifest.mockReset()
  })

  it('loads and groups the manifest from PPB', async () => {
    fetchManifest.mockResolvedValue(MANIFEST)
    const store = usePermissionsStore()
    await store.load()
    expect(store.loaded).toBe(true)
    expect(store.error).toBe(false)
    expect(store.groups).toEqual(['room', 'root', 'server'])
    expect(store.byGroup('room').map(e => e.id)).toEqual(['room:view', 'room:kick'])
    expect(store.isRootOnly('*:*')).toBe(true)
  })

  it('flags an error without fabricating entries when PPB is unavailable', async () => {
    fetchManifest.mockRejectedValue(new Error('offline'))
    const store = usePermissionsStore()
    await store.load()
    expect(store.loaded).toBe(false)
    expect(store.error).toBe(true)
    expect(store.entries).toEqual([])
  })

  it('is idempotent without force', async () => {
    fetchManifest.mockResolvedValue(MANIFEST)
    const store = usePermissionsStore()
    await store.load()
    await store.load()
    expect(fetchManifest).toHaveBeenCalledTimes(1)
  })
})
