<template>
  <el-dialog
    v-model="open"
    class="command-palette"
    :show-close="false"
    width="560px"
    append-to-body
    :close-on-click-modal="true"
    @closed="onClosed"
    @opened="onOpened"
  >
    <template #header>
      <div class="cp-header">
        <el-input
          ref="inputRef"
          v-model="q"
          placeholder="搜索菜单、最近页面；纯数字可跳 Job 实例详情"
          clearable
          :prefix-icon="Search"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="goActive()"
        />
        <span class="cp-kbd">⌘/Ctrl + K</span>
      </div>
    </template>

    <div class="cp-body">
      <div v-if="!flatItems.length" class="cp-empty">无匹配结果</div>
      <div v-for="section in sections" v-else :key="section.key" class="cp-section">
        <div class="cp-section__title">{{ section.title }}</div>
        <div class="cp-list" role="listbox">
          <button
            v-for="it in section.items"
            :key="it.key"
            type="button"
            class="cp-item"
            :class="{ 'is-active': activeIndex === it.globalIndex }"
            role="option"
            @mousemove="activeIndex = it.globalIndex"
            @click="go(it)"
          >
            <span class="cp-item__icon">
              <el-icon v-if="it.icon"><component :is="it.icon" /></el-icon>
              <span v-else class="cp-item__dot" />
            </span>
            <span class="cp-item__main">
              <span class="cp-item__title">{{ it.title }}</span>
              <span v-if="it.subtitle" class="cp-item__sub">{{ it.subtitle }}</span>
            </span>
            <span class="cp-item__meta">{{ it.meta }}</span>
          </button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, nextTick, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import type { Component } from 'vue'
  import { Search } from '@element-plus/icons-vue'
  import type { NavigationGroup } from '@/constants/navigation'
  import type { PageTab } from '@/stores/tabs'

  type PaletteSource = 'recent' | 'menu' | 'jump'

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
    return sorted.slice(0, 8).map((t) => ({
      key: `recent:${t.key}`,
      title: t.title,
      subtitle: t.path,
      meta: '最近',
      path: t.path,
      source: 'recent' as const,
    }))
  })

  const menuItems = computed((): Omit<PaletteItem, 'globalIndex'>[] => {
    const out: Omit<PaletteItem, 'globalIndex'>[] = []
    for (const g of props.groups) {
      for (const c of g.children) {
        out.push({
          key: `menu:${c.path}`,
          title: c.title,
          subtitle: g.title,
          meta: '菜单',
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
    if (!/^\d+$/.test(term)) return []
    return [
      {
        key: `jump:job:${term}`,
        title: `Job Instance #${term}`,
        subtitle: '打开详情页',
        meta: '跳转',
        path: `/monitor/job-instances/${term}`,
        source: 'jump' as const,
      },
    ]
  })

  const flatItems = computed(() => {
    const rawTerm = q.value.trim()
    const term = rawTerm.toLowerCase()
    const base: Omit<PaletteItem, 'globalIndex'>[] = []

    if (term && /^\d+$/.test(rawTerm)) {
      base.push(...jumpItems.value, ...recentItems.value, ...menuItems.value)
    } else {
      base.push(...recentItems.value, ...menuItems.value)
    }

    const filtered = term
      ? base.filter((it) => {
          if (/^\d+$/.test(rawTerm) && it.source === 'jump') return true
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
    const rec = flatItems.value.filter((x) => x.source === 'recent')
    const menu = flatItems.value.filter((x) => x.source === 'menu')
    return [
      { key: 'jump', title: '快捷跳转', items: jump },
      { key: 'recent', title: '最近访问', items: rec },
      { key: 'menu', title: '菜单', items: menu },
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
  }

  watch(open, (v) => {
    if (v) activeIndex.value = 0
  })

  watch(flatItems, (list) => {
    activeIndex.value = clamp(activeIndex.value, 0, Math.max(0, list.length - 1))
  })

  watch(q, () => {
    activeIndex.value = 0
  })
</script>

<style scoped>
  .cp-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .cp-header :deep(.el-input) {
    flex: 1;
  }

  .cp-kbd {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--color-text-tertiary, #909399);
    white-space: nowrap;
  }

  .cp-body {
    max-height: min(52vh, 420px);
    overflow-y: auto;
    margin-top: 8px;
  }

  .cp-empty {
    padding: 24px;
    text-align: center;
    color: var(--color-text-tertiary, #909399);
    font-size: 13px;
  }

  .cp-section__title {
    font-size: 12px;
    font-weight: 650;
    color: var(--color-text-tertiary, #909399);
    padding: 10px 4px 6px;
    letter-spacing: 0.2px;
  }

  .cp-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .cp-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    text-align: left;
    border: 1px solid var(--color-border-light, #ebeef5);
    border-radius: var(--radius-content);
    padding: 10px 12px;
    background: var(--color-bg-card, #fff);
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .cp-item:hover,
  .cp-item.is-active {
    border-color: color-mix(
      in srgb,
      var(--color-primary, #1677ff) 35%,
      var(--color-border, #dcdfe6)
    );
    background: color-mix(
      in srgb,
      var(--color-bg-card, #fff) 90%,
      var(--color-primary, #1677ff) 10%
    );
  }

  .cp-item__icon {
    flex-shrink: 0;
    width: 22px;
    display: flex;
    justify-content: center;
    padding-top: 1px;
    color: var(--color-text-secondary, #606266);
  }

  .cp-item__dot {
    width: 6px;
    height: 6px;
    border-radius: var(--radius-content);
    background: var(--color-text-tertiary, #c0c4cc);
    margin-top: 6px;
  }

  .cp-item__main {
    flex: 1;
    min-width: 0;
  }

  .cp-item__title {
    display: block;
    font-size: 14px;
    font-weight: 650;
    color: var(--color-text-primary, #303133);
  }

  .cp-item__sub {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    color: var(--color-text-tertiary, #909399);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cp-item__meta {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--color-text-tertiary, #909399);
    padding-top: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .cp-item {
      transition: none;
    }
  }
</style>

<style>
  .command-palette.el-dialog {
    padding: 0;
    border-radius: var(--radius-content);
    overflow: hidden;
  }

  .command-palette .el-dialog__header {
    margin: 0;
    padding: 14px 16px 0;
  }

  .command-palette .el-dialog__body {
    padding: 0 16px 16px;
  }
</style>
