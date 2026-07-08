<template>
  <PageContainer>
    <PageHeader />

    <div>
      <el-tabs v-model="activeTab" class="pill-tabs">
        <el-tab-pane v-for="item in navItems" :key="item.key" :name="item.key">
          <template #label>
            <span class="config-tab__label">
              <el-icon class="config-tab__icon"><component :is="item.icon" /></el-icon>
              {{ item.title }}
            </span>
          </template>

          <!-- 头部说明行已去(用户反馈:desc+badge 一行松散啰嗦;各 tab 内容自带 hint) -->
          <!-- 仅在该 tab 激活时才挂载子组件,避免一进页面拉 4 套接口 -->
          <template v-if="activeTab === item.key">
            <ConfigChangeLogsTab v-if="item.key === 'logs'" />
            <ConfigSecretsTab v-else-if="item.key === 'secrets'" />
            <ConfigSyncTab v-else-if="item.key === 'sync'" />
            <ConfigSyncLogsTab v-else-if="item.key === 'syncLogs'" />
          </template>
        </el-tab-pane>
      </el-tabs>
    </div>
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
    },
    {
      key: 'secrets' as const,
      icon: Key,
      title: t('configManagement.tabSecrets'),
    },
    {
      key: 'sync' as const,
      icon: Connection,
      title: t('configManagement.tabSync'),
    },
    {
      key: 'syncLogs' as const,
      icon: Operation,
      title: t('configManagement.tabSyncLogs'),
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
</style>
