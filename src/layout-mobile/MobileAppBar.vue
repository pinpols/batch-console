<template>
  <header class="mobile-appbar" :class="{ 'mobile-appbar--scrolled': scrolled }">
    <div class="mobile-appbar__left">
      <transition name="appbar-title">
        <div v-if="scrolled" key="t" class="mobile-appbar__title">{{ title }}</div>
      </transition>
    </div>
    <div class="mobile-appbar__right">
      <button
        class="mobile-appbar__btn"
        :aria-label="t('palette.placeholder')"
        @click="$emit('open-palette')"
      >
        <el-icon><Search /></el-icon>
      </button>
      <button
        class="mobile-appbar__btn"
        :aria-label="t('mobile.appBar.accountMenu')"
        @click="accountOpen = true"
      >
        <el-icon><User /></el-icon>
      </button>
    </div>
  </header>

  <!-- 账号 BottomSheet:头像/用户/角色 + 租户切换 + 主题 + 跳桌面 / 退出 -->
  <MBottomSheet v-model="accountOpen">
    <div class="m-account">
      <!-- profile 头部 -->
      <div class="m-account__profile">
        <div class="m-account__avatar">
          {{ (auth.userInfo?.username || '?').slice(0, 1).toUpperCase() }}
        </div>
        <div class="m-account__profile-text">
          <div class="m-account__name">{{ auth.userInfo?.username ?? '—' }}</div>
          <div class="m-account__role">{{ auth.role ?? '—' }}</div>
        </div>
      </div>

      <!-- 租户卡 -->
      <div class="m-list">
        <div class="m-list__row m-account__row">
          <span class="m-account__key">{{ t('mobile.appBar.tenant') }}</span>
          <TenantSelect
            v-if="canSwitchTenant"
            :model-value="tenant.tenantId"
            size="small"
            :placeholder="t('mobile.appBar.switchTenantPlaceholder')"
            @update:model-value="handleTenantSwitch"
          />
          <span v-else class="m-account__val">{{ tenant.tenantId }}</span>
        </div>
      </div>

      <!-- 主题切换卡 -->
      <div class="m-list">
        <div class="m-list__row m-list__row--clickable m-account__row" @click="app.toggleTheme()">
          <span class="m-account__key">
            <el-icon class="m-account__icon">
              <Monitor v-if="app.themePreference === 'system'" />
              <Sunny v-else-if="app.themePreference === 'light'" />
              <Moon v-else />
            </el-icon>
            {{ t('mobile.appBar.theme') }}
          </span>
          <span class="m-account__val">{{ themeLabel }}</span>
        </div>
      </div>

      <!-- 操作 -->
      <button class="m-account__action" @click="goDesktop">
        {{ t('mobile.appBar.goDesktop') }}
      </button>
      <button class="m-account__action m-account__action--danger" @click="onLogoutClick">
        {{ t('mobile.appBar.logout') }}
      </button>
    </div>
  </MBottomSheet>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { User, Monitor, Moon, Sunny, Search } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import { useTabsStore } from '@/stores/tabs'
  import { useAppStore } from '@/stores/app'
  import { canSwitchTenant as checkCanSwitchTenant } from '@/utils/tenantAccess'
  import { pathToKey } from '@/constants/pathKey'
  import TenantSelect from '@/components/common/TenantSelect.vue'
  import MBottomSheet from './MBottomSheet.vue'
  import { confirmActionSheet } from './MActionSheet'

  defineEmits<{ (e: 'open-palette'): void }>()
  withDefaults(defineProps<{ scrolled?: boolean }>(), { scrolled: false })

  const route = useRoute()
  const router = useRouter()
  const { t, te } = useI18n({ useScope: 'global' })
  const auth = useAuthStore()
  const tenant = useTenantStore()
  const tabsStore = useTabsStore()
  const app = useAppStore()
  const accountOpen = ref(false)

  const title = computed(() => {
    // 移动端路由 meta 也写了中文 title;若桌面端 page.<key>.title 命中就走 i18n,
    // 否则回退到 meta.title,最终再兜底应用名
    const pathKey = route.meta?.pathKey as string | undefined
    const i18nKey = pathKey ? `page.${pathKey}.title` : `page.${pathToKey(route.path)}.title`
    if (te(i18nKey)) return t(i18nKey)
    return (route.meta.title as string) || t('nav.appTitle')
  })
  const canSwitchTenant = computed(() => checkCanSwitchTenant(auth.userInfo?.permissions ?? []))
  const themeLabel = computed(() => {
    switch (app.themePreference) {
      case 'light':
        return t('mobile.appBar.themeLight')
      case 'dark':
        return t('mobile.appBar.themeDark')
      default:
        return t('mobile.appBar.themeFollowSystem')
    }
  })

  async function handleLogout() {
    await auth.logout()
    tabsStore.clear()
    router.push('/login')
  }

  // sheet 里点退出 → 先弹 iOS ActionSheet 二次确认
  async function onLogoutClick() {
    try {
      await confirmActionSheet(t('mobile.appBar.confirmLogout'), t('mobile.appBar.logout'), {
        type: 'warning',
        confirmButtonText: t('mobile.appBar.logoutConfirmText'),
        cancelButtonText: t('common.cancel'),
      })
    } catch {
      return // cancelled
    }
    accountOpen.value = false
    await handleLogout()
  }

  async function handleTenantSwitch(newTenantId: string) {
    if (!newTenantId) return
    tenant.setTenantId(newTenantId)
    ElMessage.success(t('mobile.appBar.switchedTenant', { id: newTenantId }))
    try {
      await auth.fetchMe()
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[mobile tenant-switch] fetchMe failed:', err)
    }
  }

  function goDesktop() {
    // 把当前移动路径映射到桌面路径（去掉 /m 前缀），并显式 ?desktop=1 禁用反向跳回
    const desktopPath = route.path.replace(/^\/m(\/|$)/, '/')
    router.push({ path: desktopPath || '/', query: { desktop: '1' } })
  }
