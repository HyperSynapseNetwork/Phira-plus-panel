import { defineNuxtPlugin } from 'nuxt/app'
import { usePanelI18n } from '~/composables/usePanelI18n'

export default defineNuxtPlugin(() => {
  usePanelI18n().initDeviceLocale()
})
