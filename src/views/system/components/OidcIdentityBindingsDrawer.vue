<template>
  <el-drawer
    :model-value="modelValue"
    :title="t('oidcIdentityBindings.title')"
    direction="rtl"
    size="min(760px, 94vw)"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="oidc-bindings">
      <el-alert
        type="info"
        show-icon
        :closable="false"
        :title="t('oidcIdentityBindings.scopeHint')"
      >
        <template #default>
          {{ t('oidcIdentityBindings.scopeDetail') }}
          <code>{{ tenantId || t('oidcIdentityBindings.noTenant') }}</code>
        </template>
      </el-alert>

      <el-alert
        v-if="!tenantId"
        type="warning"
        show-icon
        :closable="false"
        :title="t('oidcIdentityBindings.tenantRequired')"
      />
      <el-alert
        v-else-if="providerEnabled === false"
        type="warning"
        show-icon
        :closable="false"
        :title="t('oidcIdentityBindings.providerDisabled')"
      />
      <el-alert
        v-else-if="loadError"
        type="error"
        show-icon
        :closable="false"
        :title="t('oidcIdentityBindings.loadError')"
      >
        <template #default>
          <el-button type="primary" link @click="load">
            {{ t('common.retry') }}
          </el-button>
        </template>
      </el-alert>

      <template v-if="tenantId && providerEnabled !== false">
        <h3 class="oidc-bindings__heading">{{ t('oidcIdentityBindings.bindTitle') }}</h3>
        <p class="oidc-bindings__hint">{{ t('oidcIdentityBindings.bindHint') }}</p>
        <el-form label-width="140px" class="oidc-bindings__form">
          <el-form-item :label="t('oidcIdentityBindings.username')">
            <el-input
              v-model="form.username"
              maxlength="128"
              autocomplete="off"
              :placeholder="t('oidcIdentityBindings.usernamePlaceholder')"
            />
          </el-form-item>
          <el-form-item :label="t('oidcIdentityBindings.subject')">
            <el-input
              v-model="form.subject"
              maxlength="255"
              autocomplete="off"
              :placeholder="t('oidcIdentityBindings.subjectPlaceholder')"
            />
          </el-form-item>
          <el-alert
            v-if="hasExistingBinding"
            type="warning"
            :closable="false"
            :title="t('oidcIdentityBindings.duplicateHint')"
          />
          <div class="oidc-bindings__form-actions">
            <el-button
              type="primary"
              :loading="saving"
              :disabled="!canBind || writesFrozen"
              @click="bindIdentity"
            >
              {{ t('oidcIdentityBindings.bind') }}
            </el-button>
            <el-button :icon="Refresh" :loading="loading" @click="load">
              {{ t('common.refresh') }}
            </el-button>
          </div>
        </el-form>

        <el-table
          v-loading="loading"
          :data="identities"
          stripe
          border
          class="oidc-bindings__table"
          :empty-text="t('oidcIdentityBindings.empty')"
        >
          <el-table-column prop="username" :label="t('oidcIdentityBindings.username')" />
          <el-table-column
            prop="subject"
            :label="t('oidcIdentityBindings.subject')"
            min-width="180"
            show-overflow-tooltip
          />
          <el-table-column
            prop="issuer"
            :label="t('oidcIdentityBindings.issuer')"
            min-width="180"
            show-overflow-tooltip
          />
          <el-table-column
            prop="linkedBy"
            :label="t('oidcIdentityBindings.linkedBy')"
            min-width="120"
            show-overflow-tooltip
          />
          <el-table-column
            prop="linkedAt"
            :label="t('oidcIdentityBindings.linkedAt')"
            min-width="170"
            show-overflow-tooltip
          />
          <el-table-column :label="t('oidcIdentityBindings.actions')" width="100" fixed="right">
            <template #default="{ row }">
              <el-button
                type="danger"
                link
                :disabled="writesFrozen"
                :loading="unbindingId === String(row.id)"
                @click="unbindIdentity(row as ConsoleOidcIdentity)"
              >
                {{ t('oidcIdentityBindings.unbind') }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { RefreshCw as Refresh } from '@lucide/vue'
  import { confirmDanger } from '@/composables/useDangerConfirm'
  import {
    bindConsoleOidcIdentity,
    getConsoleOidcProvider,
    listConsoleOidcIdentities,
    unbindConsoleOidcIdentity,
    type ConsoleOidcIdentity,
  } from '@/api/oidc'

  const props = defineProps<{
    modelValue: boolean
    tenantId: string
    writesFrozen: boolean
  }>()
  const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
  const { t } = useI18n({ useScope: 'global' })
  const identities = ref<ConsoleOidcIdentity[]>([])
  const providerEnabled = ref<boolean | null>(null)
  const loading = ref(false)
  const loadError = ref(false)
  const saving = ref(false)
  const unbindingId = ref('')
  const form = reactive({ username: '', subject: '' })
  let requestSequence = 0
  let contextSequence = 0

  const tenantId = computed(() => props.tenantId.trim())
  const hasExistingBinding = computed(() => {
    const username = form.username.trim().toLowerCase()
    const subject = form.subject.trim()
    return identities.value.some(
      (identity) =>
        (username.length > 0 && identity.username.toLowerCase() === username) ||
        (subject.length > 0 && identity.subject === subject),
    )
  })
  const canBind = computed(() => {
    const username = form.username.trim()
    const subject = form.subject.trim()
    return (
      Boolean(tenantId.value) &&
      username.length > 0 &&
      username.length <= 128 &&
      subject.length > 0 &&
      subject.length <= 255 &&
      /^[\x00-\x7F]+$/.test(subject) &&
      !hasExistingBinding.value
    )
  })

  function isCurrentRequest(sequence: number, tenantSnapshot: string, contextSnapshot: number) {
    return (
      sequence === requestSequence &&
      contextSnapshot === contextSequence &&
      tenantId.value === tenantSnapshot &&
      props.modelValue
    )
  }

  async function load() {
    const sequence = ++requestSequence
    const contextSnapshot = contextSequence
    const tenantSnapshot = tenantId.value
    identities.value = []
    loadError.value = false
    providerEnabled.value = null
    if (!tenantSnapshot) {
      loading.value = false
      return
    }
    loading.value = true
    try {
      const provider = await getConsoleOidcProvider()
      if (!isCurrentRequest(sequence, tenantSnapshot, contextSnapshot)) return
      providerEnabled.value = provider.enabled
      if (!provider.enabled) return
      const result = await listConsoleOidcIdentities(tenantSnapshot)
      if (!isCurrentRequest(sequence, tenantSnapshot, contextSnapshot)) return
      identities.value = result ?? []
    } catch {
      if (isCurrentRequest(sequence, tenantSnapshot, contextSnapshot)) loadError.value = true
    } finally {
      if (sequence === requestSequence) loading.value = false
    }
  }

  async function bindIdentity() {
    if (!canBind.value || props.writesFrozen) return
    const tenantSnapshot = tenantId.value
    const contextSnapshot = contextSequence
    const request = { username: form.username.trim(), subject: form.subject.trim() }
    saving.value = true
    try {
      await bindConsoleOidcIdentity(tenantSnapshot, request)
      if (tenantId.value !== tenantSnapshot || contextSequence !== contextSnapshot) return
      form.username = ''
      form.subject = ''
      await load()
      ElMessage.success(
        t(
          loadError.value
            ? 'oidcIdentityBindings.bindAccepted'
            : 'oidcIdentityBindings.bindSuccess',
        ),
      )
    } catch {
      if (tenantId.value !== tenantSnapshot || contextSequence !== contextSnapshot) return
      await load()
      const reconciled = identities.value.some(
        (identity) =>
          identity.username.toLowerCase() === request.username.toLowerCase() &&
          identity.subject === request.subject,
      )
      ElMessage[reconciled ? 'success' : 'error'](
        t(reconciled ? 'oidcIdentityBindings.bindReconciled' : 'oidcIdentityBindings.bindError'),
      )
    } finally {
      saving.value = false
    }
  }

  async function unbindIdentity(identity: ConsoleOidcIdentity) {
    if (props.writesFrozen || identity.tenantId !== tenantId.value) return
    const tenantSnapshot = tenantId.value
    const contextSnapshot = contextSequence
    try {
      await confirmDanger({
        verb: t('oidcIdentityBindings.unbind'),
        target: t('oidcIdentityBindings.unbindTarget', { username: identity.username }),
        consequence: t('oidcIdentityBindings.unbindConsequence'),
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
      })
    } catch {
      return
    }
    if (
      props.writesFrozen ||
      tenantId.value !== tenantSnapshot ||
      contextSequence !== contextSnapshot
    ) {
      return
    }
    const identityId = String(identity.id)
    unbindingId.value = identityId
    try {
      await unbindConsoleOidcIdentity(tenantSnapshot, identity.id)
      if (tenantId.value !== tenantSnapshot || contextSequence !== contextSnapshot) return
      await load()
      ElMessage.success(
        t(
          loadError.value
            ? 'oidcIdentityBindings.unbindAccepted'
            : 'oidcIdentityBindings.unbindSuccess',
        ),
      )
    } catch {
      if (tenantId.value !== tenantSnapshot || contextSequence !== contextSnapshot) return
      await load()
      const stillBound = identities.value.some((item) => String(item.id) === identityId)
      ElMessage[stillBound ? 'error' : 'success'](
        t(
          stillBound ? 'oidcIdentityBindings.unbindError' : 'oidcIdentityBindings.unbindReconciled',
        ),
      )
    } finally {
      unbindingId.value = ''
    }
  }

  watch(
    () => [props.modelValue, props.tenantId] as const,
    ([visible]) => {
      contextSequence += 1
      requestSequence += 1
      identities.value = []
      providerEnabled.value = null
      loadError.value = false
      if (visible) void load()
      else loading.value = false
    },
    { immediate: true },
  )
</script>

<style scoped>
  .oidc-bindings {
    display: flex;
    flex-direction: column;
    gap: var(--space-md, 16px);
  }

  .oidc-bindings__heading {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .oidc-bindings__hint {
    margin: -8px 0 0;
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .oidc-bindings__form {
    max-width: 680px;
  }

  .oidc-bindings__form-actions {
    display: flex;
    gap: var(--space-sm, 12px);
    padding-left: 140px;
  }

  .oidc-bindings__table {
    width: 100%;
  }

  @media (max-width: 640px) {
    .oidc-bindings__form-actions {
      padding-left: 0;
    }
  }
</style>