</script>

<style scoped>
  /* iOS Navigation Bar:毛玻璃 + 极细下分隔线 + safe area 状态栏留白 */
  .mobile-appbar {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    padding-top: calc(env(safe-area-inset-top, 0) + 8px);
    background: color-mix(in srgb, #ffffff 78%, transparent 22%);
    backdrop-filter: saturate(180%) blur(24px);
    -webkit-backdrop-filter: saturate(180%) blur(24px);
    border-bottom: 0.5px solid rgb(60 60 67 / 18%);
    z-index: 50;
  }

  :global(html.dark) .mobile-appbar {
    background: color-mix(in srgb, #1c1c1e 78%, transparent 22%);
    border-bottom-color: rgb(84 84 88 / 60%);
  }

  .mobile-appbar__left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .mobile-appbar__logo {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    background: linear-gradient(135deg, #007aff 0%, #5ac8fa 100%);
    flex-shrink: 0;
  }

  /* iOS Compact Title:17px / -0.4 tracking;Large Title 由各页面 .m-page__title 承担。
     滚动塌缩时(.mobile-appbar--scrolled)才出现并 cross-fade in。 */
  .mobile-appbar__title {
    font-size: 17px;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: #000;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(html.dark) .mobile-appbar__title {
    color: #fff;
  }

  /* 滚动塌缩态:底部分隔线显出来(顶部 large title 已离开视线,需要视觉收口) */
  .mobile-appbar--scrolled {
    border-bottom-color: rgb(60 60 67 / 36%);
  }
  :global(html.dark) .mobile-appbar--scrolled {
    border-bottom-color: rgb(84 84 88 / 90%);
  }

  /* compact title fade-in 动画 */
  .appbar-title-enter-active,
  .appbar-title-leave-active {
    transition:
      opacity 0.18s ease,
      transform 0.18s ease;
  }
  .appbar-title-enter-from,
  .appbar-title-leave-to {
    opacity: 0;
    transform: translateY(4px);
  }

  /* iOS Bar Button:圆角灰 fill,主色 icon */
  .mobile-appbar__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: #007aff;
    cursor: pointer;
    transition: opacity 0.1s ease;
  }

  .mobile-appbar__btn:active {
    opacity: 0.4;
  }

  .mobile-appbar__btn :deep(.el-icon) {
    font-size: 22px;
  }

  .mobile-appbar__panel {
    padding: 4px 0;
    font-family:
      -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Helvetica Neue', sans-serif;
  }

  /* ── 账号 BottomSheet 内容样式 ────────────────────── */
  .m-account {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-top: 4px;
  }

  /* profile 头部:圆形 avatar + 用户名 + 角色 */
  .m-account__profile {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 4px 14px;
  }

  .m-account__avatar {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: linear-gradient(135deg, #007aff 0%, #5ac8fa 100%);
    color: #fff;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.02em;
    flex-shrink: 0;
  }

  .m-account__profile-text {
    min-width: 0;
  }

  .m-account__name {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #000;
    line-height: 1.2;
  }

  :global(html.dark) .m-account__name {
    color: #fff;
  }

  .m-account__role {
    margin-top: 2px;
    font-size: 13px;
    color: rgb(60 60 67 / 60%);
  }

  /* list 行:左 key 右 value/select */
  .m-account__row {
    justify-content: space-between;
    gap: 12px;
  }

  .m-account__key {
    display: inline-flex;
    align-items: center;
    color: #000;
    font-size: 15px;
  }

  :global(html.dark) .m-account__key {
    color: #fff;
  }

  .m-account__val {
    color: rgb(60 60 67 / 60%);
    font-size: 15px;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .m-account__icon {
    margin-right: 8px;
    vertical-align: -2px;
    font-size: 18px;
    color: rgb(60 60 67 / 60%);
  }

  /* 主操作按钮:整宽 iOS button,与 .m-list 视觉一致 */
  .m-account__action {
    display: block;
    width: 100%;
    padding: 14px 16px;
    border: none;
    border-radius: 14px;
    background: var(--ios-bg-elevated, #fff);
    color: #007aff;
    font-size: 17px;
    font-weight: 400;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.1s ease;
    box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
  }

  .m-account__action:active {
    opacity: 0.55;
  }

  .m-account__action--danger {
    color: #ff3b30;
    font-weight: 600;
  }

  :global(html.dark) .m-account__action {
    background: #1c1c1e;
  }
</style>
