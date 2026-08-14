<script setup lang="ts">
withDefaults(defineProps<{title?:string,subtitle?:string,padded?:boolean}>(),{title:'',subtitle:'',padded:true})
</script>
<template><section class="border-t border-border first:border-t-0"><header v-if="title||$slots.header" class="flex items-start justify-between gap-3 py-3"><div><h3 v-if="title" class="text-sm font-medium text-foreground">{{title}}</h3><p v-if="subtitle" class="mt-0.5 text-xs text-muted">{{subtitle}}</p></div><slot name="header"/></header><div :class="padded?'pb-4':''"><slot/></div></section></template>
