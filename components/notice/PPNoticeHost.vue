<script setup lang="ts">
const notice = useNotice()
const { t } = usePanelI18n()
async function copyRequestId(id: string) {
  if (import.meta.client)
    await navigator.clipboard?.writeText(id)
}

function ariaRole(tone: string): 'alert' | 'status' {
  return tone === 'warning' || tone === 'error' ? 'alert' : 'status'
}
function liveMode(tone: string): 'assertive' | 'polite' {
  return tone === 'warning' || tone === 'error' ? 'assertive' : 'polite'
}
async function runAction(id: string, action?: { run: () => void | Promise<void> }): Promise<void> {
  if (!action)
    return
  try { await action.run(); notice.dismiss(id) }
  catch (err) { notice.errorFromApi(err, { dedupKey: `notice-action:${id}` }) }
}
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[var(--pp-z-notice)] flex flex-col items-stretch gap-2 sm:left-auto sm:right-4 sm:w-[min(26rem,calc(100vw-2rem))]" :aria-label="t('a11y.notifications')">
      <TransitionGroup name="pp-notice" tag="div" class="contents">
        <article
          v-for="item in notice.visible.value"
          :key="item.id"
          class="pp-notice-card pointer-events-auto relative overflow-hidden rounded-[var(--pp-radius-window)] border border-border bg-[var(--pp-material-thick)] shadow-[var(--pp-shadow-window)] backdrop-blur-[var(--pp-material-blur)]"
          :role="ariaRole(item.tone)"
          :aria-live="liveMode(item.tone)"
        >
          <span
            class="absolute inset-y-0 left-0 w-1"
            :class="item.tone === 'error' ? 'bg-danger' : item.tone === 'warning' ? 'bg-warning' : item.tone === 'success' ? 'bg-success' : item.tone === 'loading' ? 'bg-info' : 'bg-muted'"
            aria-hidden="true"
          />
          <div class="flex items-start gap-3 px-4 py-3 pl-5">
            <span v-if="item.tone === 'loading'" class="mt-1 h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-sky-300/30 border-t-sky-300" aria-hidden="true" />
            <div class="min-w-0 flex-1">
              <p v-if="item.titleKey" class="text-sm font-semibold text-foreground">
                {{ t(item.titleKey) }}
              </p>
              <p class="text-sm text-foreground">
                {{ notice.renderMessage(item) }}
              </p>
              <details v-if="item.requestId" class="mt-1.5 text-xs text-muted">
                <summary class="cursor-pointer select-none">
                  {{ t('common.details') }}
                </summary>
                <div class="mt-1 flex items-center gap-2">
                  <code class="font-mono">{{ item.requestId }}</code><button type="button" class="inline-flex min-h-11 items-center text-accent hover:underline" @click="copyRequestId(item.requestId)">
                    {{ t('common.copy') }}
                  </button>
                </div>
              </details>
              <button v-if="item.action" type="button" class="mt-2 inline-flex min-h-11 items-center text-xs font-medium text-accent hover:underline" @click="runAction(item.id, item.action)">
                {{ t(item.action.labelKey) }}
              </button>
            </div>
            <button v-if="item.dismissible !== false" type="button" data-pp-touch-critical="notice-close" class="pp-touch-target inline-flex h-11 w-11 items-center justify-center rounded-[var(--pp-radius-control)] text-muted hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" :aria-label="t('common.close')" @click="notice.dismiss(item.id)">
              <PPIcon name="close" class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </article>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
