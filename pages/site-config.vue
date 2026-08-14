<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { createJob, fetchPpfBuildConfig, fetchServerStatus, savePpfBuildConfig } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import ReauthModal from '~/components/admin/ReauthModal.vue'
import PPSection from '~/components/patterns/PPSection.vue'
import PPButton from '~/components/ui/PPButton.vue'
import PPInput from '~/components/ui/PPInput.vue'
import PPModal from '~/components/ui/PPModal.vue'
import PPStatus from '~/components/ui/PPStatus.vue'
import PPTextarea from '~/components/ui/PPTextarea.vue'
import { useAsync } from '~/composables/useAsync'
import { useReauth } from '~/composables/useReauth'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ permissions: ['config:view'] })
const { t } = usePanelI18n()
const notice = useNotice()
const auth = useAuthStore()
const reauth = useReauth()
const configState = useAsync(() => fetchPpfBuildConfig())
const statusState = useAsync(() => fetchServerStatus())
const canSave = computed(() => auth.hasPermission(['config:reload']))
const canBuild = computed(() => auth.hasPermission(['server:manage']) && statusState.data.value?.deployment?.ppf_build === true)
const advancedOpen = ref(false)
const busy = ref(false)
const form = reactive({ site_name: 'HSN Phira+', site_description: '', canonical_url: '', analytics_provider: '', plausible_domain: '', ga_id: '', search_verification_google: '', search_verification_bing: '' })
watch(() => configState.data.value, (value) => {
  const content = value?.content ?? {}
  for (const key of Object.keys(form) as Array<keyof typeof form>) {
    if (typeof content[key] === 'string')
      form[key] = String(content[key])
  }
}, { immediate: true })
function payload(): Record<string, unknown> { return Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) }
async function saveOnly() {
  busy.value = true
  try { await savePpfBuildConfig(payload()); notice.success('notice.saved'); await configState.run() }
  catch (err) { notice.errorFromApi(err) }
  finally { busy.value = false }
}
function saveAndBuild() {
  reauth.requireReauth(async (token) => {
    busy.value = true
    try {
      await savePpfBuildConfig(payload())
      await createJob('ppf.build', {}, token)
      notice.success('notice.jobCreated')
      await configState.run()
    }
    catch (err) { notice.errorFromApi(err) }
    finally { busy.value = false }
  }, 'high')
}
</script>

<template>
  <div class="space-y-4">
    <PageHeader :title="t('siteConfig.title')" :subtitle="t('siteConfig.subtitle')">
      <template #actions>
        <PPStatus :tone="canBuild ? 'success' : 'neutral'">
          {{ t(canBuild ? 'siteConfig.buildReady' : 'siteConfig.buildMissing') }}
        </PPStatus>
        <PPButton size="sm" weight="secondary" @click="advancedOpen = true">
          {{ t('siteConfig.advanced') }}
        </PPButton>
      </template>
    </PageHeader>
    <AsyncState :loading="configState.loading.value" :error="configState.error.value" :empty="false">
      <PPSection :title="t('siteConfig.siteIdentity')">
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <label><span class="mb-1 block text-xs font-medium">{{ t('siteConfig.siteName') }}</span><PPInput v-model="form.site_name" :disabled="!canSave" /></label>
          <label><span class="mb-1 block text-xs font-medium">{{ t('siteConfig.siteUrl') }}</span><PPInput v-model="form.canonical_url" placeholder="https://phira.example.com" :disabled="!canSave" /></label>
          <label class="lg:col-span-2"><span class="mb-1 block text-xs font-medium">{{ t('siteConfig.siteDescription') }}</span><PPTextarea v-model="form.site_description" :rows="3" :disabled="!canSave" /></label>
        </div>
        <div class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <span class="text-xs text-muted">{{ t('siteConfig.revision', { revision: configState.data.value?.revision ?? 0 }) }}</span>
          <div class="flex gap-2">
            <PPButton size="sm" weight="secondary" :disabled="busy || !canSave" @click="saveOnly">
              {{ t('siteConfig.save') }}
            </PPButton><PPButton size="sm" weight="primary" :disabled="busy || !canSave || !canBuild" @click="saveAndBuild">
              {{ t('siteConfig.saveBuild') }}
            </PPButton>
          </div>
        </div>
      </PPSection>
    </AsyncState>
    <PPModal :open="advancedOpen" :title="t('siteConfig.advanced')" width="max-w-xl" @close="advancedOpen = false">
      <div class="space-y-4">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label><span class="mb-1 block text-xs">{{ t('siteConfig.google') }}</span><PPInput v-model="form.search_verification_google" /></label><label><span class="mb-1 block text-xs">{{ t('siteConfig.bing') }}</span><PPInput v-model="form.search_verification_bing" /></label>
        </div>
        <label class="block"><span class="mb-1 block text-xs">{{ t('siteConfig.analytics') }}</span><PPSelect v-model="form.analytics_provider"><option value="">{{ t('siteConfig.disabled') }}</option><option value="plausible">Plausible</option><option value="ga4">Google Analytics 4</option></PPSelect></label>
        <PPInput v-if="form.analytics_provider === 'plausible'" v-model="form.plausible_domain" :placeholder="t('common.plausibleDomain')" />
        <PPInput v-if="form.analytics_provider === 'ga4'" v-model="form.ga_id" placeholder="G-XXXXXXXXXX" />
        <p class="text-xs text-muted">
          {{ t('siteConfig.advancedHint') }}
        </p>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="advancedOpen = false">
            {{ t('common.close') }}
          </PPButton><PPButton weight="primary" :disabled="busy || !canSave" @click="saveOnly">
            {{ t('common.save') }}
          </PPButton>
        </div>
      </template>
    </PPModal>
    <ReauthModal :open="reauth.open.value" :busy="reauth.busy.value" :error="reauth.error.value" :password="reauth.password.value" @update:password="v => reauth.password.value = v" @confirm="reauth.confirm()" @cancel="reauth.cancel()" />
  </div>
</template>
