<template>
  <PageContainer>
    <PageHeader />

    <SectionCard class="config-workbench-card">
      <div class="config-workbench">
        <nav class="config-nav" :aria-label="t('configManagement.navAria')">
          <button
            v-for="item in navItems"
            :key="item.key"
            type="button"
            class="config-nav__item"
            :class="{ 'is-active': activeTab === item.key }"
            @mouseenter="selectTab(item.key)"
            @focus="selectTab(item.key)"
            @click="selectTab(item.key)"
          >
            <span class="config-nav__icon">
              <component :is="item.icon" />
            </span>
            <span class="config-nav__text">
              <span class="config-nav__title">{{ item.title }}</span>
              <span class="config-nav__desc">{{ item.desc }}</span>
            </span>
          </button>
        </nav>

        <section class="config-content">
          <div class="config-content__head">
            <div>
              <h2>{{ activeItem.title }}</h2>
              <p>{{ activeItem.desc }}</p>
            </div>
            <el-tag effect="plain" size="small" type="info">{{ activeItem.badge }}</el-tag>
          </div>

          <ConfigChangeLogsTab v-if="activeTab === 'logs'" />
          <ConfigSecretsTab v-else-if="activeTab === 'secrets'" />
          <ConfigSyncTab v-else-if="activeTab === 'sync'" />
          <ConfigSyncLogsTab v-else />
        </section>
      </div>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Connection, Key, List, Operation } from '@element-plus/icons-vue'
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

  const activeItem = computed(
    () => navItems.value.find((item) => item.key === activeTab.value) ?? navItems.value[0],
  )

  function selectTab(tab: ConfigTab) {
    if (activeTab.value === tab) return
    activeTab.value = tab
  }

  watch(activeTab, (tab) => {
    void router.replace({ query: { ...route.query, tab } })
  })
</script>

<style scoped>
  .config-workbench {
    display: grid;
    grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
    gap: var(--page-section-gap);
    align-items: start;
  }

  .config-nav {
    display: grid;
    gap: var(--space-sm);
    padding: 8px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: color-mix(in srgb, var(--color-bg-card) 92%, var(--color-bg-canvas) 8%);
  }

  .config-nav__item {
    appearance: none;
    width: 100%;
    border: 1px solid transparent;
    border-radius: var(--radius-content);
    background: transparent;
    padding: 12px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    text-align: left;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition:
      transform 140ms ease,
      background-color var(--motion-duration-sm) var(--motion-ease-standard),
      border-color var(--motion-duration-sm) var(--motion-ease-standard),
      box-shadow var(--motion-duration-md) var(--motion-ease-standard),
      color var(--motion-duration-sm) var(--motion-ease-standard);
  }

  .config-nav__item:hover,
  .config-nav__item:focus-visible {
    transform: translateY(-1px);
    color: var(--color-text-primary);
    background: var(--color-bg-card);
    border-color: color-mix(in srgb, var(--color-border) 82%, var(--color-primary) 18%);
    outline: none;
  }

  .config-nav__item.is-active {
    transform: translateY(-1px);
    color: var(--color-text-primary);
    background: color-mix(in srgb, var(--color-primary) 9%, var(--color-bg-card) 91%);
    border-color: color-mix(in srgb, var(--color-primary) 24%, var(--color-border) 76%);
    box-shadow:
      0 8px 18px rgb(15 23 42 / 9%),
      var(--surface-hover-edge-inset);
  }

  .config-nav__icon {
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-input);
    background: color-mix(in srgb, var(--color-bg-card) 86%, var(--color-bg-canvas) 14%);
    border: 1px solid var(--color-border-light);
    color: var(--color-text-tertiary);
  }

  .config-nav__item.is-active .config-nav__icon {
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-card) 88%);
    border-color: color-mix(in srgb, var(--color-primary) 22%, var(--color-border) 78%);
  }

  .config-nav__icon :deep(svg) {
    width: 17px;
    height: 17px;
  }

  .config-nav__text {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  .config-nav__title {
    font-size: 14px;
    font-weight: 650;
    line-height: 1.35;
  }

  .config-nav__desc {
    font-size: 12px;
    line-height: 1.45;
    color: var(--color-text-tertiary);
  }

  .config-content {
    min-width: 0;
  }

  .config-content__head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-md);
    padding: 4px 0 12px;
    border-bottom: 1px solid var(--color-border-light);
    margin-bottom: var(--page-block-gap);
  }

  .config-content__head h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 650;
    line-height: 1.35;
    color: var(--color-text-primary);
  }

  .config-content__head p {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.55;
    color: var(--color-text-secondary);
  }

  @media (max-width: 960px) {
    .config-workbench {
      grid-template-columns: 1fr;
    }

    .config-nav {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .config-nav {
      grid-template-columns: 1fr;
    }

    .config-content__head {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
