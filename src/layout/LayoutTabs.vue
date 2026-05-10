<template>
  <div v-if="tabsStore.list.length && !app.focusMode" class="floating-tabs">
    <div class="page-tabs floating-tabs__panel">
      <div class="page-tabs__scroll">
        <el-popover
          v-if="tabsStore.overflowTabs.length"
          v-model:visible="overflowOpen"
          placement="bottom-start"
          :width="300"
          trigger="click"
          popper-class="page-tabs-overflow-popper"
        >
          <template #reference>
            <div
              class="page-tab page-tab--overflow"
              :class="{ 'page-tab--active': overflowContainsActive }"
              role="button"
              tabindex="0"
              @keydown.enter.prevent="overflowOpen = true"
            >
              <span class="page-tab__title"
                >{{ t('common.more') }} ({{ tabsStore.overflowTabs.length }})</span
              >
              <el-icon class="page-tab__overflow-caret">
                <ArrowDown />
              </el-icon>
            </div>
          </template>
          <div class="page-tabs-overflow">
            <div class="page-tabs-overflow__list">
              <div
                v-for="tab in tabsStore.overflowTabs"
                :key="tab.key"
                class="page-tabs-overflow__row"
                :class="{ 'is-active': route.fullPath === tab.key }"
              >
                <span class="page-tabs-overflow__row-title" @click="onOverflowTabClick(tab)">{{
                  resolveTabTitle(tab)
                }}</span>
                <div class="page-tabs-overflow__row-actions" @click.stop>
                  <el-dropdown
                    trigger="click"
                    popper-class="page-tab-dropdown-popper"
                    @command="(c) => tabCloseCommand(c, tab.key)"
                  >
                    <span class="page-tab__kebab" :aria-label="t('nav.closeTabsBatchAria')">
                      <el-icon><MoreFilled /></el-icon>
                    </span>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="left" :disabled="tabDisableCloseLeft(tab.key)">
                          {{ t('nav.closeLeft') }}
                        </el-dropdown-item>
                        <el-dropdown-item command="right" :disabled="tabDisableCloseRight(tab.key)">
                          {{ t('nav.closeRight') }}
                        </el-dropdown-item>
                        <el-dropdown-item command="others" :disabled="tabDisableCloseOthers()">
                          {{ t('nav.closeOthers') }}
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                  <span
                    v-if="tabsStore.list.length > 1"
                    class="page-tab__close page-tabs-overflow__row-close"
                    role="button"
                    tabindex="0"
                    :aria-label="t('nav.closeTabAria')"
                    @click.stop="closeTab(tab.key)"
                    @keydown.enter.prevent.stop="closeTab(tab.key)"
                  >
                    ×
                  </span>
                </div>
              </div>
            </div>
          </div>
        </el-popover>
        <div
          v-for="tab in tabsStore.visibleTabs"
          :key="tab.key"
          class="page-tab"
          :class="{ 'page-tab--active': route.fullPath === tab.key }"
        >
          <span class="page-tab__title" @click="onTabClick(tab.path)">{{
            resolveTabTitle(tab)
          }}</span>
          <div class="page-tab__trailing" @click.stop>
            <el-dropdown
              trigger="click"
              popper-class="page-tab-dropdown-popper"
              @command="(c) => tabCloseCommand(c, tab.key)"
            >
              <span class="page-tab__kebab" :aria-label="t('nav.closeTabsBatchAria')">
                <el-icon><MoreFilled /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="left" :disabled="tabDisableCloseLeft(tab.key)">
                    {{ t('nav.closeLeft') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="right" :disabled="tabDisableCloseRight(tab.key)">
                    {{ t('nav.closeRight') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="others" :disabled="tabDisableCloseOthers()">
                    {{ t('nav.closeOthers') }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <span
              v-if="tabsStore.list.length > 1"
              class="page-tab__close"
              role="button"
              tabindex="0"
              :aria-label="t('nav.closeTabAria')"
              @click.stop="closeTab(tab.key)"
              @keydown.enter.prevent.stop="closeTab(tab.key)"
            >
              ×
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ArrowDown, MoreFilled } from '@element-plus/icons-vue'
  import { useTabsStore, type PageTab } from '@/stores/tabs'
  import { useAppStore } from '@/stores/app'
  import { pathToKey } from '@/constants/pathKey'

  const route = useRoute()
  const router = useRouter()
  const app = useAppStore()
  const tabsStore = useTabsStore()
  const overflowOpen = ref(false)
  const { t, te } = useI18n()

  function resolveTabTitle(tab: PageTab): string {
    const key = `page.${pathToKey(tab.path)}.title`
    return te(key) ? t(key) : tab.title
  }

  const overflowContainsActive = computed(() =>
    tabsStore.overflowTabs.some((t) => t.key === route.fullPath),
  )

  function onTabClick(path: string) {
    if (path !== route.fullPath) void router.push(path)
  }

  function onOverflowTabClick(tab: PageTab) {
    overflowOpen.value = false
    if (tab.path !== route.fullPath) void router.push(tab.path)
  }

  function closeTab(key: string) {
    if (tabsStore.list.length <= 1) return
    const active = route.fullPath === key
    const idx = tabsStore.removeByKey(key)
    if (idx < 0) return
    if (active) {
      const next = tabsStore.list[idx] ?? tabsStore.list[idx - 1]
      void router.push(next?.path ?? '/ops/summary')
    }
    if (!tabsStore.overflowTabs.length) overflowOpen.value = false
  }

  function tabCloseCommand(cmd: string, refKey: string) {
    if (cmd !== 'left' && cmd !== 'right' && cmd !== 'others') return
    let target: string | null = null
    if (cmd === 'left') target = tabsStore.closeAllLeftOf(route.fullPath, refKey)
    else if (cmd === 'right') target = tabsStore.closeAllRightOf(route.fullPath, refKey)
    else target = tabsStore.closeOthers(route.fullPath, refKey)
    if (!tabsStore.overflowTabs.length) overflowOpen.value = false
    if (target) void router.push(target)
  }

  function tabOpenIndex(key: string) {
    return tabsStore.list.findIndex((t) => t.key === key)
  }

  function tabDisableCloseLeft(key: string) {
    return tabOpenIndex(key) <= 0
  }

  function tabDisableCloseRight(key: string) {
    const i = tabOpenIndex(key)
    return i < 0 || i >= tabsStore.list.length - 1
  }

  function tabDisableCloseOthers() {
    return tabsStore.list.length <= 1
  }
</script>

<style scoped>
  .floating-tabs {
    display: flex;
    justify-content: center;
    align-items: center;
    min-width: 0;
    box-sizing: border-box;
    padding: 0;
    width: fit-content;
    max-width: 100%;
  }

  .floating-tabs__panel.page-tabs {
    margin: 0;
    transform-origin: 50% 50%;
    transition:
      transform 170ms ease,
      box-shadow 200ms ease,
      border-color 170ms ease;
  }

  /* 默认收起：只显示当前 tab */
  .floating-tabs:not(:hover):not(:focus-within) .page-tab:not(.page-tab--active),
  .floating-tabs:not(:hover):not(:focus-within) .page-tab--overflow {
    display: none;
  }

  .floating-tabs:not(:hover):not(:focus-within) .page-tabs__scroll {
    padding-bottom: 0;
  }

  /* 悬浮展开 */
  .floating-tabs:hover .floating-tabs__panel,
  .floating-tabs:focus-within .floating-tabs__panel {
    transform: translateY(var(--ui-hover-translate-y)) scale(var(--ui-hover-scale));
    box-shadow: var(--shadow-surface-hover);
    border-color: color-mix(in srgb, var(--color-border) 68%, var(--color-primary) 32%);
  }

  @media (prefers-reduced-motion: reduce) {
    .floating-tabs__panel.page-tabs,
    .floating-tabs:hover .floating-tabs__panel,
    .floating-tabs:focus-within .floating-tabs__panel {
      transition: none;
      transform: none;
    }
  }

  .page-tabs {
    flex-shrink: 0;
    display: inline-block;
    width: fit-content;
    max-width: 100%;
    margin: 0;
    padding: 4px 8px 3px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-card-lg);
    box-shadow: var(--shadow-surface);
  }

  .page-tabs__scroll {
    display: flex;
    flex-wrap: nowrap;
    gap: 4px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: thin;
  }

  .page-tab {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    max-width: 180px;
    /* 别让 flex 把标题挤成纯 ··· × ;真装不下走横向 scroll(.page-tabs__scroll 已开) */
    min-width: 80px;
    padding: 5px 6px 5px 8px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
    background: var(--color-bg-card);
    color: var(--color-text-secondary, #606266);
    font-size: 12px;
    cursor: default;
    white-space: nowrap;
    box-shadow:
      0 1px 2px rgb(15 23 42 / 5%),
      0 2px 6px rgb(15 23 42 / 6%),
      0 0 0 1px rgb(15 23 42 / 3%);
    transition:
      background 0.15s,
      border-color 0.15s,
      color 0.15s,
      box-shadow 0.18s ease;
  }

  .page-tab:hover {
    border-color: var(--el-color-primary-light-5);
    color: var(--el-color-primary);
    box-shadow:
      0 2px 6px rgb(15 23 42 / 7%),
      0 4px 12px rgb(22 119 255 / 12%),
      0 0 0 1px rgb(22 119 255 / 10%);
  }

  .page-tab--active {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    font-weight: 600;
    box-shadow:
      0 2px 8px rgb(22 119 255 / 14%),
      0 4px 16px rgb(22 119 255 / 10%),
      0 0 0 1px rgb(22 119 255 / 18%);
  }

  :global(html.dark) .page-tab {
    box-shadow:
      0 2px 8px rgb(0 0 0 / 42%),
      0 0 0 1px rgb(255 255 255 / 7%);
  }

  :global(html.dark) .page-tab:hover {
    box-shadow:
      0 2px 10px rgb(0 0 0 / 48%),
      0 4px 14px rgb(22 119 255 / 18%),
      0 0 0 1px rgb(22 119 255 / 22%);
  }

  :global(html.dark) .page-tab--active {
    box-shadow:
      0 2px 12px rgb(0 0 0 / 55%),
      0 4px 18px rgb(22 119 255 / 22%),
      0 0 0 1px rgb(22 119 255 / 28%);
  }

  .page-tab__title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
  }

  .page-tab__trailing {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 1px;
  }

  .page-tab__kebab {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: var(--radius-content);
    font-size: 12px;
    color: var(--color-text-tertiary);
    cursor: pointer;
    outline: none;
  }

  .page-tab__kebab:hover {
    background: rgb(0 0 0 / 8%);
    color: var(--el-color-primary);
  }

  .page-tab--active .page-tab__kebab {
    color: var(--el-color-primary);
  }

  .page-tab__close {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: var(--radius-content);
    font-size: 13px;
    line-height: 1;
    color: var(--color-text-tertiary);
    transition: background 0.12s;
  }

  .page-tab__close:hover {
    background: rgb(0 0 0 / 8%);
    color: var(--el-color-danger);
  }

  .page-tab--overflow {
    flex-shrink: 0;
    max-width: 140px;
    cursor: pointer;
  }

  .page-tab__overflow-caret {
    font-size: 12px;
    color: var(--color-text-tertiary);
  }

  .page-tab--overflow.page-tab--active .page-tab__overflow-caret {
    color: var(--el-color-primary);
  }

  .page-tabs-overflow {
    margin: -6px -2px;
  }

  .page-tabs-overflow__list {
    max-height: 260px;
    overflow-y: auto;
    padding: 4px 0;
  }

  .page-tabs-overflow__row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    font-size: 13px;
    color: var(--color-text-primary);
    transition: background 0.12s;
  }

  .page-tabs-overflow__row:hover {
    background: var(--el-fill-color-light);
  }

  .page-tabs-overflow__row.is-active {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    font-weight: 600;
  }

  .page-tabs-overflow__row-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }

  .page-tabs-overflow__row-actions {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 2px;
  }

  .page-tabs-overflow__row-close {
    flex-shrink: 0;
  }
</style>
