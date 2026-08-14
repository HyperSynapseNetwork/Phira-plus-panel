<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import PPIcon from './PPIcon.vue'
import { focusableElements, trapTab, useOverlayManager } from '~/composables/useOverlayManager'
const { t } = usePanelI18n()
const props=withDefaults(defineProps<{open?:boolean,title?:string,width?:string,layer?:'context'|'reauth'}>(),{open:false,title:'',width:'max-w-2xl',layer:'context'})
const emit=defineEmits<{close:[]}>()
const panelEl=ref<HTMLElement|null>(null)
const titleId=`ppmodal-${Math.random().toString(36).slice(2,8)}`
const overlayId=`panel-modal-${Math.random().toString(36).slice(2,10)}`
const overlay=useOverlayManager()
function key(e:KeyboardEvent){if(!props.open||!overlay.isTopmost(overlayId))return;if(e.key==='Escape'){e.preventDefault();emit('close');return}trapTab(e,panelEl.value)}
watch(()=>props.open,async open=>{if(!import.meta.client)return;if(open){overlay.push(overlayId,props.layer);await nextTick();(focusableElements(panelEl.value)[0]??panelEl.value)?.focus({preventScroll:true})}else overlay.pop(overlayId)},{immediate:true})
if(import.meta.client) window.addEventListener('keydown',key)
onUnmounted(()=>{if(import.meta.client)window.removeEventListener('keydown',key);overlay.pop(overlayId)})
</script>
<template><Teleport to="body"><Transition name="pp-overlay"><div v-if="open" class="fixed inset-0 flex items-center justify-center p-4" :class="layer==='reauth'?'z-[var(--pp-z-reauth)]':'z-[var(--pp-z-context)]'" role="dialog" aria-modal="true" :aria-labelledby="title?titleId:undefined"><div class="absolute inset-0 bg-backdrop" @click="overlay.isTopmost(overlayId)&&emit('close')"/><div ref="panelEl" tabindex="-1" class="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-[var(--pp-radius-window)] border border-border bg-surface shadow-[var(--pp-shadow-window)] focus:outline-none" :class="width"><header v-if="title" class="flex h-12 shrink-0 items-center justify-between border-b border-border px-4"><h3 :id="titleId" class="text-sm font-semibold text-foreground">{{title}}</h3><button type="button" data-pp-touch-critical="overlay-close" class="pp-touch-target inline-flex h-11 w-11 items-center justify-center rounded-[var(--pp-radius-control)] text-muted hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" :aria-label="t('common.close')" @click="emit('close')"><PPIcon name="close" class="h-4 w-4" aria-hidden="true" /></button></header><div class="flex-1 overflow-auto p-4"><slot/></div><footer v-if="$slots.footer" class="shrink-0 border-t border-border px-4 py-3"><slot name="footer"/></footer></div></div></Transition></Teleport></template>
