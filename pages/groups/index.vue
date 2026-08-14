<script setup lang="ts">
import type { Group } from '~/types/admin'
import { computed, onMounted, ref } from 'vue'
import { createGroup, deleteGroup, fetchGroups, setGroupMembers, setGroupPermissions, updateGroup } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import PermissionTree from '~/components/admin/PermissionTree.vue'
import ReauthModal from '~/components/admin/ReauthModal.vue'
import PPBadge from '~/components/ui/PPBadge.vue'
import PPButton from '~/components/ui/PPButton.vue'
import PPInput from '~/components/ui/PPInput.vue'
import PPModal from '~/components/ui/PPModal.vue'
import PPTextarea from '~/components/ui/PPTextarea.vue'
import { useAsync } from '~/composables/useAsync'
import { useReauth } from '~/composables/useReauth'
import { usePermissionsStore } from '~/stores/permissions'

definePageMeta({ permissions: ['group:view'] })

const { t } = usePanelI18n()

const permStore = usePermissionsStore()
const reauth = useReauth()

const list = useAsync(() => fetchGroups({ pageNum: 100 }))

const editing = ref<Group | null>(null)
const creating = ref(false)
const showDelete = ref<Group | null>(null)
const form = ref({ name: '', description: '', isDefault: false })
const selectedPerms = ref<string[]>([])
const memberText = ref('')
const busy = ref(false)
const notice = useNotice()

onMounted(() => {
  void permStore.load()
})

function openCreate() {
  form.value = { name: '', description: '', isDefault: false }
  selectedPerms.value = []
  memberText.value = ''
  creating.value = true
}

function openEdit(g: Group) {
  editing.value = g
  form.value = { name: g.name, description: g.description ?? '', isDefault: g.is_default }
  selectedPerms.value = [...g.permissions]
  memberText.value = ''
}

function closeModal() {
  creating.value = false
  editing.value = null
}

/** Parse a comma/newline-separated member list into trimmed user ids. */
function parseMembers(text: string): string[] {
  return text.split(/[,，\n]/).map(s => s.trim()).filter(Boolean)
}

async function save(reauthToken?: string) {
  if (!form.value.name.trim())
    return
  busy.value = true
  try {
    const memberIds = parseMembers(memberText.value)
    if (editing.value) {
      await updateGroup(editing.value.id, { name: form.value.name, description: form.value.description, is_default: form.value.isDefault }, reauthToken)
      await setGroupPermissions(editing.value.id, selectedPerms.value, reauthToken)
      if (memberIds.length)
        await setGroupMembers(editing.value.id, memberIds, reauthToken)
    }
    else {
      const created = await createGroup({ name: form.value.name, description: form.value.description, is_default: form.value.isDefault })
      await setGroupPermissions(created.id, selectedPerms.value, reauthToken)
      if (memberIds.length)
        await setGroupMembers(created.id, memberIds, reauthToken)
    }
    notice.success('notice.saved', { dedupKey: 'group:save' })
    closeModal()
    void list.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: 'group:save:error' })
  }
  finally {
    busy.value = false
  }
}

// §23 #10: permission / member / default-group modification requires reauth.
function submitSave() {
  reauth.requireReauth(async (token) => {
    await save(token)
  })
}

/**
 * Effective-permission preview (§18.5). `admin_scope` auto-maps every
 * non-root permission from the manifest; ordinary groups get their explicit
 * selection. Pure UI preview — the server remains the authority.
 */
const effectivePermissions = computed<string[]>(() => {
  if (editing.value?.system_kind === 'admin_scope' || form.value.name === 'Administrators')
    return permStore.entries.filter(e => !e.root_only).map(e => e.id)
  return [...selectedPerms.value].sort()
})

const effectiveCount = computed(() => effectivePermissions.value.length)

