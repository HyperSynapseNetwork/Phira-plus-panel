<script setup lang="ts">
import type { Group } from '~/types/admin'
import { computed, onMounted, ref } from 'vue'
import { createGroup, deleteGroup, fetchGroups, setGroupMembers, setGroupPermissions, updateGroup } from '~/api/admin'
import AsyncState from '~/components/admin/AsyncState.vue'
import PageHeader from '~/components/admin/PageHeader.vue'
import PermissionTree from '~/components/admin/PermissionTree.vue'
import ReauthModal from '~/components/admin/ReauthModal.vue'
import UBadge from '~/components/ui/UBadge.vue'
import UButton from '~/components/ui/UButton.vue'
import UInput from '~/components/ui/UInput.vue'
import UModal from '~/components/ui/UModal.vue'
import UTextarea from '~/components/ui/UTextarea.vue'
import { useAsync } from '~/composables/useAsync'
import { useReauth } from '~/composables/useReauth'
import { usePermissionsStore } from '~/stores/permissions'
import { ApiError } from '~/utils/api-error'

definePageMeta({ permissions: ['group:view'] })

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
const msg = ref('')

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
  msg.value = ''
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
    msg.value = '保存成功'
    closeModal()
    void list.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '保存失败'
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
  msg.value = ''
  try {
    await deleteGroup(showDelete.value.id)
    msg.value = '已删除'
    showDelete.value = null
    void list.run()
  }
  catch (err) {
    msg.value = err instanceof ApiError ? err.message : '删除失败'
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="用户组与权限" subtitle="Manifest 驱动 UI · 前端零硬编码权限全集（§18.5）">
      <template #actions>
        <UButton variant="primary" size="sm" @click="openCreate">
          新建用户组
        </UButton>
      </template>
    </PageHeader>

    <p v-if="msg" class="mb-2 text-sm text-accent" role="status">
      {{ msg }}
    </p>
    <p v-if="permStore.error" class="mb-2 text-sm text-danger">
      权限 Manifest 不可用（PPB 未就绪）——权限树将不可编辑。
    </p>

    <AsyncState :loading="list.loading.value" :error="list.error.value" :empty="(list.data.value?.items ?? []).length === 0">
      <div class="overflow-x-auto rounded-lg border border-border bg-surface">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="border-b border-border text-xs uppercase text-muted">
              <th class="px-3 py-2 font-medium">
                名称
              </th>
              <th class="px-3 py-2 font-medium">
                类型
              </th>
              <th class="px-3 py-2 font-medium">
                成员
              </th>
              <th class="px-3 py-2 font-medium">
                权限数
              </th>
              <th class="px-3 py-2 font-medium">
                操作
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
                <UBadge v-if="g.system_kind === 'admin_scope'" tone="danger">
                  admin_scope
                </UBadge>
                <UBadge v-else-if="g.protected" tone="warning">
                  protected
                </UBadge>
                <span v-else class="text-muted">普通</span>
              </td>
              <td class="px-3 py-2">
                {{ g.member_count ?? '—' }}
              </td>
              <td class="px-3 py-2">
                {{ g.permissions.length }}
              </td>
              <td class="px-3 py-2">
                <div class="flex gap-2">
                  <UButton size="sm" variant="outline" @click="openEdit(g)">
                    编辑
                  </UButton>
                  <UButton size="sm" variant="danger" :disabled="g.protected || g.system_kind === 'admin_scope'" @click="showDelete = g">
                    删除
                  </UButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </AsyncState>

    <p class="mt-2 text-xs text-muted">
      Administrators（admin_scope）自动映射全部非 root 权限（§8.3），不在此逐项授予；普通组禁止 `*:*`。
    </p>

    <!-- Create / edit modal -->
    <UModal
      :open="creating || !!editing"
      :title="editing ? `编辑用户组 ${editing.name}` : '新建用户组'"
      @close="closeModal"
    >
      <div class="space-y-4">
        <UInput v-model="form.name" label="名称" required />
        <UTextarea v-model="form.description" label="描述" :rows="2" />
        <label class="flex items-center gap-2 text-sm text-foreground">
          <input v-model="form.isDefault" type="checkbox" class="rounded">
          设为默认用户组
        </label>
        <div>
          <p class="mb-1 text-sm font-medium text-foreground">
            权限
          </p>
          <p v-if="editing?.system_kind === 'admin_scope'" class="mb-1 text-xs text-warning">
            admin_scope 自动映射全部非 root 权限，不在此逐项授予（§8.3）。
          </p>
          <p v-else-if="editing?.protected" class="mb-1 text-xs text-warning">
            该组为受保护的内置组，权限可编辑但请谨慎操作。
          </p>
          <PermissionTree v-model="selectedPerms" :disabled="editing?.system_kind === 'admin_scope'" />
        </div>
        <div v-if="editing">
          <p class="mb-1 text-sm font-medium text-foreground">
            成员（user_id，逗号 / 换行分隔）
          </p>
          <UInput v-model="memberText" placeholder="例如 7f3c…,9a2b… （留空则不修改成员）" />
        </div>
        <div v-if="editing || creating">
          <p class="mb-1 text-sm font-medium text-foreground">
            有效权限预览
          </p>
          <p class="mb-1 text-xs text-muted">
            {{ editing?.system_kind === 'admin_scope' || form.name === 'Administrators' ? 'admin_scope：自动映射全部非 root 权限' : `已选 ${effectiveCount} 项（服务端为最终权威）` }}
          </p>
          <ul class="max-h-32 space-y-0.5 overflow-auto text-xs text-muted">
            <li v-for="id in effectivePermissions" :key="id" class="font-mono">
              {{ id }}
            </li>
          </ul>
        </div>
        <p v-if="msg" class="text-sm text-danger">
          {{ msg }}
        </p>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="closeModal">
            取消
          </UButton>
          <UButton variant="primary" :disabled="busy || !form.name.trim()" @click="submitSave">
            保存
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Delete confirm -->
    <UModal :open="!!showDelete" title="确认删除用户组" width="max-w-md" @close="showDelete = null">
      <p class="text-sm text-foreground">
        删除用户组 <b>{{ showDelete?.name }}</b>？组内成员将失去该组授予的权限。受保护组不可删除。
      </p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="showDelete = null">
            取消
          </UButton>
          <UButton variant="danger" :disabled="busy" @click="confirmDelete">
            删除
          </UButton>
        </div>
      </template>
    </UModal>

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
