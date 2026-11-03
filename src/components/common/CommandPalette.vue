<template>
  <el-dialog
    v-model="open"
    class="command-palette"
    :show-close="false"
    width="min(640px, calc(100vw - 32px))"
    append-to-body
    :close-on-click-modal="true"
    @closed="onClosed"
    @opened="onOpened"
  >
    <!-- 设计稿直出(cmdk 样张):⌘ 搜索行 + ESC 徽标 / 蓝点行 + 右侧组名 / 底部快捷键条 -->
    <template #header>
      <div class="cp-header">
        <span class="cp-header__cmd" aria-hidden="true">{{
          shortcutLabel === '⌘K' ? '⌘' : 'Ctrl'
        }}</span>
        <input
          ref="inputRef"
          v-model="q"
          class="cp-header__input"
          role="combobox"
          :aria-label="t('palette.placeholder')"
          aria-autocomplete="list"
          aria-controls="command-palette-results"
          :aria-expanded="open"
          :aria-activedescendant="
            flatItems.length ? `command-palette-option-${activeIndex}` : undefined
          "
          :placeholder="t('palette.placeholder')"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="goActive()"
        />
        <span v-if="entityLoading" class="cp-kbd cp-kbd--loading">{{
          t('palette.searching')
        }}</span>
        <button
          type="button"
          class="cp-filter"
          :class="{ 'is-active': hiddenOnly }"
          :aria-label="t('palette.sidebarHiddenOnly')"
          :title="t('palette.sidebarHiddenOnly')"
          :aria-pressed="hiddenOnly"
          @click="hiddenOnly = !hiddenOnly"
        >
          <el-icon aria-hidden="true"><Hide /></el-icon>
        </button>
        <button
          type="button"
          class="cp-kbd cp-kbd--close"
          :aria-label="t('palette.footClose')"
          @click="open = false"
        >
          ESC
        </button>
      </div>
    </template>

    <div id="command-palette-results" ref="resultsRef" class="cp-body" role="listbox">
      <div v-if="!flatItems.length" class="cp-empty">{{ t('palette.empty') }}</div>
      <div v-for="section in sections" :key="section.key" role="group" :aria-label="section.title">
        <div class="cp-section">{{ section.title }}</div>
        <button
          v-for="it in section.items"
          :id="`command-palette-option-${it.globalIndex}`"
          :key="it.key"
          type="button"
          class="cp-item"
          :class="{ 'is-active': activeIndex === it.globalIndex }"
          role="option"
          tabindex="-1"
          :aria-selected="activeIndex === it.globalIndex"
          @mousemove="activeIndex = it.globalIndex"
          @click="go(it)"
        >
          <span class="cp-item__dot" aria-hidden="true" />
          <span class="cp-item__title">{{ it.title }}</span>
          <span
            v-if="it.sidebarHidden"
            class="cp-item__hidden"
            role="img"
            :aria-label="t('palette.sidebarHidden')"
            :title="t('palette.sidebarHidden')"
            ><el-icon aria-hidden="true"><Hide /></el-icon
          ></span>
          <span class="cp-item__meta">{{ it.subtitle || it.meta }}</span>
        </button>
      </div>
    </div>

    <template #footer>
      <div class="cp-foot">
        <span>↵ {{ t('palette.footOpen') }}</span>
        <span>{{ shortcutLabel }} {{ t('palette.footToggle') }}</span>
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
  import { Hide } from '@element-plus/icons-vue'
  import {
    navigationGroups,
    navigationItemTitleKey,
    type NavigationGroup,
  } from '@/constants/navigation'
  import type { PageTab } from '@/stores/tabs'
  import { pageTitleKey } from '@/constants/pageMeta'
  import { instanceApi } from '@/api/instance'
  import { workflowApi } from '@/api/workflow'
  import { fileApi } from '@/api/file'
  import { useTenantStore } from '@/stores/tenant'
  import { usePermissionStore } from '@/stores/permission'
  import { useAuthStore } from '@/stores/auth'
  import type { Role } from '@/types'
  import { parseCommandPaletteJump } from './commandPaletteJumps'
  import type {
    ConsoleFileRecordResponse,
    ConsoleJobInstanceResponse,
    ConsoleWorkflowDefinitionResponse,
  } from '@/types/console-api'

  const { t, te } = useI18n({ useScope: 'global' })

  function statusLabel(category: 'instanceStatus' | 'fileStatus', value?: string | null): string {
    if (!value) return '—'
    const key = `enum.${category}.${value}`
    return te(key) ? t(key) : value
  }

  function resolvePageTitle(path: string, fallback: string): string {
    const key = pageTitleKey(path)
    return te(key) ? t(key) : fallback
  }

  const sidebarHiddenPaths = new Set(
    navigationGroups.flatMap((group) =>
      group.children.filter((item) => item.hidden).map((item) => item.path.split('?')[0]),
    ),
  )

  function isSidebarHiddenPath(path: string): boolean {
    const normalizedPath = displayPath(path)
    return sidebarHiddenPaths.has(normalizedPath)
  }

  function displayPath(path: string): string {
    return path.split(/[?#]/, 1)[0] || path
  }

  type PaletteSource = 'recent' | 'menu' | 'jump' | 'entity'

  type PaletteItem = {
    key: string
    title: string
    subtitle?: string
    searchText?: string
    meta: string
    path: string
    icon?: Component
    sidebarHidden?: boolean
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
  const permission = usePermissionStore()
  const auth = useAuthStore()
  const shortcutLabel = /Mac|iPhone|iPod|iPad/i.test(navigator.platform ?? '') ? '⌘K' : 'Ctrl+K'
  const permittedPaths = computed(
    () =>
      new Set(
        props.groups.flatMap((group) => group.children.map((item) => displayPath(item.path))),
      ),
  )

  function canOpenPath(path: string): boolean {
    const target = router.resolve(path)
    if (!target.matched.length || target.name === 'not-found') return false
    const meta = target.meta
    if (meta.minRole && !permission.canAccessRole(meta.minRole as Role)) return false
    if (meta.permissions && !permission.canAccessPermissions(meta.permissions as string[]))
      return false
    if (
      meta.capabilities &&
      !(meta.capabilities as string[]).some((value) => auth.hasCapability(value))
    )
      return false
    if (
      target.path === '/system/me' ||
      target.path === '/system/users' ||
      target.path.startsWith('/m/')
    )
      return true
    if (target.path === '/system/ai-chat' && auth.hasCapability('AI_ASSISTANT_USE')) return true
    const candidates = [
      String(meta.activeMenu || target.path),
      ...((meta.menuAccessFallbacks as string[] | undefined) ?? []),
    ]
    return candidates.some((candidate) => permittedPaths.value.has(displayPath(candidate)))
  }

  // ─── 实体匹配(BE 服务端搜) ─────────────────────────────
  // 触发条件:term 长度 ≥ 2,不是纯数字/纯 hex(那些已走 jump 项)。
  // BE 支持 jobCode partial / workflowCode partial 过滤,我们各拉 5 条。
  const entityJobInstances = ref<ConsoleJobInstanceResponse[]>([])
  const entityWorkflowDefs = ref<ConsoleWorkflowDefinitionResponse[]>([])
  const entityFiles = ref<ConsoleFileRecordResponse[]>([])
  const entityLoading = ref(false)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let activeSearchGen = 0

  function shouldSearchEntity(term: string) {
    if (term.length < 2) return false
    if (parseCommandPaletteJump(term)) return false
    return true
  }

  function invalidateSearch() {
    activeSearchGen += 1
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = null
    entityJobInstances.value = []
    entityWorkflowDefs.value = []
    entityFiles.value = []
    entityLoading.value = false
  }

  async function searchEntities(term: string, tenantId: string, generation: number) {
    entityLoading.value = true
    try {
      const [jobs, wfs, files] = await Promise.all([
        canOpenPath('/monitor/job-instances')
          ? instanceApi
              .list({ tenantId, jobCode: term, page: 1, pageSize: 5 })
              .catch(() => ({ records: [] as ConsoleJobInstanceResponse[] }))
          : Promise.resolve({ records: [] as ConsoleJobInstanceResponse[] }),
        canOpenPath('/workflow/definitions')
          ? workflowApi
              .listDefinitions({ tenantId, workflowCode: term, page: 1, pageSize: 5 })
              .catch(() => ({ records: [] as ConsoleWorkflowDefinitionResponse[] }))
          : Promise.resolve({ records: [] as ConsoleWorkflowDefinitionResponse[] }),
        canOpenPath('/files/list')
          ? fileApi
              .list({ tenantId, fileName: term, page: 1, pageSize: 5 })
              .catch(() => ({ records: [] as ConsoleFileRecordResponse[] }))
          : Promise.resolve({ records: [] as ConsoleFileRecordResponse[] }),
      ])
      if (generation !== activeSearchGen) return
      entityJobInstances.value = (jobs.records ?? []).slice(0, 5)
      entityWorkflowDefs.value = (wfs.records ?? []).slice(0, 5)
      entityFiles.value = (files.records ?? []).slice(0, 5)
    } finally {
      if (generation === activeSearchGen) entityLoading.value = false
    }
  }

  onBeforeUnmount(invalidateSearch)

  const open = computed({
    get: () => props.modelValue,
    set: (v) => emit('update:modelValue', v),
  })

  const inputRef = ref<{ focus: () => void } | null>(null)
  const resultsRef = ref<HTMLElement | null>(null)
  const q = ref('')
  const hiddenOnly = ref(false)
  const activeIndex = ref(0)

  const recentItems = computed((): Omit<PaletteItem, 'globalIndex'>[] => {
    const sorted = props.recentTabs
      .filter((tab) => canOpenPath(tab.path))
      .sort((a, b) => (b.lastAccessAt ?? 0) - (a.lastAccessAt ?? 0))
    return sorted.slice(0, 8).map((tab) => {
      const key = `recent:${tab.key}`
      const titlePath = displayPath(tab.path)
      const title = resolvePageTitle(titlePath, tab.title)
      return {
        key,
        title,
        subtitle: displayPath(tab.path),
        meta: t('palette.metaRecent'),
        path: tab.path,
        sidebarHidden: isSidebarHiddenPath(tab.path),
        source: 'recent' as const,
      }
    })
  })

  const menuItems = computed((): Omit<PaletteItem, 'globalIndex'>[] => {
    const out: Omit<PaletteItem, 'globalIndex'>[] = []
    for (const g of props.groups) {
      for (const c of g.children) {
        const groupKey = `nav.group.${g.key}`
        const titleKey = navigationItemTitleKey(c)
        out.push({
          key: `menu:${c.path}`,
          title: te(titleKey) ? t(titleKey) : c.title,
          searchText: `${c.title} ${resolvePageTitle(c.path, c.title)}`,
          subtitle: te(groupKey) ? t(groupKey) : g.title,
          meta: t('palette.metaMenu'),
          path: c.path,
          icon: c.icon,
          sidebarHidden: isSidebarHiddenPath(c.path),
          source: 'menu',
        })
      }
    }
    return out
  })

  const jumpItems = computed((): Omit<PaletteItem, 'globalIndex'>[] => {
    const term = q.value.trim()
    const jump = parseCommandPaletteJump(term)
    if (!jump || !canOpenPath(jump.path)) return []
    const titleKey =
      jump.kind === 'job'
        ? 'palette.jumpJobInstance'
        : jump.kind === 'file'
          ? 'palette.jumpFile'
          : 'palette.jumpTrace'
    const traceForTitle = jump.value.length > 16 ? `${jump.value.slice(0, 16)}...` : jump.value
    return [
      {
        key: `jump:${jump.kind}:${jump.value}`,
        title: t(titleKey, {
          id: jump.value,
          trace: traceForTitle,
        }),
        subtitle: jump.kind === 'trace' ? t('palette.jumpTraceSubtitle') : t('palette.jumpDetail'),
        meta: t('palette.metaJump'),
        path: jump.path,
        source: 'jump' as const,
      },
    ]
  })

  const entityItems = computed((): Omit<PaletteItem, 'globalIndex'>[] => {
    const out: Omit<PaletteItem, 'globalIndex'>[] = []
    for (const inst of entityJobInstances.value) {
      out.push({
        key: `entity:job:${inst.id}`,
        title: inst.instanceNo,
        subtitle: `${inst.jobCode} · ${inst.bizDate || ''} · ${statusLabel('instanceStatus', inst.instanceStatus)}`,
        meta: t('palette.metaJob'),
        path: `/monitor/job-instances/${inst.id}`,
        source: 'entity' as const,
      })
    }
    for (const wf of entityWorkflowDefs.value) {
      out.push({
        key: `entity:wf:${wf.id}`,
        title: wf.workflowCode,
        subtitle: `${wf.workflowName || ''} · v${wf.version} · ${wf.enabled ? t('common.enabled') : t('common.disabled')}`,
        meta: t('palette.metaWorkflow'),
        path: `/workflow/definitions?workflowCode=${encodeURIComponent(wf.workflowCode)}`,
        source: 'entity' as const,
      })
    }
    for (const file of entityFiles.value) {
      out.push({
        key: `entity:file:${file.id}`,
        title: file.fileName || String(file.id),
        subtitle: `${file.bizType || '—'} · ${statusLabel('fileStatus', file.fileStatus)} · #${file.id}`,
        meta: t('palette.metaFile'),
        path: `/files/list?fileId=${file.id}`,
        source: 'entity' as const,
      })
    }
    return out
  })

  const flatItems = computed(() => {
    const rawTerm = q.value.trim()
    const term = rawTerm.toLowerCase()
    const base: Omit<PaletteItem, 'globalIndex'>[] = []

    const isJump = Boolean(parseCommandPaletteJump(rawTerm))
    if (term && isJump) {
      base.push(...jumpItems.value, ...recentItems.value, ...menuItems.value)
    } else {
      // 实体匹配排在 menu 前面:用户搜 jobCode/workflowCode 时希望优先看到真实数据
      base.push(...entityItems.value, ...recentItems.value, ...menuItems.value)
    }

    const scoped = hiddenOnly.value ? base.filter((it) => it.sidebarHidden) : base
    const filtered = term
      ? scoped.filter((it) => {
          if (isJump && it.source === 'jump') return true
          // 实体匹配项来自服务端搜索结果,本身就是命中,不再用 hay 二次过滤
          // (避免如 "wf-001" 因 path 不含全部字符被错杀)
          if (it.source === 'entity') return true
          const hay =
            `${it.title} ${it.subtitle ?? ''} ${it.searchText ?? ''} ${it.path}`.toLowerCase()
          return hay.includes(term)
        })
      : scoped

    const seen = new Set<string>()
    const deduped = filtered.filter((it) => {
      const k =
        it.source === 'recent' || it.source === 'menu'
          ? `page:${displayPath(it.path)}`
          : `${it.source}:${it.path}`
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
    if (open.value) return
    q.value = ''
    hiddenOnly.value = false
    activeIndex.value = 0
    invalidateSearch()
  }

  watch(
    [
      open,
      q,
      hiddenOnly,
      () => tenant.tenantId,
      () => [...permittedPaths.value].sort().join('|'),
      () => auth.userInfo,
    ],
    ([isOpen, term, onlyHidden, tenantId]) => {
      activeIndex.value = 0
      invalidateSearch()
      if (!isOpen || onlyHidden || !tenantId || !shouldSearchEntity(term.trim())) return
      const generation = activeSearchGen
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        void searchEntities(term.trim(), tenantId, generation)
      }, 300)
    },
    { flush: 'sync' },
  )

  watch(flatItems, (list) => {
    activeIndex.value = clamp(activeIndex.value, 0, Math.max(0, list.length - 1))
  })

  watch(activeIndex, (index) => {
    nextTick(() =>
      resultsRef.value
        ?.querySelector(`#command-palette-option-${index}`)
        ?.scrollIntoView?.({ block: 'nearest' }),
    )
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

  .cp-filter {
    display: inline-flex;
    width: 28px;
    height: 28px;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-secondary);
    font: inherit;
    font-size: 16px;
    cursor: pointer;
  }

  .cp-filter.is-active {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    color: var(--color-primary);
  }

  .cp-filter:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
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

  .cp-kbd--close {
    background: transparent;
    cursor: pointer;
  }

  .cp-kbd--loading {
    max-width: 30%;
    overflow: hidden;
    color: var(--color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 420px) {
    .cp-header {
      gap: 8px;
    }
  }

  .cp-body {
    max-height: 430px;
    overflow-y: auto;
    padding: 4px 8px;
  }

  .cp-section {
    padding: 10px 14px 4px;
    color: var(--color-text-tertiary);
    font-size: 12px;
    font-weight: 600;
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
    min-height: 48px;
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

  .cp-item__hidden {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--color-text-secondary);
    font-size: 15px;
  }

  .cp-item__meta {
    max-width: 44%;
    min-width: 0;
    flex-shrink: 0;
    font-size: 13px;
    color: var(--color-text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    max-width: calc(100vw - 32px);
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
