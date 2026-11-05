<template>
  <div v-if="visible" class="password-notice" role="status">
    <KeyRound :size="17" aria-hidden="true" class="password-notice__icon" />
    <div class="password-notice__copy">
      <strong>{{ title }}</strong>
      <span>{{ description }}</span>
    </div>
    <AutoDismissBannerActions
      :countdown-text="t('passwordNotice.autoClose', { seconds: secondsLeft })"
      :close-label="t('common.close')"
      @dismiss="dismiss"
    >
      <el-button link type="warning" :icon="ArrowRight" @click="openAccount">
        {{ t('passwordNotice.action') }}
      </el-button>
    </AutoDismissBannerActions>
  </div>
</template>

<script setup lang="ts">
  import { computed, onUnmounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ArrowRight, KeyRound } from '@lucide/vue'
  import { useAuthStore } from '@/stores/auth'
  import { STORAGE_KEYS } from '@/constants/storageKeys'
  import AutoDismissBannerActions from './AutoDismissBannerActions.vue'

  const auth = useAuthStore()
  const route = useRoute()
  const router = useRouter()
  const { t } = useI18n({ useScope: 'global' })
  const dismissed = ref(false)
  const secondsLeft = ref(15)
  let countdownTimer: ReturnType<typeof setInterval> | null = null

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

  // 关闭（手动或倒计时结束）记入本次浏览器会话：同一用户切换页面、刷新都不再出现，重新登录后再提示
  function readDismissedFor(username?: string): boolean {
    if (!username) return false
    try {
      return sessionStorage.getItem(STORAGE_KEYS.passwordNoticeDismissed) === username
    } catch {
      return false
    }
  }
  function dismiss() {
    dismissed.value = true
    if (countdownTimer) clearInterval(countdownTimer)
    countdownTimer = null
    const username = auth.userInfo?.username
    if (!username) return
    try {
      sessionStorage.setItem(STORAGE_KEYS.passwordNoticeDismissed, username)
    } catch {
      // 存储不可用时只在当前页面内关闭
    }
  }

  watch(
    () => [auth.userInfo?.username, needsPasswordUpdate.value || isExpiringSoon.value] as const,
    ([username, eligible]) => {
      if (countdownTimer) clearInterval(countdownTimer)
      countdownTimer = null
      dismissed.value = readDismissedFor(username)
      secondsLeft.value = 15
      if (!eligible || dismissed.value) return
      countdownTimer = setInterval(() => {
        if (secondsLeft.value <= 1) {
          dismiss()
          if (countdownTimer) clearInterval(countdownTimer)
          countdownTimer = null
        } else {
          secondsLeft.value -= 1
        }
      }, 1000)
    },
    { immediate: true },
  )

  onUnmounted(() => {
    if (countdownTimer) clearInterval(countdownTimer)
  })

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
  }
</style>
