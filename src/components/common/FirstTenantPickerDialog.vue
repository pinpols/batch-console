<template>
  <el-dialog
    v-model="visible"
    :title="t('firstTenantPicker.title')"
    width="420px"
    :show-close="false"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    align-center
  >
    <p class="hint">{{ t('firstTenantPicker.hint') }}</p>
    <TenantSelect
      v-model="picked"
      :placeholder="t('firstTenantPicker.placeholder')"
      select-style="width: 100%"
    />
    <template #footer>
      <el-button type="primary" :disabled="!picked" @click="confirm">
        {{ t('firstTenantPicker.confirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { storeToRefs } from 'pinia'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import TenantSelect from '@/components/common/TenantSelect.vue'
  import { needFirstTenantPick } from '@/utils/firstTenantPicker'

  const { t } = useI18n({ useScope: 'global' })
  const auth = useAuthStore()
  const tenant = useTenantStore()
  const { isLoggedIn, isTenantUser } = storeToRefs(auth)

  const STORAGE_KEY = 'batch-console-tenant-id'
  const picked = ref('')

  /** 判定逻辑抽到 `utils/firstTenantPicker.ts`(独立 vitest 覆盖 8 case)。 */
  const needPick = computed(() =>
    needFirstTenantPick({
      isLoggedIn: isLoggedIn.value,
      isTenantUser: isTenantUser.value,
      storedTenantId: localStorage.getItem(STORAGE_KEY),
    }),
  )

  const visible = ref(false)
  watch(needPick, (v) => (visible.value = v), { immediate: true })

  function confirm() {
    if (!picked.value) return
    tenant.setTenantId(picked.value)
    visible.value = false
    // 触发依赖 tenant 的视图重取(useTenantReload 自动响应)
  }
</script>

<style scoped>
  .hint {
    margin: 0 0 12px;
    color: var(--color-text-secondary);
    font-size: 13px;
    line-height: 1.5;
  }
</style>
