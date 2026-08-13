<script setup lang="ts">
/**
 * Phira+ 内容 Surface（§一 Layer 1）：半实心、可读，NOT 玻璃，也 NOT card soup。
 * 只承载需要形成视觉对象的内容；列表/文字/状态不要硬塞进 Surface。
 * 无 title/subtitle/header —— 那是旧 UCard 的 card 化反模式。
 */
withDefaults(defineProps<{ padded?: boolean }>(), { padded: false })
</script>

<template>
  <section
    class="rounded-[var(--pp-radius-surface)] border border-border bg-surface shadow-[var(--pp-shadow-surface)]"
    :class="padded ? 'p-4' : ''"
  >
    <slot />
  </section>
</template>
