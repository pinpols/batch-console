<template>
  <header class="mobile-appbar" :class="{ 'mobile-appbar--scrolled': scrolled }">
    <div class="mobile-appbar__left">
      <BatchMark class="mobile-appbar__logo" :size="28" />
      <transition name="appbar-title">
        <div v-if="scrolled" key="t" class="mobile-appbar__title">{{ title }}</div>
      </transition>
    </div>
    <div class="mobile-appbar__right">
      <AiAssistantLauncher mobile />
      <el-popover
        placement="bottom-end"
        popper-class="mobile-appbar__popover"
        :width="286"
        trigger="click"
      >
        <template #reference>
          <button class="mobile-appbar__btn" :aria-label="t('mobile.appBar.accountMenu')">
            <el-icon><User /></el-icon>
          </button>
        </template>
        <div class="mobile-appbar__panel">
          <div
            class="mobile-appbar__identity"
            :title="auth.userInfo?.username || t('mobile.appBar.user')"
          >
            <span class="mobile-appbar__identity-avatar">{{ userInitial }}</span>
            <span class="mobile-appbar__identity-meta">
              <strong class="mobile-appbar__identity-name">{{ userDisplayNameCompact }}</strong>
              <small v-if="userRoleLabel" class="mobile-appbar__identity-role">
                {{ userRoleLabel }}
              </small>
            </span>
          </div>

          <el-divider class="mobile-appbar__divider" />

          <!-- 租户:有切换权限显示下拉,否则只读 -->
          <div class="mobile-appbar__tenant">
            <span class="mobile-appbar__key">
              <el-icon class="mobile-appbar__icon"><User /></el-icon>
              {{ t('mobile.appBar.tenant') }}
            </span>
            <TenantSelect
              v-if="canSwitchTenant"
              :model-value="tenant.tenantId"
              size="small"
              :placeholder="t('mobile.appBar.switchTenantPlaceholder')"
              :select-class="''"
              class="mobile-appbar__tenant-select"
              @update:model-value="handleTenantSwitch"
            />
            <span v-else class="mobile-appbar__val">{{ tenant.tenantId }}</span>
          </div>

          <el-divider class="mobile-appbar__divider" />

          <!-- 展示时区:与桌面端共用本地偏好 -->
          <div class="mobile-appbar__row">
            <span class="mobile-appbar__key">
              <el-icon class="mobile-appbar__icon"><TimezoneIcon /></el-icon>
              {{ t('mobile.appBar.timezone') }}
            </span>
            <el-select
              :model-value="currentTimezone"
              size="small"
              class="mobile-appbar__timezone-select"
              :aria-label="t('layoutHeader.timezoneTooltip')"
              @change="changeDisplayTimezone"
            >
              <el-option
                v-for="timezone in timezoneOptions"
                :key="timezone"
                :label="timezoneOptionLabel(timezone)"
                :value="timezone"
              />
            </el-select>
          </div>

          <!-- 主题切换 -->
          <button
            type="button"
            class="mobile-appbar__row mobile-appbar__row--clickable"
            @click="app.toggleTheme()"
          >
            <span class="mobile-appbar__key">
              <el-icon class="mobile-appbar__icon">
                <Monitor v-if="app.themePreference === 'system'" />
                <Sunny v-else-if="app.themePreference === 'light'" />
                <Moon v-else />
              </el-icon>
              {{ t('mobile.appBar.theme') }}
            </span>
            <span class="mobile-appbar__val">{{ themeLabel }}</span>
          </button>

          <!-- 语言切换 -->
          <button
            type="button"
            class="mobile-appbar__row mobile-appbar__row--clickable"
            @click="toggleLocale"
          >
            <span class="mobile-appbar__key">
              <el-icon class="mobile-appbar__icon"><Promotion /></el-icon>
              {{ t('mobile.appBar.language') }}
            </span>
            <span class="mobile-appbar__val">{{ localeLabel }}</span>
          </button>

          <el-divider class="mobile-appbar__divider" />

          <!-- 退出 -->
          <el-popconfirm
            :title="t('mobile.appBar.confirmLogout')"
            :confirm-button-text="t('mobile.appBar.logoutConfirmText')"
            :cancel-button-text="t('common.cancel')"
            @confirm="handleLogout"
          >
            <template #reference>
              <button type="button" class="mobile-appbar__link mobile-appbar__link--danger">
                {{ t('mobile.appBar.logout') }}
              </button>
            </template>
          </el-popconfirm>
        </div>
      </el-popover>
    </div>
  </header>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import {
    User,
    Monitor,
    Moon,
    Sun as Sunny,
    Send as Promotion,
    Globe2 as TimezoneIcon,
  } from '@lucide/vue'
  import { ElMessage } from 'element-plus'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import { useTabsStore } from '@/stores/tabs'
  import { useAppStore } from '@/stores/app'
  import { canSwitchTenant as checkCanSwitchTenant } from '@/utils/tenantAccess'
  import { pathToKey } from '@/constants/pathKey'
  import { useLocale } from '@/composables/useLocale'
  import TenantSelect from '@/components/common/TenantSelect.vue'
  import BatchMark from '@/components/common/BatchMark.vue'
  import AiAssistantLauncher from '@/components/common/AiAssistantLauncher.vue'
  import {
    displayTimezone,
    getDisplayTimezoneOptions,
    getTimezoneOffsetLabel,
    writeDisplayTimezone,
  } from '@/constants/timezone'
  import { authorityRoleLabelKeyMap, resolveAuthorityRole } from '@/constants/role'
  import { truncateDisplayText } from '@/utils/text'

  withDefaults(defineProps<{ scrolled?: boolean }>(), { scrolled: false })

  const route = useRoute()
  const router = useRouter()
  const { t, te } = useI18n({ useScope: 'global' })
  const auth = useAuthStore()
  const tenant = useTenantStore()
  const tabsStore = useTabsStore()
  const app = useAppStore()
  const { current: currentLocale, setLocale } = useLocale()
  const canSwitchTenant = computed(() => checkCanSwitchTenant(auth.userInfo?.permissions ?? []))
  const currentTimezone = displayTimezone
  const timezoneOptions = computed(() => getDisplayTimezoneOptions(currentTimezone.value))
  const timezoneOptionLabel = (timezone: string) =>
    `${timezone} · ${getTimezoneOffsetLabel(timezone)}`
  const userInitial = computed(() =>
    (auth.userInfo?.username ?? '?').trim().charAt(0).toUpperCase(),
  )
  const userDisplayName = computed(() => auth.userInfo?.username ?? t('nav.notLoggedIn'))
  const userDisplayNameCompact = computed(() => truncateDisplayText(userDisplayName.value, 14))
  const userRoleLabel = computed(() => {
    const role = resolveAuthorityRole(auth.userInfo?.permissions ?? [])
    return role ? t(authorityRoleLabelKeyMap[role]) : ''
  })

  const title = computed(() => {
    // 移动端路由 meta 也写了中文 title;若桌面端 page.<key>.title 命中就走 i18n,
    // 否则回退到 meta.title,最终再兜底应用名
    const pathKey = route.meta?.pathKey as string | undefined
    const i18nKey = pathKey ? `page.${pathKey}.title` : `page.${pathToKey(route.path)}.title`
    if (te(i18nKey)) return t(i18nKey)
    return (route.meta.title as string) || t('nav.appTitle')
  })

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

  const localeLabel = computed(() =>
    currentLocale.value === 'zh-CN' ? t('mobile.appBar.localeZh') : t('mobile.appBar.localeEn'),
  )

  function toggleLocale() {
    setLocale(currentLocale.value === 'zh-CN' ? 'en-US' : 'zh-CN')
  }

  function changeDisplayTimezone(value: unknown) {
    if (typeof value !== 'string' || value === currentTimezone.value) return
    try {
      writeDisplayTimezone(value)
      ElMessage.success(t('layoutHeader.timezoneChanged', { timezone: value }))
    } catch {
      ElMessage.error(t('layoutHeader.invalidTimezone'))
    }
  }

  async function handleLogout() {
    await auth.logout()
    tabsStore.clear()
    router.push('/login')
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
</script>

<style scoped>
  /* iOS Liquid Glass Navigation Bar:毛玻璃 + 内底高光 + safe area 状态栏留白 */
  .mobile-appbar {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    padding-top: calc(env(safe-area-inset-top, 0) + 8px);
    background: color-mix(in srgb, var(--color-bg-elevated) 86%, transparent);
    backdrop-filter: saturate(180%) blur(28px);
    -webkit-backdrop-filter: saturate(180%) blur(28px);
    border-bottom: 1px solid var(--color-border-light);
    /* Liquid Glass:内底 0.5px 白高光 → 玻璃下缘折射;首屏无阴影,滚动塌缩时再加 */
    box-shadow:
      inset 0 -0.5px 0 color-mix(in srgb, var(--color-bg-base) 64%, transparent),
      inset 0 -8px 12px color-mix(in srgb, var(--color-bg-base) 18%, transparent);
    z-index: var(--z-app-bar);
  }

  /* rim light:左右两端淡彩色辉光,对称 tabbar */
  .mobile-appbar::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(
        circle at 0% 100%,
        color-mix(in srgb, var(--color-primary) 8%, transparent) 0%,
        transparent 35%
      ),
      radial-gradient(
        circle at 100% 100%,
        color-mix(in srgb, var(--color-info) 8%, transparent) 0%,
        transparent 35%
      );
    mix-blend-mode: screen;
  }

  /* 滚动塌缩:加投影拉开层级,inset 高光强度也增加 */
  .mobile-appbar--scrolled {
    box-shadow:
      inset 0 -0.5px 0 color-mix(in srgb, var(--color-bg-base) 76%, transparent),
      inset 0 -8px 12px color-mix(in srgb, var(--color-bg-base) 22%, transparent),
      0 2px 12px color-mix(in srgb, var(--color-text-primary) 12%, transparent);
  }

  .mobile-appbar__left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .mobile-appbar__logo {
    flex-shrink: 0;
  }

  /* iOS Compact Title:17px / -0.4 tracking;Large Title 由各页面 .m-page__title 承担。
     滚动塌缩时(.mobile-appbar--scrolled)才出现并 cross-fade in。 */
  .mobile-appbar__title {
    font-size: 17px;
    font-weight: 600;
    letter-spacing: 0;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* 滚动塌缩态:底部分隔线显出来(顶部 large title 已离开视线,需要视觉收口) */
  .mobile-appbar--scrolled {
    border-bottom-color: var(--color-border);
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
    color: var(--color-primary);
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
    color: var(--color-text-primary);
    font-family:
      -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Helvetica Neue', sans-serif;
  }

  :global(.mobile-appbar__popover.el-popover) {
    border-color: var(--color-border);
    background: var(--color-bg-elevated);
    color: var(--color-text-primary);
  }

  :global(.mobile-appbar__popover .el-popper__arrow::before) {
    border-color: var(--color-border);
    background: var(--color-bg-elevated);
  }

  .mobile-appbar__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 4px;
    font-size: 15px;
  }

  .mobile-appbar__key {
    color: var(--color-text-secondary);
  }

  .mobile-appbar__val {
    color: var(--color-text-primary);
    font-weight: 400;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-appbar__link {
    display: block;
    padding: 12px 4px;
    font-size: 16px;
    font-weight: 400;
    color: var(--color-primary);
    cursor: pointer;
    transition: opacity 0.1s ease;
  }

  .mobile-appbar__link:active {
    opacity: 0.5;
  }

  .mobile-appbar__link--danger {
    color: var(--color-danger);
  }

  .mobile-appbar__tenant {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 4px;
  }

  .mobile-appbar__identity {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 4px;
  }

  .mobile-appbar__identity-avatar {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--color-primary);
    color: var(--button-primary-text);
    font-size: 13px;
    font-weight: 700;
  }

  .mobile-appbar__identity-meta {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
    line-height: 1.25;
  }

  .mobile-appbar__identity-name,
  .mobile-appbar__identity-role {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-appbar__identity-name {
    color: var(--color-text-primary);
    font-size: 14px;
  }

  .mobile-appbar__identity-role {
    color: var(--color-text-tertiary);
    font-size: 11px;
  }

  .mobile-appbar__divider {
    margin: var(--space-sm) 0;
  }

  .mobile-appbar__timezone-select {
    width: 166px;
    flex: 0 0 auto;
  }

  .mobile-appbar__row--clickable {
    width: 100%;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    border-radius: 6px;
    transition: background 0.15s ease;
  }

  .mobile-appbar__row--clickable:active {
    background: var(--el-fill-color-light);
  }

  .mobile-appbar__icon {
    margin-right: 6px;
    vertical-align: -2px;
    font-size: 15px;
  }
</style>
