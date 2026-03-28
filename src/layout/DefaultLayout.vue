<template>
  <el-container class="layout-root">
    <el-aside class="layout-sidebar" :width="app.sidebarCollapsed ? '80px' : '240px'">
      <div class="brand">
        <div class="brand__logo">BC</div>
        <div v-if="!app.sidebarCollapsed" class="brand__text">
          <div class="brand__title">批量调度平台</div>
          <div class="brand__subtitle">Batch Console</div>
        </div>
      </div>

      <el-menu
        class="layout-menu"
        :collapse="app.sidebarCollapsed"
        :default-active="activeMenu"
        :unique-opened="true"
        router
      >
        <template v-for="group in visibleGroups" :key="group.key">
          <el-sub-menu :index="group.key">
            <template #title>
              <el-icon>
                <component :is="group.icon" />
              </el-icon>
              <span>{{ group.title }}</span>
            </template>
            <el-menu-item
              v-for="item in group.children"
              :key="item.path"
              :index="item.path"
            >
              {{ item.title }}
            </el-menu-item>
          </el-sub-menu>
        </template>
      </el-menu>
    </el-aside>

    <el-container class="layout-shell">
      <el-header class="layout-header">
        <div class="layout-header__left">
          <el-button text class="icon-button" @click="app.toggleSidebar()">
            <el-icon>
              <Fold v-if="!app.sidebarCollapsed" />
              <Expand v-else />
            </el-icon>
          </el-button>
          <div class="page-meta">
            <div class="page-meta__title">{{ currentTitle }}</div>
            <div class="page-meta__subtitle">{{ currentSubtitle }}</div>
          </div>
        </div>

        <div class="layout-header__right">
          <span class="tenant-label">租户</span>
          <el-input
            v-model="tenantIdInput"
            class="tenant-input"
            size="small"
            clearable
            placeholder="tenantId"
            @change="onTenantCommit"
            @blur="onTenantCommit"
          />
          <el-tag v-if="auth.role" size="small" type="info">{{ auth.role }}</el-tag>
          <span class="username">{{ auth.userInfo?.username ?? '未登录' }}</span>
          <el-button text type="primary" @click="handleLogout">退出</el-button>
        </div>
      </el-header>

      <el-main class="layout-main">
        <RouterView />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { Expand, Fold } from '@element-plus/icons-vue'
  import { useAuthStore } from '@/stores/auth'
  import { useAppStore } from '@/stores/app'
  import { usePermissionStore } from '@/stores/permission'
  import { useTenantStore } from '@/stores/tenant'

  const route = useRoute()
  const router = useRouter()
  const auth = useAuthStore()
  const app = useAppStore()
  const permission = usePermissionStore()
  const tenant = useTenantStore()

  const tenantIdInput = ref(tenant.tenantId)
  watch(
    () => tenant.tenantId,
    (v) => {
      tenantIdInput.value = v
    },
  )

  function onTenantCommit() {
    const v = tenantIdInput.value?.trim() || 'default'
    tenant.setTenantId(v)
  }

  const activeMenu = computed(() => (route.meta.activeMenu as string) ?? route.path)
  const currentTitle = computed(() => (route.meta.title as string) ?? '批量调度平台')
  const currentSubtitle = computed(
    () => (route.meta.description as string) ?? '状态驱动型运维控制台',
  )
  const visibleGroups = computed(() => permission.visibleGroups)

  async function handleLogout() {
    await auth.logout()
    router.push('/login')
  }
</script>

<style scoped>
  .layout-root {
    min-height: 100vh;
    background: var(--color-bg-page);
  }

  .layout-sidebar {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--color-border-light);
    background: linear-gradient(180deg, #091120 0%, #0f172a 100%);
    transition: width 0.2s ease;
    overflow: hidden;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 64px;
    padding: 0 16px;
    border-bottom: 1px solid rgb(255 255 255 / 8%);
  }

  .brand__logo {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.08em;
    background: linear-gradient(135deg, #1677ff 0%, #4ca1ff 100%);
  }

  .brand__title {
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
  }

  .brand__subtitle {
    color: rgb(255 255 255 / 58%);
    font-size: 12px;
    line-height: 1.3;
  }

  .layout-menu {
    flex: 1;
    border-right: none;
    background: transparent;
  }

  .layout-menu :deep(.el-sub-menu__title),
  .layout-menu :deep(.el-menu-item) {
    color: rgb(255 255 255 / 78%);
  }

  .layout-menu :deep(.el-sub-menu__title:hover),
  .layout-menu :deep(.el-menu-item:hover) {
    color: #fff;
    background: rgb(255 255 255 / 8%);
  }

  .layout-menu :deep(.el-menu-item.is-active) {
    color: #fff;
    background: rgb(22 119 255 / 20%);
  }

  .layout-shell {
    min-width: 0;
  }

  .layout-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-lg);
    height: 64px;
    padding: 0 24px;
    background: rgba(255 255 255 / 84%);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--color-border-light);
  }

  .layout-header__left,
  .layout-header__right {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .page-meta {
    min-width: 0;
  }

  .page-meta__title {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.3;
  }

  .page-meta__subtitle {
    margin-top: 2px;
    color: var(--color-text-tertiary);
    font-size: 12px;
    line-height: 1.3;
  }

  .username {
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .tenant-label {
    color: var(--color-text-tertiary);
    font-size: 12px;
  }

  .tenant-input {
    width: 140px;
  }

  .layout-main {
    padding: 24px;
  }

  .icon-button {
    padding: 6px;
  }
</style>
