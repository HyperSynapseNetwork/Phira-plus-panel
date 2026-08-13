import { describe, expect, it } from 'vitest'
import { localTranslate } from '~/utils/log-translator'

describe('log translator (§19.2, rules-based)', () => {
  it('resolves known error codes', () => {
    const t = localTranslate({ code: 'PMP_OPENUDS_TIMEOUT' })
    expect(t?.title).toContain('超时')
    expect(t?.module).toBe('OpenUDS')
  })

  it('falls back on message patterns', () => {
    const t = localTranslate({ message: 'connection refused to postgres' })
    expect(t?.title).toContain('连接被拒绝')
  })

  it('returns null when nothing matches', () => {
    expect(localTranslate({ message: 'random informational text' })).toBeNull()
    expect(localTranslate({})).toBeNull()
  })
})
