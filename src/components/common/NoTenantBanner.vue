<template>
  <div v-if="visible" class="no-tenant-banner" role="status">
    <Building2 :size="17" aria-hidden="true" class="no-tenant-banner__icon" />
    <div class="no-tenant-banner__copy">
      <strong>{{ title }}</strong>
      <span>{{ description }}</span>
    </div>
    <!-- 只保留顶栏一个租户搜索框：横幅按钮直接展开顶栏切换器，仍是一步到位 -->
    <el-button
      v-if="canSwitch && !autoSelecting"
      type="warning"
      size="small"
      :disabled="tenant.tenantSwitchPending"
      class="no-tenant-banner__select"
      @click="openHeaderTenantPicker"
    >
      {{ t('noTenantBanner.actionSelect') }}
    </el-button>
    <el-button
      v-if="canCreate"
      link
      type="warning"
      :icon="ArrowRight"
      class="no-tenant-banner__action"
      @click="goCreate"
    >
      {{ t('noTenantBanner.actionCreate') }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter, useRoute } from 'vue-router'
  import { storeToRefs } from 'pinia'
  import { ElMessage } from 'element-plus'
  import { ArrowRight, Building2 } from '@lucide/vue'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'
  import { useTenantSwitch } from '@/composables/useTenantSwitch'
  import { canSwitchTenant as checkCanSwitchTenant } from '@/utils/tenantAccess'
  import { listTenants } from '@/api/tenants'
  import { currentAuthSession } from '@/api/authSession'

  const { t } = useI18n({ useScope: 'global' })
  const router = useRouter()
  const route = useRoute()
  const auth = useAuthStore()
  const tenant = useTenantStore()
  const { switchTenant } = useTenantSwitch()
  const { tenantId } = storeToRefs(tenant)

  // 排除三种本不依赖 tenantId 的页:维护页 / 自助账户 / 系统级管理页
  const TENANT_AGNOSTIC_PREFIXES = ['/system/me', '/maintenance', '/setup/']

  // 与 TenantSelect 一致的隐藏租户(演示/系统孤儿),自动选时要排除
  const HIDDEN_TENANTS = new Set(['default', 'default-tenant', 'system'])

  const visible = computed(() => {
    if (!auth.isLoggedIn) return false
    if (tenantId.value) return false
    return !TENANT_AGNOSTIC_PREFIXES.some((p) => route.path.startsWith(p))
  })

  const canCreate = computed(() => auth.hasPermission('ROLE_ADMIN'))
  const canSwitch = computed(() => checkCanSwitchTenant(auth.userInfo?.permissions ?? []))

  const title = computed(() => t('noTenantBanner.title'))
  const description = computed(() =>
    canCreate.value ? t('noTenantBanner.descAdmin') : t('noTenantBanner.descUser'),
  )

  // 选定租户:写 store(API interceptor 立即读到)+ 刷 profile 重取菜单
  async function applyTenant(id: string): Promise<boolean> {
    if (!(await switchTenant(id))) return false
    try {
      await auth.fetchMe()
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[no-tenant-banner] fetchMe failed:', err)
    }
    return true
  }

  /** 展开顶栏租户切换器（LayoutHeader 中 data-onboarding="tenant" 的选择框） */
  function openHeaderTenantPicker() {
    const trigger = document.querySelector<HTMLElement>(
      '[data-onboarding="tenant"] .el-select__wrapper',
    )
    trigger?.click()
  }

  // 冷启动自愈:仅一个可选租户时自动选中,用户无需任何操作即可进入业务页,
  // 避免"登录即满屏空数据 + 需自己去右上角找切换器"的首屏摩擦。
  const autoSelecting = ref(true)
  onMounted(async () => {
    try {
      if (!visible.value || !canSwitch.value) return
      const session = currentAuthSession()
      const res = await listTenants({ pageNo: 1, pageSize: 50 })
      if (currentAuthSession() !== session || !visible.value || !canSwitch.value) return
      const usable = res.items.filter((it) => !HIDDEN_TENANTS.has(it.tenantId))
      if (usable.length === 1) {
        const applied = await applyTenant(usable[0].tenantId)
        if (applied) ElMessage.success(`${t('nav.switchTenant')}: ${usable[0].tenantId}`)
      }
    } catch {
      // 拉取失败不阻断:用户仍可用横幅内嵌选择器手动选
    } finally {
      autoSelecting.value = false
    }
  })

  function goCreate() {
    void router.push('/system/tenants')
  }
</script>

<style scoped>
  .no-tenant-banner {
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

  .no-tenant-banner__icon {
    flex: none;
  }

  .no-tenant-banner__copy {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .no-tenant-banner__copy strong {
    flex: none;
    font-weight: 650;
  }

  .no-tenant-banner__copy span {
    min-width: 0;
    color: var(--color-text-secondary);
  }

  .no-tenant-banner__action {
    padding: 0;
    height: auto;
    flex: none;
  }

  .no-tenant-banner__select {
    flex: 0 0 200px;
  }

  @media (max-width: 720px) {
    .no-tenant-banner {
      align-items: flex-start;
      flex-wrap: wrap;
      padding: 8px 10px;
    }

    .no-tenant-banner__copy {
      display: grid;
      gap: 2px;
    }

    .no-tenant-banner__select {
      flex: 1 1 180px;
      margin-left: 27px;
    }
  }
</style>
