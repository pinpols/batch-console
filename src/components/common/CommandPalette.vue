<template>
  <el-dialog
    v-model="open"
    class="command-palette"
    :show-close="false"
    width="640px"
    append-to-body
    :close-on-click-modal="true"
    @closed="onClosed"
    @opened="onOpened"
  >
    <!-- 设计稿直出(cmdk 样张):⌘ 搜索行 + ESC 徽标 / 蓝点行 + 右侧组名 / 底部快捷键条 -->
    <template #header>
      <div class="cp-header">
        <span class="cp-header__cmd" aria-hidden="true">⌘</span>
        <input
          ref="inputRef"
          v-model="q"
          class="cp-header__input"
          :placeholder="t('palette.placeholder')"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="goActive()"
        />
        <span v-if="entityLoading" class="cp-kbd cp-kbd--loading">{{
          t('palette.searching')
        }}</span>
        <span v-else class="cp-kbd">ESC</span>
      </div>
    </template>

    <div class="cp-body" role="listbox">
      <div v-if="!flatItems.length" class="cp-empty">{{ t('palette.empty') }}</div>
      <button
        v-for="it in flatItems"
        v-else
        :key="it.key"
        type="button"
        class="cp-item"
        :class="{ 'is-active': activeIndex === it.globalIndex }"
        role="option"
        @mousemove="activeIndex = it.globalIndex"
        @click="go(it)"
      >
        <span class="cp-item__dot" aria-hidden="true" />
        <span class="cp-item__title">{{ it.title }}</span>
        <span class="cp-item__meta">{{ it.subtitle || it.meta }}</span>
      </button>
    </div>

    <template #footer>
      <div class="cp-foot">
        <span>↵ {{ t('palette.footOpen') }}</span>
        <span>⌘K {{ t('palette.footToggle') }}</span>
        <span>ESC {{ t('palette.footClose') }}</span>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import type { Component } from 'vue'
  import type { NavigationGroup } from '@/constants/navigation'
  import type { PageTab } from '@/stores/tabs'
  import { pathToKey } from '@/constants/pathKey'
  import { instanceApi } from '@/api/instance'
  import { workflowApi } from '@/api/workflow'
  import { useTenantStore } from '@/stores/tenant'
  import type {
    ConsoleJobInstanceResponse,
    ConsoleWorkflowDefinitionResponse,
  } from '@/types/console-api'

  const { t, te } = useI18n({ useScope: 'global' })

  function resolvePageTitle(path: string, fallback: string): string {
    const key = `page.${pathToKey(path)}.title`
    return te(key) ? t(key) : fallback
  }

  type PaletteSource = 'recent' | 'menu' | 'jump' | 'entity'

  type PaletteItem = {
    key: string
    title: string
    subtitle?: string
    meta: string
    path: string
    icon?: Component
    source: PaletteSource
    globalIndex: number
  }

  const props = defineProps<{
    modelValue: boolean
    groups: NavigationGroup[]
    recentTabs: PageTab[]
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', v: boolean): void
  }>()

  const router = useRouter()
  const tenant = useTenantStore()

  // ─── 实体匹配(BE 服务端搜) ─────────────────────────────
  // 触发条件:term 长度 ≥ 2,不是纯数字/纯 hex(那些已走 jump 项)。
  // BE 支持 jobCode partial / workflowCode partial 过滤,我们各拉 5 条。
  const entityJobInstances = ref<ConsoleJobInstanceResponse[]>([])
  const entityWorkflowDefs = ref<ConsoleWorkflowDefinitionResponse[]>([])
  const entityLoading = ref(false)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let activeSearchGen = 0

  function shouldSearchEntity(term: string) {
    if (term.length < 2) return false
    if (/^\d+$/.test(term)) return false // 纯数字走 jumpItems
    if (/^[a-f0-9]{16,64}$/i.test(term)) return false // traceId 走 jumpItems
    return true
  }

  async function searchEntities(term: string) {
    // 空租户保护:启动阶段 / 未选租户 / 租户切换瞬间不发空 tenantId 查询
    if (!shouldSearchEntity(term) || !tenant.tenantId) {
      entityJobInstances.value = []
      entityWorkflowDefs.value = []
      return
    }
    activeSearchGen += 1
    const myGen = activeSearchGen
    entityLoading.value = true
    try {
      const [jobs, wfs] = await Promise.all([
        instanceApi
          .list({ tenantId: tenant.tenantId, jobCode: term, page: 1, pageSize: 5 })
          .catch(() => ({ records: [] as ConsoleJobInstanceResponse[] })),
        workflowApi
          .listDefinitions({
            tenantId: tenant.tenantId,
            workflowCode: term,
            page: 1,
            pageSize: 5,
          })
          .catch(() => ({ records: [] as ConsoleWorkflowDefinitionResponse[] })),
      ])
      // 防止快速输入时旧请求覆盖新结果
      if (myGen !== activeSearchGen) return
      entityJobInstances.value = (jobs.records ?? []).slice(0, 5)
      entityWorkflowDefs.value = (wfs.records ?? []).slice(0, 5)
    } finally {
      if (myGen === activeSearchGen) entityLoading.value = false
    }
  }

  function scheduleEntitySearch(term: string) {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void searchEntities(term)
    }, 300)
  }

  onBeforeUnmount(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
  })

  const open = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v),
  })

  const inputRef = ref<{ focus: () => void } | null>(null)
  const q = ref('')
  const activeIndex = ref(0)

  const recentItems = computed((): Omit<PaletteItem, 'globalIndex'>[] => {
    const sorted = [...props.recentTabs].sort(
      (a, b) => (b.lastAccessAt ?? 0) - (a.lastAccessAt ?? 0),
    )
    return sorted.slice(0, 8).map((tab) => ({
      key: `recent:${tab.key}`,
      title: resolvePageTitle(tab.path, tab.title),
      subtitle: tab.path,
      meta: t('palette.metaRecent'),
      path: tab.path,
      source: 'recent' as const,
    }))
  })

  const menuItems = computed((): Omit<PaletteItem, 'globalIndex'>[] => {
    const out: Omit<PaletteItem, 'globalIndex'>[] = []
    for (const g of props.groups) {
      for (const c of g.children) {
        const groupKey = `nav.group.${g.key}`
        out.push({
          key: `menu:${c.path}`,
          title: resolvePageTitle(c.path, c.title),
          subtitle: te(groupKey) ? t(groupKey) : g.title,
          meta: t('palette.metaMenu'),
          path: c.path,
          icon: c.icon,
          source: 'menu',
        })
      }
    }
    return out
  })

  const jumpItems = computed((): Omit<PaletteItem, 'globalIndex'>[] => {
    const term = q.value.trim()
    // 纯数字:跳 Job Instance
    if (/^\d+$/.test(term)) {
      return [
        {
          key: `jump:job:${term}`,
          title: t('palette.jumpJobInstance', { id: term }),
          subtitle: t('palette.jumpDetail'),
          meta: t('palette.metaJump'),
          path: `/monitor/job-instances/${term}`,
          source: 'jump' as const,
        },
      ]
    }
    // traceId 形态(32-64 位 16 进制):跳 Trace 诊断
    if (/^[a-f0-9]{16,64}$/i.test(term)) {
      return [
        {
          key: `jump:trace:${term}`,
          title: t('palette.jumpTrace', { trace: term.slice(0, 16) + '...' }),
          subtitle: t('palette.jumpTraceSubtitle'),
          meta: t('palette.metaJump'),
          path: `/observability/trace?traceId=${term}`,
          source: 'jump' as const,
        },
      ]
    }
    return []
  })

  const entityItems = computed((): Omit<PaletteItem, 'globalIndex'>[] => {
    const out: Omit<PaletteItem, 'globalIndex'>[] = []
    for (const inst of entityJobInstances.value) {
      out.push({
        key: `entity:job:${inst.id}`,
        title: inst.instanceNo,
        subtitle: `${inst.jobCode} · ${inst.bizDate || ''} · ${inst.instanceStatus}`,
        meta: t('palette.metaJob'),
        path: `/monitor/job-instances/${inst.id}`,
        source: 'entity' as const,
      })
    }
    for (const wf of entityWorkflowDefs.value) {
      out.push({
        key: `entity:wf:${wf.id}`,
        title: wf.workflowCode,
        subtitle: `${wf.workflowName || ''} · v${wf.version} · ${wf.enabled ? 'enabled' : 'disabled'}`,
        meta: t('palette.metaWorkflow'),
        path: `/workflow/definitions?workflowCode=${encodeURIComponent(wf.workflowCode)}`,
        source: 'entity' as const,
      })
    }
    return out
  })

  const flatItems = computed(() => {
    const rawTerm = q.value.trim()
    const term = rawTerm.toLowerCase()
    const base: Omit<PaletteItem, 'globalIndex'>[] = []

    const isJump = /^\d+$/.test(rawTerm) || /^[a-f0-9]{16,64}$/i.test(rawTerm)
    if (term && isJump) {
      base.push(...jumpItems.value, ...recentItems.value, ...menuItems.value)
    } else {
      // 实体匹配排在 menu 前面:用户搜 jobCode/workflowCode 时希望优先看到真实数据
      base.push(...entityItems.value, ...recentItems.value, ...menuItems.value)
    }

    const filtered = term
      ? base.filter((it) => {
          if ((/^\d+$/.test(rawTerm) || /^[a-f0-9]{16,64}$/i.test(rawTerm)) && it.source === 'jump')
            return true
          // 实体匹配项来自服务端搜索结果,本身就是命中,不再用 hay 二次过滤
          // (避免如 "wf-001" 因 path 不含全部字符被错杀)
          if (it.source === 'entity') return true
          const hay = `${it.title} ${it.subtitle ?? ''} ${it.path}`.toLowerCase()
          return hay.includes(term)
        })
      : base

    const seen = new Set<string>()
    const deduped = filtered.filter((it) => {
      const k = `${it.source}:${it.path}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })

    return deduped.map((it, i) => ({ ...it, globalIndex: i }) satisfies PaletteItem)
  })

  const sections = computed(() => {
    const jump = flatItems.value.filter((x) => x.source === 'jump')
    const entity = flatItems.value.filter((x) => x.source === 'entity')
    const rec = flatItems.value.filter((x) => x.source === 'recent')
    const menu = flatItems.value.filter((x) => x.source === 'menu')
    return [
      { key: 'jump', title: t('palette.sectionJump'), items: jump },
      { key: 'entity', title: t('palette.sectionEntity'), items: entity },
      { key: 'recent', title: t('palette.sectionRecent'), items: rec },
      { key: 'menu', title: t('palette.sectionMenu'), items: menu },
    ].filter((s) => s.items.length)
  })

  function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n))
  }

  function move(delta: number) {
    const len = flatItems.value.length
    if (!len) return
    activeIndex.value = clamp(activeIndex.value + delta, 0, len - 1)
  }

  function goActive() {
    const it = flatItems.value[activeIndex.value]
    if (it) go(it)
  }

  function go(it: PaletteItem) {
    void router.push(it.path)
    open.value = false
  }

  function onOpened() {
    nextTick(() => inputRef.value?.focus?.())
  }

  function onClosed() {
    q.value = ''
    activeIndex.value = 0
    entityJobInstances.value = []
    entityWorkflowDefs.value = []
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  watch(open, (v) => {
    if (v) activeIndex.value = 0
  })

  watch(flatItems, (list) => {
    activeIndex.value = clamp(activeIndex.value, 0, Math.max(0, list.length - 1))
  })

  watch(q, (term) => {
    activeIndex.value = 0
    scheduleEntitySearch(term.trim())
  })
</script>

<style scoped>
  /* 设计稿直出(cmdk 样张) */
  .cp-header {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .cp-header__cmd {
    font-size: 17px;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
  }

  .cp-header__input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    font-size: 15px;
    color: var(--color-text-primary);
    font-family: inherit;
  }

  .cp-header__input::placeholder {
    color: var(--color-text-tertiary);
  }

  .cp-kbd {
    flex-shrink: 0;
    padding: 4px 10px;
    border: 1px solid var(--color-border);
    border-radius: 7px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .cp-kbd--loading {
    color: var(--color-primary);
  }

  .cp-body {
    max-height: 430px;
    overflow-y: auto;
    padding: 4px 8px;
  }

  .cp-empty {
    padding: 44px 0;
    text-align: center;
    color: var(--color-text-tertiary);
    font-size: 13px;
  }

  .cp-item {
    display: flex;
    align-items: center;
    gap: 13px;
    width: 100%;
    height: 48px;
    padding: 0 14px;
    border: none;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    text-align: left;
  }

  .cp-item__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--color-primary);
    flex-shrink: 0;
  }

  .cp-item__title {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cp-item__meta {
    flex-shrink: 0;
    font-size: 13px;
    color: var(--color-text-tertiary);
  }

  .cp-item:hover,
  .cp-item.is-active {
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }

  .cp-item.is-active .cp-item__title {
    color: var(--color-primary);
  }

  .cp-foot {
    display: flex;
    align-items: center;
    gap: 20px;
    font-size: 12.5px;
    color: var(--color-text-tertiary);
  }
</style>

<style>
  .command-palette.el-dialog {
    padding: 0;
    border-radius: 14px;
    overflow: hidden;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-pop, 0 8px 24px rgba(0, 0, 0, 0.45));
  }

  .command-palette .el-dialog__header {
    margin: 0;
    padding: 18px 20px 14px;
    border-bottom: 1px solid var(--color-border-light);
  }

  .command-palette .el-dialog__headerbtn {
    display: none;
  }

  .command-palette .el-dialog__body {
    padding: 0 10px;
    overflow: hidden;
  }

  .command-palette .el-dialog__footer {
    margin: 0;
    padding: 12px 20px 14px;
    border-top: 1px solid var(--color-border-light);
  }
</style>
