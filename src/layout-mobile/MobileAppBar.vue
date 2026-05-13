<template>
  <header class="mobile-appbar">
    <div class="mobile-appbar__left">
      <div class="mobile-appbar__logo">BC</div>
      <div class="mobile-appbar__title">{{ title }}</div>
    </div>
    <div class="mobile-appbar__right">
      <button
        class="mobile-appbar__btn"
        :aria-label="t('palette.placeholder')"
        @click="$emit('open-palette')"
      >
        <el-icon><Search /></el-icon>
      </button>
      <el-popover placement="bottom-end" :width="290" trigger="click">
        <template #reference>
          <button class="mobile-appbar__btn" :aria-label="t('mobile.appBar.accountMenu')">
            <el-icon><User /></el-icon>
          </button>
        </template>
        <div class="mobile-appbar__panel">
          <div class="mobile-appbar__row">
            <span class="mobile-appbar__key">{{ t('mobile.appBar.user') }}</span>
            <span class="mobile-appbar__val">{{ auth.userInfo?.username ?? '—' }}</span>
          </div>
          <div class="mobile-appbar__row">
            <span class="mobile-appbar__key">{{ t('mobile.appBar.role') }}</span>
            <span class="mobile-appbar__val">{{ auth.role ?? '—' }}</span>
          </div>

          <!-- 租户:有切换权限显示下拉,否则只读 -->
          <div class="mobile-appbar__tenant">
            <span class="mobile-appbar__key">{{ t('mobile.appBar.tenant') }}</span>
            <TenantSelect
              v-if="canSwitchTenant"
              :model-value="tenant.tenantId"
              size="small"
              :placeholder="t('mobile.appBar.switchTenantPlaceholder')"
              select-class="query-w-190"
              @update:model-value="handleTenantSwitch"
            />
            <span v-else class="mobile-appbar__val">{{ tenant.tenantId }}</span>
          </div>

          <el-divider style="margin: 10px 0" />

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

          <el-divider style="margin: 10px 0" />

          <a class="mobile-appbar__link" @click="goDesktop">{{ t('mobile.appBar.goDesktop') }}</a>
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
  import { User, Monitor, Moon, Sunny, Search } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import { useTabsStore } from '@/stores/tabs'
  import { useAppStore } from '@/stores/app'
  import { canSwitchTenant as checkCanSwitchTenant } from '@/utils/tenantAccess'
  import { pathToKey } from '@/constants/pathKey'
  import TenantSelect from '@/components/common/TenantSelect.vue'

  defineEmits<{ (e: 'open-palette'): void }>()

  const route = useRoute()
  const router = useRouter()
  const { t, te } = useI18n({ useScope: 'global' })
  const auth = useAuthStore()
  const tenant = useTenantStore()
  const tabsStore = useTabsStore()
  const app = useAppStore()

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
  .mobile-appbar {
    position: sticky;
    top: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    padding-top: calc(env(safe-area-inset-top, 0) + 10px);
    background: var(--color-bg-card);
    border-bottom: 1px solid var(--color-border-light);
    z-index: 50;
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
    border-radius: 6px;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    background: linear-gradient(135deg, #1677ff 0%, #4ca1ff 100%);
    flex-shrink: 0;
  }

  .mobile-appbar__title {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-appbar__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .mobile-appbar__btn:active {
    background: color-mix(in srgb, var(--color-primary) 10%, transparent 90%);
  }

  .mobile-appbar__btn :deep(.el-icon) {
    font-size: 20px;
  }

  .mobile-appbar__panel {
    padding: 4px 0;
  }

  .mobile-appbar__row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 4px;
    font-size: 13px;
  }

  .mobile-appbar__key {
    color: var(--color-text-tertiary);
  }

  .mobile-appbar__val {
    color: var(--color-text-primary);
    font-weight: 500;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-appbar__link {
    display: block;
    padding: 10px 4px;
    font-size: 14px;
    color: var(--color-primary);
    cursor: pointer;
  }

  .mobile-appbar__link:active {
    opacity: 0.6;
  }

  .mobile-appbar__link--danger {
    color: var(--el-color-danger);
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
