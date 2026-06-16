<template>
  <el-dropdown trigger="click" :hide-on-click="false" placement="bottom-start">
    <el-button :icon="Star" size="default">
      {{ t('savedFilters.menu') }}
      <el-badge v-if="sets.length" :value="sets.length" class="saved-filters__badge" type="info" />
    </el-button>
    <template #dropdown>
      <el-dropdown-menu class="saved-filters__menu">
        <el-dropdown-item :icon="Plus" @click="promptSave">
          {{ t('savedFilters.saveCurrent') }}
        </el-dropdown-item>
        <el-dropdown-item divided disabled class="saved-filters__section">
          {{ sets.length ? t('savedFilters.savedSection') : t('savedFilters.empty') }}
        </el-dropdown-item>
        <el-dropdown-item v-for="s in sets" :key="s.id" class="saved-filters__item">
          <div class="saved-filters__row">
            <button
              type="button"
              class="saved-filters__apply"
              :title="t('savedFilters.apply')"
              @click="apply(s)"
            >
              <el-icon><Search /></el-icon>
              <span class="saved-filters__name">{{ s.name }}</span>
            </button>
            <span class="saved-filters__actions">
              <el-icon :title="t('savedFilters.rename')" @click.stop="promptRename(s)"
                ><EditPen
              /></el-icon>
              <el-icon
                :title="t('savedFilters.delete')"
                class="saved-filters__del"
                @click.stop="confirmRemove(s)"
                ><Delete
              /></el-icon>
            </span>
          </div>
        </el-dropdown-item>
        <el-dropdown-item divided :icon="Upload" @click="doExport">
          {{ t('savedFilters.export') }}
        </el-dropdown-item>
        <el-dropdown-item :icon="Download" @click="promptImport">
          {{ t('savedFilters.import') }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
  import { ElMessage, ElMessageBox } from 'element-plus'
  import { Star, Plus, Search, EditPen, Delete, Upload, Download } from '@element-plus/icons-vue'
  import { useI18n } from 'vue-i18n'
  import type { SavedFilterSet } from '@/composables/useSavedFilters'

  type AnySet = SavedFilterSet<Record<string, unknown>>

  const props = defineProps<{
    sets: AnySet[]
    onSave: (name: string) => void
    onApply: (id: string) => void
    onRemove: (id: string) => void
    onRename: (id: string, name: string) => void
    onExport: () => string
    onImport: (json: string) => number
  }>()

  const { t } = useI18n({ useScope: 'global' })

  async function promptSave() {
    try {
      const { value } = await ElMessageBox.prompt(
        t('savedFilters.savePrompt'),
        t('savedFilters.savePromptTitle'),
        {
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
          inputValidator: (v: string) => !!v?.trim() || t('savedFilters.nameRequired'),
        },
      )
      const name = value.trim()
      props.onSave(name)
      ElMessage.success(t('savedFilters.saved', { name }))
    } catch {
      /* 取消 */
    }
  }

  function apply(s: AnySet) {
    props.onApply(s.id)
    ElMessage.success(t('savedFilters.applied', { name: s.name }))
  }

  async function promptRename(s: AnySet) {
    try {
      const { value } = await ElMessageBox.prompt(
        t('savedFilters.renamePrompt'),
        t('savedFilters.rename'),
        {
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
          inputValue: s.name,
          inputValidator: (v: string) => !!v?.trim() || t('savedFilters.nameRequired'),
        },
      )
      props.onRename(s.id, value.trim())
    } catch {
      /* 取消 */
    }
  }

  async function confirmRemove(s: AnySet) {
    try {
      await ElMessageBox.confirm(t('savedFilters.deleteConfirm', { name: s.name }), {
        type: 'warning',
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
      })
      props.onRemove(s.id)
      ElMessage.success(t('savedFilters.deleted'))
    } catch {
      /* 取消 */
    }
  }

  function doExport() {
    const json = props.onExport()
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(json)
        .then(() => ElMessage.success(t('savedFilters.exportCopied')))
        .catch(() => ElMessage.warning(json))
    } else {
      ElMessage.info(json)
    }
  }

  async function promptImport() {
    try {
      const { value } = await ElMessageBox.prompt(
        t('savedFilters.importPrompt'),
        t('savedFilters.import'),
        {
          confirmButtonText: t('common.confirm'),
          cancelButtonText: t('common.cancel'),
          inputType: 'textarea',
        },
      )
      const n = props.onImport(value ?? '')
      if (n > 0) ElMessage.success(t('savedFilters.importedN', { n }))
      else ElMessage.warning(t('savedFilters.importNone'))
    } catch {
      /* 取消 */
    }
  }
</script>

<style scoped>
  .saved-filters__badge {
    margin-left: 6px;
  }

  .saved-filters__section {
    font-size: var(--font-size-xs, 12px);
    color: var(--color-text-tertiary);
    cursor: default;
  }

  .saved-filters__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md, 12px);
    min-width: 200px;
  }

  .saved-filters__apply {
    display: flex;
    align-items: center;
    gap: var(--space-xs, 6px);
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    color: var(--color-text-primary);
    font-size: inherit;
    min-width: 0;
  }

  .saved-filters__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 160px;
  }

  .saved-filters__actions {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm, 8px);
    color: var(--color-text-tertiary);
  }

  .saved-filters__actions .el-icon {
    cursor: pointer;
  }

  .saved-filters__actions .el-icon:hover {
    color: var(--color-primary);
  }

  .saved-filters__del:hover {
    color: var(--color-danger) !important;
  }
</style>
