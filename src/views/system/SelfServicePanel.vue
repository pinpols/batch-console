<template>
  <PageContainer>
    <PageHeader />

    <SectionCard class="self-service-card">
      <div class="self-service-layout">
        <nav class="self-service-nav" :aria-label="t('selfServicePanel.navAria')">
          <button
            v-for="item in serviceItems"
            :key="item.key"
            type="button"
            class="service-entry"
            :class="{ 'is-active': activeTab === item.key }"
            @mouseenter="selectTab(item.key)"
            @focus="selectTab(item.key)"
            @click="selectTab(item.key)"
          >
            <span class="service-entry__icon">
              <component :is="item.icon" />
            </span>
            <span class="service-entry__body">
              <span class="service-entry__title">{{ item.title }}</span>
              <span class="service-entry__desc">{{ item.desc }}</span>
            </span>
          </button>
        </nav>

        <section class="self-service-content">
          <div class="self-service-heading">
            <div>
              <h2>{{ activeItem.title }}</h2>
              <p>{{ activeItem.desc }}</p>
            </div>
            <el-tag effect="plain" size="small" type="info">
              {{ activeItem.badge }}
            </el-tag>
          </div>

          <SelfServiceQuotaTab v-if="activeTab === 'quota'" />
          <SelfServiceQuotaChangeTab v-else-if="activeTab === 'quotaChange'" />
          <SelfServiceRerunTab v-else-if="activeTab === 'rerun'" />
          <SelfServiceCompensationTab v-else />
        </section>
      </div>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { DataAnalysis, EditPen, RefreshRight, SetUp } from '@element-plus/icons-vue'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import SelfServiceQuotaTab from './components/SelfServiceQuotaTab.vue'
  import SelfServiceQuotaChangeTab from './components/SelfServiceQuotaChangeTab.vue'
  import SelfServiceRerunTab from './components/SelfServiceRerunTab.vue'
  import SelfServiceCompensationTab from './components/SelfServiceCompensationTab.vue'

  const { t } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()

  type ServiceTab = 'quota' | 'quotaChange' | 'rerun' | 'compensation'

  const validTabs = new Set<ServiceTab>(['quota', 'quotaChange', 'rerun', 'compensation'])
  const activeTab = ref<ServiceTab>(
    validTabs.has(route.query.tab as ServiceTab) ? (route.query.tab as ServiceTab) : 'quota',
  )

  const serviceItems = computed(() => [
    {
      key: 'quota' as const,
      icon: DataAnalysis,
      title: t('selfServicePanel.tabQuota'),
      desc: t('selfServicePanel.descQuota'),
      badge: t('selfServicePanel.badgeView'),
    },
    {
      key: 'quotaChange' as const,
      icon: EditPen,
      title: t('selfServicePanel.tabQuotaChange'),
      desc: t('selfServicePanel.descQuotaChange'),
      badge: t('selfServicePanel.badgeRequest'),
    },
    {
      key: 'rerun' as const,
      icon: RefreshRight,
      title: t('selfServicePanel.tabRerun'),
      desc: t('selfServicePanel.descRerun'),
      badge: t('selfServicePanel.badgeRequest'),
    },
    {
      key: 'compensation' as const,
      icon: SetUp,
      title: t('selfServicePanel.tabCompensation'),
      desc: t('selfServicePanel.descCompensation'),
      badge: t('selfServicePanel.badgeRequest'),
    },
  ])

  const activeItem = computed(
    () => serviceItems.value.find((item) => item.key === activeTab.value) ?? serviceItems.value[0],
  )

  function selectTab(tab: ServiceTab) {
    if (activeTab.value === tab) return
    activeTab.value = tab
  }

  watch(activeTab, (tab) => {
    void router.replace({ query: { ...route.query, tab } })
  })
</script>

<style scoped>
  .self-service-layout {
    display: grid;
    grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
    gap: var(--page-section-gap);
    align-items: start;
  }

  .self-service-nav {
    display: grid;
    gap: var(--space-sm);
    padding: 8px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: color-mix(in srgb, var(--color-bg-card) 92%, var(--color-bg-canvas) 8%);
  }

  .service-entry {
    appearance: none;
    width: 100%;
    border: 1px solid transparent;
    border-radius: var(--radius-content);
    background: transparent;
    padding: 12px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    text-align: left;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition:
      background-color var(--motion-duration-sm) var(--motion-ease-standard),
      border-color var(--motion-duration-sm) var(--motion-ease-standard),
      box-shadow var(--motion-duration-md) var(--motion-ease-standard),
      color var(--motion-duration-sm) var(--motion-ease-standard);
  }

  .service-entry:hover,
  .service-entry:focus-visible {
    color: var(--color-text-primary);
    background: var(--color-bg-card);
    border-color: color-mix(in srgb, var(--color-border) 82%, var(--color-primary) 18%);
    outline: none;
  }

  .service-entry.is-active {
    color: var(--color-text-primary);
    background: color-mix(in srgb, var(--color-primary) 9%, var(--color-bg-card) 91%);
    border-color: color-mix(in srgb, var(--color-primary) 24%, var(--color-border) 76%);
    box-shadow:
      0 8px 18px rgb(15 23 42 / 9%),
      var(--surface-hover-edge-inset);
  }

  .service-entry__icon {
    flex: 0 0 auto;
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-input);
    background: color-mix(in srgb, var(--color-bg-card) 86%, var(--color-bg-canvas) 14%);
    border: 1px solid var(--color-border-light);
    color: var(--color-text-tertiary);
  }

  .service-entry.is-active .service-entry__icon {
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-card) 88%);
    border-color: color-mix(in srgb, var(--color-primary) 22%, var(--color-border) 78%);
  }

  .service-entry__icon :deep(svg) {
    width: 16px;
    height: 16px;
  }

  .service-entry__body {
    min-width: 0;
    display: grid;
    gap: 3px;
  }

  .service-entry__title {
    font-size: 14px;
    font-weight: 650;
    line-height: 1.35;
  }

  .service-entry__desc {
    font-size: 12px;
    line-height: 1.45;
    color: var(--color-text-tertiary);
  }

  .self-service-content {
    min-width: 0;
  }

  .self-service-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-md);
    padding: 4px 0 12px;
    border-bottom: 1px solid var(--color-border-light);
  }

  .self-service-heading h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 650;
    line-height: 1.35;
    color: var(--color-text-primary);
  }

  .self-service-heading p {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.55;
    color: var(--color-text-secondary);
  }

  @media (max-width: 900px) {
    .self-service-layout {
      grid-template-columns: 1fr;
    }

    .self-service-nav {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .self-service-nav {
      grid-template-columns: 1fr;
    }

    .self-service-heading {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
