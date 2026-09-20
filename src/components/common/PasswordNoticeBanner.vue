<template>
  <div v-if="visible" class="password-notice" role="status">
    <KeyRound :size="17" aria-hidden="true" class="password-notice__icon" />
    <div class="password-notice__copy">
      <strong>{{ title }}</strong>
      <span>{{ description }}</span>
    </div>
    <div class="password-notice__actions">
      <el-button link type="warning" :icon="ArrowRight" @click="openAccount">
        {{ t('passwordNotice.action') }}
      </el-button>
      <el-button
        text
        circle
        :icon="X"
        :aria-label="t('common.close')"
        class="password-notice__close"
        @click="dismissed = true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ArrowRight, KeyRound, X } from 'lucide-vue-next'
  import { useAuthStore } from '@/stores/auth'

  const auth = useAuthStore()
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n({ useScope: 'global' })
  const dismissed = ref(false)

  const needsPasswordUpdate = computed(() => auth.userInfo?.mustChangePassword === true)
  const expiringDays = computed(() => auth.userInfo?.passwordExpiringIn)
  const isExpiringSoon = computed(() => expiringDays.value != null && expiringDays.value <= 7)
  const visible = computed(
    () =>
      !dismissed.value &&
      route.path !== '/system/me' &&
      (needsPasswordUpdate.value || isExpiringSoon.value),
  )
  const title = computed(() =>
    needsPasswordUpdate.value
      ? t('passwordNotice.updateTitle')
      : t('passwordNotice.expiringTitle', { days: expiringDays.value }),
  )
  const description = computed(() =>
    needsPasswordUpdate.value
      ? t('passwordNotice.updateDescription')
      : t('passwordNotice.expiringDescription'),
  )

  watch(
    () => auth.userInfo?.username,
    () => {
      dismissed.value = false
    },
  )

  function openAccount() {
    const query: Record<string, string> = {}
    if (needsPasswordUpdate.value) query.mustChange = '1'
    if (route.path.startsWith('/m/')) query.desktop = '1'
    void router.push({ path: '/system/me', query })
  }
</script>

<style scoped>
  .password-notice {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 38px;
    padding: 6px 12px 6px 16px;
    border-bottom: 1px solid color-mix(in srgb, var(--color-warning) 24%, var(--color-border));
    color: color-mix(in srgb, var(--color-warning) 78%, var(--color-text-primary) 22%);
    background: color-mix(in srgb, var(--color-warning) 9%, var(--color-bg-card) 91%);
    font-size: 12px;
    line-height: 1.45;
  }

  .password-notice__icon {
    flex: none;
  }

  .password-notice__copy {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .password-notice__copy strong {
    flex: none;
    font-weight: 650;
  }

  .password-notice__copy span {
    min-width: 0;
    color: var(--color-text-secondary);
  }

  .password-notice__actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: none;
  }

  .password-notice__actions :deep(.el-button + .el-button) {
    margin-left: 0;
  }

  .password-notice__close {
    color: var(--color-text-tertiary);
  }

  @media (max-width: 720px) {
    .password-notice {
      align-items: flex-start;
      flex-wrap: wrap;
      padding: 8px 10px;
    }

    .password-notice__copy {
      display: grid;
      gap: 2px;
    }

    .password-notice__actions {
      width: 100%;
      justify-content: flex-end;
    }
  }
</style>
