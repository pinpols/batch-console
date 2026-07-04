<template>
  <PageContainer>
    <PageHeader />

    <SectionCard>
      <el-tabs v-model="activeTab" class="pill-tabs">
        <el-tab-pane v-for="item in navItems" :key="item.key" :name="item.key">
          <template #label>
            <span class="config-tab__label">
              <el-icon class="config-tab__icon"><component :is="item.icon" /></el-icon>
              {{ item.title }}
            </span>
          </template>

          <div class="config-tab__head">
            <div>
              <h2>{{ item.title }}</h2>
              <p>{{ item.desc }}</p>
            </div>
            <el-tag effect="plain" size="small" type="info">{{ item.badge }}</el-tag>
          </div>

          <!-- 仅在该 tab 激活时才挂载子组件,避免一进页面拉 4 套接口 -->
          <template v-if="activeTab === item.key">
            <ConfigChangeLogsTab v-if="item.key === 'logs'" />
            <ConfigSecretsTab v-else-if="item.key === 'secrets'" />
            <ConfigSyncTab v-else-if="item.key === 'sync'" />
            <ConfigSyncLogsTab v-else-if="item.key === 'syncLogs'" />
          </template>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import {
    Share2 as Connection,
    KeyRound as Key,
    List,
    SlidersHorizontal as Operation,
  } from 'lucide-vue-next'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import ConfigChangeLogsTab from './components/ConfigChangeLogsTab.vue'
  import ConfigSecretsTab from './components/ConfigSecretsTab.vue'
  import ConfigSyncTab from './components/ConfigSyncTab.vue'
  import ConfigSyncLogsTab from './components/ConfigSyncLogsTab.vue'

  const { t } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()

  type ConfigTab = 'logs' | 'secrets' | 'sync' | 'syncLogs'

  const validTabs = new Set<ConfigTab>(['logs', 'secrets', 'sync', 'syncLogs'])
  const activeTab = ref<ConfigTab>(
    validTabs.has(route.query.tab as ConfigTab) ? (route.query.tab as ConfigTab) : 'logs',
  )

  const navItems = computed(() => [
    {
      key: 'logs' as const,
      icon: List,
      title: t('configManagement.tabLogs'),
      desc: t('configManagement.descLogs'),
      badge: t('configManagement.badgeAudit'),
    },
    {
      key: 'secrets' as const,
      icon: Key,
      title: t('configManagement.tabSecrets'),
      desc: t('configManagement.descSecrets'),
      badge: t('configManagement.badgeSecurity'),
    },
    {
      key: 'sync' as const,
      icon: Connection,
      title: t('configManagement.tabSync'),
      desc: t('configManagement.descSync'),
      badge: t('configManagement.badgeAction'),
    },
    {
      key: 'syncLogs' as const,
      icon: Operation,
      title: t('configManagement.tabSyncLogs'),
      desc: t('configManagement.descSyncLogs'),
      badge: t('configManagement.badgeAudit'),
    },
  ])

  watch(activeTab, (tab) => {
    void router.replace({ query: { ...route.query, tab } })
  })
</script>

<style scoped>
  .config-tab__label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .config-tab__icon {
    font-size: 15px;
  }

  .config-tab__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-md);
    padding: 4px 0 12px;
    border-bottom: 1px solid var(--color-border-light);
    margin-bottom: var(--page-block-gap);
  }

  .config-tab__head h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 650;
    line-height: 1.35;
    color: var(--color-text-primary);
  }

  .config-tab__head p {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.55;
    color: var(--color-text-secondary);
  }

  @media (max-width: 640px) {
    .config-tab__head {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
