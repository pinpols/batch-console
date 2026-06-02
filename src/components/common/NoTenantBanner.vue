<template>
  <el-alert
    v-if="visible"
    type="warning"
    show-icon
    :closable="false"
    class="no-tenant-banner"
    :title="title"
  >
    <template #default>
      <div class="no-tenant-banner__body">
        <span class="no-tenant-banner__text">{{ description }}</span>
        <el-button
          v-if="canCreate"
          link
          type="primary"
          class="no-tenant-banner__action"
          @click="goCreate"
        >
          {{ t('noTenantBanner.actionCreate') }}
        </el-button>
      </div>
    </template>
  </el-alert>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter, useRoute } from 'vue-router'
  import { storeToRefs } from 'pinia'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantStore } from '@/stores/tenant'

  const { t } = useI18n({ useScope: 'global' })
  const router = useRouter()
  const route = useRoute()
  const auth = useAuthStore()
  const tenant = useTenantStore()
  const { tenantId } = storeToRefs(tenant)

  // 排除三种本不依赖 tenantId 的页:维护页 / 自助账户 / 系统级管理页
  const TENANT_AGNOSTIC_PREFIXES = ['/system/me', '/maintenance', '/setup/']

  const visible = computed(() => {
    if (!auth.isLoggedIn) return false
    if (tenantId.value) return false
    return !TENANT_AGNOSTIC_PREFIXES.some((p) => route.path.startsWith(p))
  })

  const canCreate = computed(() => auth.hasPermission('ROLE_ADMIN'))

  const title = computed(() => t('noTenantBanner.title'))
  const description = computed(() =>
    canCreate.value ? t('noTenantBanner.descAdmin') : t('noTenantBanner.descUser'),
  )

  function goCreate() {
    void router.push('/system/tenants')
  }
</script>

<style scoped>
  .no-tenant-banner {
    border-radius: var(--radius-content, 8px);
  }

  .no-tenant-banner__body {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .no-tenant-banner__text {
    font-size: 13px;
    color: var(--color-text-primary);
  }

  .no-tenant-banner__action {
    padding: 0;
    height: auto;
  }
</style>
