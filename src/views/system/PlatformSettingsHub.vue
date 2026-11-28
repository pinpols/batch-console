<template>
  <PageContainer>
    <PageHeader />

    <SectionCard v-if="visibleCards.length > 0">
      <div class="settings-hub-grid">
        <article
          v-for="card in visibleCards"
          :key="card.path"
          class="settings-hub-card"
          role="button"
          tabindex="0"
          @click="openCard(card.path)"
          @keydown.enter.prevent="openCard(card.path)"
          @keydown.space.prevent="openCard(card.path)"
        >
          <span class="settings-hub-card__icon" aria-hidden="true">
            <el-icon><component :is="card.icon" /></el-icon>
          </span>
          <h3 class="settings-hub-card__title">{{ t(card.titleKey) }}</h3>
          <p class="settings-hub-card__desc">{{ t(card.descriptionKey) }}</p>
          <footer class="settings-hub-card__go">{{ t('platformSettingsHub.openEntry') }} →</footer>
        </article>
      </div>
    </SectionCard>

    <SectionCard v-else>
      <EmptyState :description="t('platformSettingsHub.emptyDescription')" />
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, type Component } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { Box, Coins, Settings, Tag, Wrench } from '@lucide/vue'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import { useRouteAccess } from '@/composables/useRouteAccess'

  interface SettingsHubCard {
    path: string
    titleKey: string
    descriptionKey: string
    icon: Component
  }

  const CARDS: readonly SettingsHubCard[] = [
    {
      path: '/system/parameters',
      titleKey: 'page.systemParameters.title',
      descriptionKey: 'page.systemParameters.description',
      icon: Settings,
    },
    {
      path: '/system/tags',
      titleKey: 'page.systemTags.title',
      descriptionKey: 'page.systemTags.description',
      icon: Tag,
    },
    {
      path: '/system/atomic-task-types',
      titleKey: 'page.systemAtomicTaskTypes.title',
      descriptionKey: 'page.systemAtomicTaskTypes.description',
      icon: Box,
    },
    {
      path: '/system/maintenance',
      titleKey: 'page.systemMaintenance.title',
      descriptionKey: 'page.systemMaintenance.description',
      icon: Wrench,
    },
    {
      path: '/ops/shard-catalog',
      titleKey: 'page.opsShardCatalog.title',
      descriptionKey: 'page.opsShardCatalog.description',
      icon: Coins,
    },
  ]

  const { t } = useI18n({ useScope: 'global' })
  const router = useRouter()
  const { canOpenPath } = useRouteAccess()

  // 卡片按原页面权限和后端菜单白名单过滤，无权角色看不到对应入口
  const visibleCards = computed(() => CARDS.filter((card) => canOpenPath(card.path)))

  function openCard(path: string) {
    void router.push(path)
  }
</script>

<style scoped>
  .settings-hub-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--space-md, 16px);
  }

  .settings-hub-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 18px;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-bg-card);
    box-shadow: var(--shadow-card);
    cursor: pointer;
    transition:
      transform var(--motion-duration-sm, 0.15s) var(--motion-ease-emphasized, ease),
      border-color var(--motion-duration-md, 0.2s) var(--motion-ease-standard, ease),
      box-shadow var(--motion-duration-md, 0.2s) var(--motion-ease-standard, ease);
  }

  .settings-hub-card:hover,
  .settings-hub-card:focus-visible {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--color-border) 70%, var(--color-primary) 30%);
    box-shadow: 0 8px 20px rgb(15 23 42 / 8%);
    outline: none;
  }

  .settings-hub-card__icon {
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  }

  .settings-hub-card__title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.35;
    color: var(--color-text-primary);
  }

  .settings-hub-card__desc {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .settings-hub-card__go {
    margin-top: auto;
    padding-top: 6px;
    font-size: 12px;
    color: var(--color-primary);
  }
</style>
