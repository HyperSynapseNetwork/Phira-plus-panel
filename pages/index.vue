<script setup lang="ts">
import { usePreferencesStore } from '~/stores/preferences'

definePageMeta({
  // Permission gate stub: `dashboard:view` is the first integration permission
  // (design §5). Empty = any authenticated principal.
  permissions: [],
})

const prefs = usePreferencesStore()
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-foreground">
        仪表盘
      </h2>
      <span class="text-xs text-muted">Phase A 占位 · 指标摘要将在 Phase C 接入</span>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <section
        v-for="n in 8"
        :key="n"
        class="rounded-lg border border-border bg-surface p-4"
      >
        <p class="text-xs text-muted">
          指标 {{ n }}
        </p>
        <p class="mt-2 text-2xl font-semibold text-foreground">
          —
        </p>
        <p class="mt-1 text-[11px] text-muted">
          待接入 PPB
        </p>
      </section>
    </div>

    <section class="rounded-lg border border-border bg-surface p-4">
      <h3 class="text-sm font-medium text-foreground">
        Operational Alerts
      </h3>
      <p class="mt-2 text-sm text-muted">
        暂无告警（Phase A 占位；Phase C 接入告警聚合与 <code>logs?focus=</code> 跳转）。
      </p>
    </section>

    <section class="rounded-lg border border-border bg-surface p-4">
      <h3 class="text-sm font-medium text-foreground">
        Panel 偏好存储（namespace: panel）
      </h3>
      <p class="mt-2 text-sm text-muted">
        pageSize {{ prefs.pageSize }} · density {{ prefs.density }} · revision {{ prefs.revision }}
        · 已同步 {{ prefs.loaded ? '是' : '否' }}
      </p>
    </section>
  </div>
</template>
