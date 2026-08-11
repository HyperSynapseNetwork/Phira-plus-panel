import type { Ref } from 'vue'
import { ref } from 'vue'

/**
 * Minimal async state helper for data pages. Runs `fn` immediately (unless
 * `immediate: false`), tracks loading/error, and exposes `run` to re-execute
 * (e.g. after a filter change). Errors are surfaced, never fabricated.
 */
export interface AsyncState<T> {
  data: Ref<T | null>
  loading: Ref<boolean>
  error: Ref<Error | null>
  ready: Ref<boolean>
  run: () => Promise<void>
  refresh: () => Promise<void>
}

export function useAsync<T>(fn: () => Promise<T>, opts: { immediate?: boolean } = {}): AsyncState<T> {
  const data = ref<T | null>(null) as Ref<T | null>
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const ready = ref(false)

  async function run() {
    loading.value = true
    error.value = null
    try {
      data.value = await fn()
      ready.value = true
    }
    catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
    }
    finally {
      loading.value = false
    }
  }

  if (opts.immediate !== false) {
    void run()
  }

  return { data, loading, error, ready, run, refresh: run }
}
