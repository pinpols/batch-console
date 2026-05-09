<template>
  <header class="mobile-appbar">
    <div class="mobile-appbar__left">
      <div class="mobile-appbar__logo">BC</div>
      <div class="mobile-appbar__title">{{ title }}</div>
    </div>
    <div class="mobile-appbar__right">
      <el-popover placement="bottom-end" :width="290" trigger="click">
        <template #reference>
          <button class="mobile-appbar__btn" aria-label="账号菜单">
            <el-icon><User /></el-icon>
          </button>
        </template>
        <div class="mobile-appbar__panel">
          <div class="mobile-appbar__row">
            <span class="mobile-appbar__key">用户</span>
            <span class="mobile-appbar__val">{{ auth.userInfo?.username ?? '—' }}</span>
          </div>
          <div class="mobile-appbar__row">
            <span class="mobile-appbar__key">角色</span>
            <span class="mobile-appbar__val">{{ auth.role ?? '—' }}</span>
          </div>

          <!-- 租户：有切换权限显示下拉，否则只读 -->
          <div class="mobile-appbar__tenant">
            <span class="mobile-appbar__key">租户</span>
            <TenantSelect
              v-if="canSwitchTenant"
              :model-value="tenant.tenantId"
              size="small"
              placeholder="切换租户"
              select-class="query-w-190"
              @update:model-value="handleTenantSwitch"
            />
            <span v-else class="mobile-appbar__val">{{ tenant.tenantId }}</span>
          </div>

          <el-divider style="margin: 10px 0" />

          <!-- 主题切换 -->
          <div class="mobile-appbar__row mobile-appbar__row--clickable" @click="app.toggleTheme()">
            <span class="mobile-appbar__key">
              <el-icon class="mobile-appbar__icon">
                <Monitor v-if="app.themePreference === 'system'" />
                <Sunny v-else-if="app.themePreference === 'light'" />
                <Moon v-else />
              </el-icon>
              主题
            </span>
            <span class="mobile-appbar__val">{{ themeLabel }}</span>
          </div>

          <el-divider style="margin: 10px 0" />

          <a class="mobile-appbar__link" @click="goDesktop">切换到桌面版</a>
          <el-popconfirm
            title="确认退出登录？"
            confirm-button-text="退出"
            cancel-button-text="取消"
            @confirm="handleLogout"
          >
            <template #reference>
              <a class="mobile-appbar__link mobile-appbar__link--danger">退出登录</a>
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
  import { User, Monitor, Moon, Sunny } from '@element-plus/icons-vue'
  import { ElMessage } from 'element-plus'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import { useTabsStore } from '@/stores/tabs'
  import { useAppStore } from '@/stores/app'
  import { canSwitchTenant as checkCanSwitchTenant } from '@/utils/tenantAccess'
  import TenantSelect from '@/components/common/TenantSelect.vue'

  const route = useRoute()
  const router = useRouter()
  const auth = useAuthStore()
  const tenant = useTenantStore()
  const tabsStore = useTabsStore()
  const app = useAppStore()

  const title = computed(() => (route.meta.title as string) || '批量调度平台')
  const canSwitchTenant = computed(() => checkCanSwitchTenant(auth.userInfo?.permissions ?? []))
  const themeLabel = computed(() => {
    switch (app.themePreference) {
      case 'light':
        return '浅色'
      case 'dark':
        return '深色'
      default:
        return '跟随系统'
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
    ElMessage.success(`已切换到 ${newTenantId}`)
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
