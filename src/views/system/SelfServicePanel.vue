<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button :icon="Document" @click="goMyApprovals">
          {{ t('selfServicePanel.headerMyApprovals') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <div class="service-catalog">
        <article
          v-for="card in cards"
          :key="card.key"
          class="service-card"
          :class="{ 'is-active': expandedKey === card.key }"
        >
          <header class="service-card__head">
            <span class="service-card__icon">
              <el-icon><component :is="card.icon" /></el-icon>
            </span>
            <div class="service-card__title">
              <h3>{{ card.title }}</h3>
              <p>{{ card.desc }}</p>
            </div>
          </header>

          <div class="service-card__meta">
            <el-tag size="small" effect="plain" :type="kindTagType(card.kind)">
              {{ kindLabel(card.kind) }}
            </el-tag>
            <el-tag
              v-if="card.kind === 'request' && card.approvalTypes.length"
              size="small"
              effect="plain"
              :type="pendingCount(card.approvalTypes) > 0 ? 'warning' : 'info'"
            >
              {{ pendingBadge(card.approvalTypes) }}
            </el-tag>
          </div>

          <footer class="service-card__action">
            <el-button
              type="primary"
              plain
              size="small"
              :icon="
                card.kind === 'view'
                  ? expandedKey === card.key
                    ? ArrowUp
                    : ArrowDown
                  : card.cta.icon
              "
              @click="onCardClick(card)"
            >
              {{ ctaLabel(card) }}
            </el-button>
          </footer>
        </article>
      </div>

      <!-- 内联展开:仅 quota(read-only)-->
      <el-collapse-transition>
        <div v-if="expandedKey === 'quota'" class="service-catalog__inline">
          <SelfServiceQuotaTab />
        </div>
      </el-collapse-transition>
    </SectionCard>

    <!-- Drawer:全部 view-drawer + request 类用同一个抽屉,destroy-on-close 确保数据/表单重置 -->
    <el-drawer
      v-model="drawerOpen"
      :title="drawerTitle"
      direction="rtl"
      size="600px"
      destroy-on-close
      @closed="onDrawerClosed"
    >
      <SelfServiceQuotaChangeTab v-if="drawerKey === 'quotaChange'" />
      <SelfServiceRerunTab v-else-if="drawerKey === 'rerun'" />
      <SelfServiceCompensationTab v-else-if="drawerKey === 'compensation'" />
      <SelfServiceFailedJobsTab v-else-if="drawerKey === 'failedJobs'" />
      <SelfServiceNotifSubsTab v-else-if="drawerKey === 'notifSubs'" />
      <SelfServiceMyAuditsTab v-else-if="drawerKey === 'myAudits'" />
      <SelfServiceTriggerPauseTab v-else-if="drawerKey === 'triggerPause'" />
    </el-drawer>
  </PageContainer>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch, type Component } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import {
    ChevronDown as ArrowDown,
    ChevronUp as ArrowUp,
    Bell,
    BarChart3 as DataAnalysis,
    FileText as Document,
    PencilLine as EditPen,
    KeyRound as Key,
    ClipboardList as Memo,
    RotateCw as RefreshRight,
    Settings2 as SetUp,
    Timer,
    TriangleAlert as Warning,
  } from 'lucide-vue-next'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import SelfServiceQuotaTab from './components/SelfServiceQuotaTab.vue'
  import SelfServiceQuotaChangeTab from './components/SelfServiceQuotaChangeTab.vue'
  import SelfServiceRerunTab from './components/SelfServiceRerunTab.vue'
  import SelfServiceCompensationTab from './components/SelfServiceCompensationTab.vue'
  import SelfServiceFailedJobsTab from './components/SelfServiceFailedJobsTab.vue'
  import SelfServiceNotifSubsTab from './components/SelfServiceNotifSubsTab.vue'
  import SelfServiceMyAuditsTab from './components/SelfServiceMyAuditsTab.vue'
  import SelfServiceTriggerPauseTab from './components/SelfServiceTriggerPauseTab.vue'
  import { useTenantStore } from '@/stores/tenant'
  import { useAuthStore } from '@/stores/auth'
  import { useTenantReload } from '@/composables/useTenantReload'
  import { useDrawerAutoClose } from '@/composables/useDrawerAutoClose'
  import { queryApprovals } from '@/api/approvals'

  const { t } = useI18n({ useScope: 'global' })
  const route = useRoute()
  const router = useRouter()
  const tenant = useTenantStore()
  const auth = useAuthStore()

  /**
   * 卡片类型:
   * - view:点击 inline expand,只有 quota 用这个
   * - view-drawer:点击打开 drawer 显示只读列表(failedJobs / myAudits / notifSubs)
   * - request:点击打开 drawer 提交申请表单(quotaChange / rerun / compensation / triggerPause)
   * - link-out:点击 router.push 到其他路由(apiKey)
   */
  type CardKind = 'view' | 'view-drawer' | 'request' | 'link-out'
  type CardKey =
    | 'quota'
    | 'quotaChange'
    | 'rerun'
    | 'compensation'
    | 'apiKey'
    | 'failedJobs'
    | 'notifSubs'
    | 'myAudits'
    | 'triggerPause'

  interface ServiceCard {
    key: CardKey
    icon: Component
    title: string
    desc: string
    kind: CardKind
    approvalTypes: string[]
    cta: { icon: Component; label: string }
    linkTo?: string
  }

  const cards = computed<ServiceCard[]>(() => [
    // --- 原 4 张 ---
    {
      key: 'quota',
      icon: DataAnalysis,
      title: t('selfServicePanel.tabQuota'),
      desc: t('selfServicePanel.descQuota'),
      kind: 'view',
      approvalTypes: [],
      cta: { icon: ArrowDown, label: t('selfServicePanel.cardCtaView') },
    },
    {
      key: 'quotaChange',
      icon: EditPen,
      title: t('selfServicePanel.tabQuotaChange'),
      desc: t('selfServicePanel.descQuotaChange'),
      kind: 'request',
      approvalTypes: ['QUOTA_CHANGE', 'TENANT_QUOTA_CHANGE'],
      cta: { icon: EditPen, label: t('selfServicePanel.cardCtaRequest') },
    },
    {
      key: 'rerun',
      icon: RefreshRight,
      title: t('selfServicePanel.tabRerun'),
      desc: t('selfServicePanel.descRerun'),
      kind: 'request',
      approvalTypes: ['JOB_RERUN', 'RERUN'],
      cta: { icon: RefreshRight, label: t('selfServicePanel.cardCtaRequest') },
    },
    {
      key: 'compensation',
      icon: SetUp,
      title: t('selfServicePanel.tabCompensation'),
      desc: t('selfServicePanel.descCompensation'),
      kind: 'request',
      approvalTypes: ['COMPENSATION', 'DATA_COMPENSATION'],
      cta: { icon: SetUp, label: t('selfServicePanel.cardCtaRequest') },
    },
    // --- 第二批 5 张 ---
    {
      key: 'apiKey',
      icon: Key,
      title: t('selfServicePanel.tabApiKey'),
      desc: t('selfServicePanel.descApiKey'),
      kind: 'link-out',
      approvalTypes: [],
      cta: { icon: Key, label: t('selfServicePanel.cardCtaApiKey') },
      linkTo: '/system/api-keys',
    },
    {
      key: 'failedJobs',
      icon: Warning,
      title: t('selfServicePanel.tabFailedJobs'),
      desc: t('selfServicePanel.descFailedJobs'),
      kind: 'view-drawer',
      approvalTypes: [],
      cta: { icon: Warning, label: t('selfServicePanel.cardCtaFailedJobs') },
    },
    {
      key: 'notifSubs',
      icon: Bell,
      title: t('selfServicePanel.tabNotifSubs'),
      desc: t('selfServicePanel.descNotifSubs'),
      kind: 'view-drawer',
      approvalTypes: [],
      cta: { icon: Bell, label: t('selfServicePanel.cardCtaNotifSubs') },
    },
    {
      key: 'myAudits',
      icon: Memo,
      title: t('selfServicePanel.tabMyAudits'),
      desc: t('selfServicePanel.descMyAudits'),
      kind: 'view-drawer',
      approvalTypes: [],
      cta: { icon: Memo, label: t('selfServicePanel.cardCtaMyAudits') },
    },
    {
      key: 'triggerPause',
      icon: Timer,
      title: t('selfServicePanel.tabTriggerPause'),
      desc: t('selfServicePanel.descTriggerPause'),
      kind: 'request',
      approvalTypes: [],
      cta: { icon: Timer, label: t('selfServicePanel.cardCtaTriggerPause') },
    },
  ])

  function kindTagType(kind: CardKind): 'info' | 'primary' | 'success' | 'warning' {
    if (kind === 'view' || kind === 'view-drawer') return 'info'
    if (kind === 'link-out') return 'success'
    return 'primary'
  }

  function kindLabel(kind: CardKind): string {
    if (kind === 'view' || kind === 'view-drawer') return t('selfServicePanel.badgeView')
    if (kind === 'link-out') return t('selfServicePanel.badgeView')
    return t('selfServicePanel.badgeRequest')
  }

  function ctaLabel(card: ServiceCard): string {
    if (card.kind === 'view') {
      return expandedKey.value === card.key ? t('selfServicePanel.cardCtaCollapse') : card.cta.label
    }
    return card.cta.label
  }

  // 内联展开(只有 quota 用)
  const expandedKey = ref<CardKey | null>(null)

  // Drawer
  const drawerOpen = ref(false)
  useDrawerAutoClose(drawerOpen)
  const drawerKey = ref<CardKey | null>(null)
  const drawerTitle = computed(() => {
    switch (drawerKey.value) {
      case 'quotaChange':
        return t('selfServicePanel.drawerTitleQuotaChange')
      case 'rerun':
        return t('selfServicePanel.drawerTitleRerun')
      case 'compensation':
        return t('selfServicePanel.drawerTitleCompensation')
      case 'failedJobs':
        return t('selfServicePanel.drawerTitleFailedJobs')
      case 'notifSubs':
        return t('selfServicePanel.drawerTitleNotifSubs')
      case 'myAudits':
        return t('selfServicePanel.drawerTitleMyAudits')
      case 'triggerPause':
        return t('selfServicePanel.drawerTitleTriggerPause')
      default:
        return ''
    }
  })

  function onCardClick(card: ServiceCard) {
    if (card.kind === 'view') {
      expandedKey.value = expandedKey.value === card.key ? null : card.key
      return
    }
    if (card.kind === 'link-out' && card.linkTo) {
      void router.push({ path: card.linkTo })
      return
    }
    // request 或 view-drawer
    drawerKey.value = card.key
    drawerOpen.value = true
    void router.replace({ query: { ...route.query, action: card.key } })
  }

  function onDrawerClosed() {
    drawerKey.value = null
    const q = { ...route.query }
    delete q.action
    delete q.jobCode
    delete q.bizDate
    void router.replace({ query: q })
    // 关闭 drawer 后顺手刷新一次徽章(用户可能刚提交单)
    void loadPendingCounts()
  }

  function goMyApprovals() {
    void router.push({ path: '/approvals', query: { requester: 'me' } })
  }

  // ---------- 待审批徽章 ----------

  const pendingByType = ref<Record<string, number>>({})

  function pendingCount(types: string[]): number {
    return types.reduce((n, k) => n + (pendingByType.value[k] ?? 0), 0)
  }

  function pendingBadge(types: string[]): string {
    const n = pendingCount(types)
    return n > 0 ? t('selfServicePanel.badgePending', { n }) : t('selfServicePanel.badgeNoPending')
  }

  async function loadPendingCounts() {
    if (!tenant.tenantId) return
    try {
      const items = await queryApprovals(tenant.tenantId)
      const me = auth.userInfo?.userId
      const counts: Record<string, number> = {}
      for (const it of items ?? []) {
        if (it.approvalStatus !== 'PENDING') continue
        if (me && it.requesterId && it.requesterId !== me) continue
        counts[it.approvalType] = (counts[it.approvalType] ?? 0) + 1
      }
      pendingByType.value = counts
    } catch {
      pendingByType.value = {}
    }
  }

  // ---------- 深链 ?action=xxx 直接开 drawer ----------

  function syncFromRoute() {
    const a = route.query.action as CardKey | undefined
    const drawerCards: CardKey[] = [
      'quotaChange',
      'rerun',
      'compensation',
      'failedJobs',
      'notifSubs',
      'myAudits',
      'triggerPause',
    ]
    if (a && drawerCards.includes(a)) {
      drawerKey.value = a
      drawerOpen.value = true
    }
  }

  onMounted(() => {
    syncFromRoute()
    void loadPendingCounts()
  })

  watch(() => route.query.action, syncFromRoute)
  useTenantReload(() => {
    void loadPendingCounts()
  })
</script>

<style scoped>
  .service-catalog {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--space-md);
  }

  .service-card {
    display: grid;
    grid-template-rows: auto auto 1fr;
    gap: 12px;
    padding: 16px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
    transition:
      transform var(--motion-duration-sm) var(--motion-ease-emphasized),
      border-color var(--motion-duration-md) var(--motion-ease-standard),
      box-shadow var(--motion-duration-md) var(--motion-ease-standard);
  }

  .service-card:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--color-border) 75%, var(--color-primary) 25%);
    box-shadow: 0 8px 20px rgb(15 23 42 / 8%);
  }

  .service-card.is-active {
    border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border) 65%);
    background: color-mix(in srgb, var(--color-primary) 5%, var(--color-bg-card) 95%);
  }

  .service-card__head {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .service-card__icon {
    flex: 0 0 auto;
    width: 38px;
    height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-input);
    background: color-mix(in srgb, var(--color-primary) 12%, var(--color-bg-card) 88%);
    border: 1px solid color-mix(in srgb, var(--color-primary) 22%, var(--color-border) 78%);
    color: var(--color-primary);
  }

  .service-card__icon :deep(svg) {
    width: 18px;
    height: 18px;
  }

  .service-card__title {
    min-width: 0;
    flex: 1;
  }

  .service-card__title h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 650;
    line-height: 1.35;
    color: var(--color-text-primary);
  }

  .service-card__title p {
    margin: 4px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }

  .service-card__meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .service-card__action {
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
  }

  .service-catalog__inline {
    margin-top: var(--page-section-gap);
    padding-top: var(--page-section-gap);
    border-top: 1px dashed var(--color-border-light);
  }

  @media (max-width: 640px) {
    .service-catalog {
      grid-template-columns: 1fr;
    }
  }
</style>