async function confirmDelete() {
  if (!showDelete.value)
    return
  busy.value = true
  try {
    await deleteGroup(showDelete.value.id)
    notice.success('notice.deleted', { dedupKey: 'group:delete' })
    showDelete.value = null
    void list.run()
  }
  catch (err) {
    notice.errorFromApi(err, { dedupKey: 'group:delete:error' })
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader :title="t('groupsPage.title')" :subtitle="t('groupsPage.subtitle')">
      <template #actions>
        <PPButton weight="primary" size="sm" @click="openCreate">
          {{ t('groupsPage.create') }}
        </PPButton>
      </template>
    </PageHeader>
    <p v-if="permStore.error" class="mb-2 text-sm text-danger">
      {{ t('groupsPage.manifestUnavailable') }}
    </p>

    <AsyncState :loading="list.loading.value" :error="list.error.value" :empty="(list.data.value?.items ?? []).length === 0">
      <div class="overflow-x-auto rounded-lg border border-border bg-surface">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs uppercase text-muted">
              <th class="px-3 py-2 font-medium">
                {{ t('groupsPage.name') }}
              </th>
              <th class="px-3 py-2 font-medium">
                {{ t('groupsPage.type') }}
              </th>
              <th class="px-3 py-2 font-medium">
                {{ t('groupsPage.members') }}
              </th>
              <th class="px-3 py-2 font-medium">
                {{ t('groupsPage.permissionCount') }}
              </th>
              <th class="px-3 py-2 font-medium">
                {{ t('groupsPage.actions') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in list.data.value?.items ?? []" :key="g.id" class="border-b border-border last:border-0 hover:bg-surface-secondary">
              <td class="px-3 py-2">
                <span class="font-medium text-foreground">{{ g.name }}</span>
                <span v-if="g.is_default" class="ml-1 text-[10px] text-muted">DEFAULT</span>
                <p v-if="g.description" class="text-xs text-muted">
                  {{ g.description }}
                </p>
              </td>
              <td class="px-3 py-2">
                <PPBadge v-if="g.system_kind === 'admin_scope'" tone="danger">
                  {{ t('groupsPage.adminScopeLabel') }}
                </PPBadge>
                <PPBadge v-else-if="g.protected" tone="warning">
                  {{ t('groupsPage.protectedLabel') }}
                </PPBadge>
                <span v-else class="text-muted">{{ t('groupsPage.ordinary') }}</span>
              </td>
              <td class="px-3 py-2">
                {{ g.member_count ?? '—' }}
              </td>
              <td class="px-3 py-2">
                {{ g.permissions.length }}
              </td>
              <td class="px-3 py-2">
                <div class="flex gap-2">
                  <PPButton size="sm" weight="secondary" @click="openEdit(g)">
                    {{ t('groupsPage.edit') }}
                  </PPButton>
                  <PPButton size="sm" weight="dangerous" :disabled="g.protected || g.system_kind === 'admin_scope'" @click="showDelete = g">
                    {{ t('groupsPage.delete') }}
                  </PPButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AsyncState>

    <p class="mt-2 text-xs text-muted">
      {{ t('groupsPage.adminScopeHint') }}
    </p>

    <!-- Create / edit modal -->
    <PPModal
      :open="creating || !!editing"
      :title="editing ? t('groupsPage.editTitle', { name: editing.name }) : t('groupsPage.createTitle')"
      @close="closeModal"
    >
      <div class="space-y-4">
        <PPInput v-model="form.name" :label="t('groupsPage.name')" required />
        <PPTextarea v-model="form.description" :label="t('groupsPage.description')" :rows="2" />
        <label class="flex items-center gap-2 text-sm text-foreground">
          <input v-model="form.isDefault" type="checkbox" class="rounded">
          {{ t('groupsPage.defaultGroup') }}
        </label>
        <div>
          <p class="mb-1 text-sm font-medium text-foreground">
            {{ t('groupsPage.permissions') }}
          </p>
          <p v-if="editing?.system_kind === 'admin_scope'" class="mb-1 text-xs text-warning">
            {{ t('groupsPage.adminScopeAuto') }}
          </p>
          <p v-else-if="editing?.protected" class="mb-1 text-xs text-warning">
            {{ t('groupsPage.protectedHint') }}
          </p>
          <PermissionTree v-model="selectedPerms" :disabled="editing?.system_kind === 'admin_scope'" />
        </div>
        <div v-if="editing">
          <p class="mb-1 text-sm font-medium text-foreground">
            {{ t('groupsPage.memberInput') }}
          </p>
          <PPInput v-model="memberText" :placeholder="t('groupsPage.memberPlaceholder')" />
        </div>
        <div v-if="editing || creating">
          <p class="mb-1 text-sm font-medium text-foreground">
            {{ t('groupsPage.effectivePreview') }}
          </p>
          <p class="mb-1 text-xs text-muted">
            {{ editing?.system_kind === 'admin_scope' || form.name === 'Administrators' ? t('groupsPage.effectiveAdmin') : t('groupsPage.effectiveSelected', { count: effectiveCount }) }}
          </p>
          <ul class="max-h-32 space-y-0.5 overflow-auto text-xs text-muted">
            <li v-for="id in effectivePermissions" :key="id" class="font-mono">
              {{ id }}
            </li>
          </ul>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="closeModal">
            {{ t('common.cancel') }}
          </PPButton>
          <PPButton weight="primary" :disabled="busy || !form.name.trim()" @click="submitSave">
            {{ t('common.save') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

    <!-- Delete confirm -->
    <PPModal :open="!!showDelete" :title="t('groupsPage.deleteTitle')" width="max-w-md" @close="showDelete = null">
      <p class="text-sm text-foreground">
        {{ t('groupsPage.deleteConfirm', { name: showDelete?.name ?? '' }) }}
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <PPButton weight="quiet" @click="showDelete = null">
            {{ t('common.cancel') }}
          </PPButton>
          <PPButton weight="dangerous" :disabled="busy" @click="confirmDelete">
            {{ t('groupsPage.delete') }}
          </PPButton>
        </div>
      </template>
    </PPModal>

    <ReauthModal
      :open="reauth.open.value"
      :busy="reauth.busy.value"
      :error="reauth.error.value"
      :password="reauth.password.value"
      @update:password="v => reauth.password.value = v"
      @confirm="reauth.confirm()"
      @cancel="reauth.cancel()"
    />
  </div>
</template>
