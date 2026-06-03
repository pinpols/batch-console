<template>
  <header class="mobile-appbar" :class="{ 'mobile-appbar--scrolled': scrolled }">
    <div class="mobile-appbar__left">
      <div class="mobile-appbar__logo">BC</div>
      <transition name="appbar-title">
        <div v-if="scrolled" key="t" class="mobile-appbar__title">{{ title }}</div>
      </transition>
    </div>
    <div class="mobile-appbar__right">
      <el-popover
        placement="bottom-end"
        popper-class="mobile-appbar__popover"
        :width="240"
        trigger="click"
      >
        <template #reference>
          <button class="mobile-appbar__btn" :aria-label="t('mobile.appBar.accountMenu')">
            <el-icon><User /></el-icon>
          </button>
        </template>
        <div class="mobile-appbar__panel">
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

          <el-divider style="margin: 8px 0" />

          <!-- 主题切换 -->
          <div class="mobile-appbar__row mobile-appbar__row--clickable" @click="app.toggleTheme()">
            <span class="mobile-appbar__key">
              <el-icon class="mobile-appbar__icon">
                <Monitor v-if="app.themePreference === 'system'" />
                <Sunny v-else-if="app.themePreference === 'light'" />
                <Moon v-else />
              </el-icon>
              {{ t('mobile.appBar.theme') }}
            </span>
            <span class="mobile-appbar__val">{{ themeLabel }}</span>
          </div>

          <!-- 语言切换 -->
          <div class="mobile-appbar__row mobile-appbar__row--clickable" @click="toggleLocale">
            <span class="mobile-appbar__key">
              <el-icon class="mobile-appbar__icon"><Promotion /></el-icon>
              {{ t('mobile.appBar.language') }}
            </span>
            <span class="mobile-appbar__val">{{ localeLabel }}</span>
          </div>

          <el-divider style="margin: 8px 0" />

          <!-- 退出 -->
          <el-popconfirm
            :title="t('mobile.appBar.confirmLogout')"
            :confirm-button-text="t('mobile.appBar.logoutConfirmText')"
            :cancel-button-text="t('common.cancel')"
            @confirm="handleLogout"
          >
            <template #reference>
              <a class="mobile-appbar__link mobile-appbar__link--danger">
                {{ t('mobile.appBar.logout') }}
              </a>
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
  import { User, Monitor, Moon, Sunny, Promotion } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import { useTabsStore } from '@/stores/tabs'
  import { useAppStore } from '@/stores/app'
  import { canSwitchTenant as checkCanSwitchTenant } from '@/utils/tenantAccess'
  import { pathToKey } from '@/constants/pathKey'
  import { useLocale } from '@/composables/useLocale'
  import TenantSelect from '@/components/common/TenantSelect.vue'

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

  const localeLabel = computed(() => (currentLocale.value === 'zh-CN' ? '中文' : 'English'))

  function toggleLocale() {
    setLocale(currentLocale.value === 'zh-CN' ? 'en-US' : 'zh-CN')
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
    background: color-mix(in srgb, #ffffff 72%, transparent 28%);
    backdrop-filter: saturate(180%) blur(28px);
    -webkit-backdrop-filter: saturate(180%) blur(28px);
    border-bottom: 0.5px solid rgb(60 60 67 / 18%);
    /* Liquid Glass:内底 0.5px 白高光 → 玻璃下缘折射;首屏无阴影,滚动塌缩时再加 */
    box-shadow:
      inset 0 -0.5px 0 rgb(255 255 255 / 60%),
      inset 0 -8px 12px rgb(255 255 255 / 18%);
    z-index: var(--z-app-bar);
  }

  /* rim light:左右两端淡彩色辉光,对称 tabbar */
  .mobile-appbar::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 0% 100%, rgb(0 122 255 / 8%) 0%, transparent 35%),
      radial-gradient(circle at 100% 100%, rgb(90 200 250 / 8%) 0%, transparent 35%);
    mix-blend-mode: screen;
  }

  :global(html.dark) .mobile-appbar {
    background: color-mix(in srgb, #1c1c1e 78%, transparent 22%);
    border-bottom: 0.5px solid rgb(84 84 88 / 75%);
    box-shadow:
      inset 0 -0.5px 0 rgb(255 255 255 / 14%),
      inset 0 -8px 12px rgb(255 255 255 / 4%);
  }
  :global(html.dark) .mobile-appbar::after {
    background:
      radial-gradient(circle at 0% 100%, rgb(10 132 255 / 14%) 0%, transparent 40%),
      radial-gradient(circle at 100% 100%, rgb(94 92 230 / 12%) 0%, transparent 40%);
  }

  /* 滚动塌缩:加投影拉开层级,inset 高光强度也增加 */
  .mobile-appbar--scrolled {
    box-shadow:
      inset 0 -0.5px 0 rgb(255 255 255 / 80%),
      inset 0 -8px 12px rgb(255 255 255 / 22%),
      0 2px 12px rgb(0 0 0 / 8%);
  }
  :global(html.dark) .mobile-appbar--scrolled {
    box-shadow:
      inset 0 -0.5px 0 rgb(255 255 255 / 18%),
      inset 0 -8px 12px rgb(255 255 255 / 5%),
      0 2px 12px rgb(0 0 0 / 40%);
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

  .mobile-appbar__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 4px;
    font-size: 15px;
  }

  .mobile-appbar__key {
    color: rgb(60 60 67 / 60%);
  }

  .mobile-appbar__val {
    color: #000;
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
    color: #007aff;
    cursor: pointer;
    transition: opacity 0.1s ease;
  }

  .mobile-appbar__link:active {
    opacity: 0.5;
  }

  .mobile-appbar__link--danger {
    color: #ff3b30;
  }

  .mobile-appbar__tenant {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 4px;
  }

  .mobile-appbar__row--clickable {
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
