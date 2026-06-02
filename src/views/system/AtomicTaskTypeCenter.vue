<template>
  <PageContainer>
    <PageHeader>
      <template #actions>
        <el-button :icon="Refresh" :loading="loading" @click="load">
          {{ t('common.refresh') }}
        </el-button>
      </template>
    </PageHeader>

    <SectionCard>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="atc__intro"
        :title="t('atomicTaskTypeCenter.introTitle')"
      >
        <template #default>
          {{ t('atomicTaskTypeCenter.introBody') }}
        </template>
      </el-alert>

      <div v-if="loadError" class="atc__error">
        <el-alert
          type="error"
          show-icon
          :closable="false"
          :title="t('atomicTaskTypeCenter.loadError')"
        >
          <template #default>
            <el-button type="primary" link @click="load">{{ t('common.retry') }}</el-button>
          </template>
        </el-alert>
      </div>

      <el-skeleton v-else-if="loading && schemas.length === 0" :rows="5" animated />

      <EmptyState
        v-else-if="!loading && schemas.length === 0"
        :description="t('atomicTaskTypeCenter.empty')"
        :image-size="80"
      />

      <el-tabs v-else v-model="activeType" class="atc__tabs">
        <el-tab-pane
          v-for="schema in schemas"
          :key="schema.taskType"
          :name="schema.taskType"
        >
          <template #label>
            <div class="atc__tab-label">
              <span>{{ schema.displayName }}</span>
              <el-tag
                v-if="!schema.enabledByDefault"
                size="small"
                type="warning"
                effect="plain"
                class="atc__tab-tag"
              >
                {{ t('atomicTaskTypeCenter.tagDefaultDisabled') }}
              </el-tag>
            </div>
          </template>

          <div class="atc__pane">
            <el-alert
              v-if="!schema.enabledByDefault"
              type="warning"
              :closable="false"
              show-icon
              class="atc__pane-alert"
              :title="t('atomicTaskTypeCenter.warnDefaultDisabledTitle', { type: schema.taskType })"
            >
              <template #default>
                {{ t('atomicTaskTypeCenter.warnDefaultDisabledBody') }}
              </template>
            </el-alert>

            <h3 class="atc__section-title">{{ t('atomicTaskTypeCenter.sectionParameters') }}</h3>
            <el-table
              :data="schema.parameters"
              border
              stripe
              size="small"
              :empty-text="t('atomicTaskTypeCenter.parametersEmpty')"
              class="atc__table"
            >
              <el-table-column
                prop="name"
                :label="t('atomicTaskTypeCenter.colParamName')"
                width="200"
              />
              <el-table-column
                prop="type"
                :label="t('atomicTaskTypeCenter.colParamType')"
                width="120"
              >
                <template #default="{ row }">
                  <el-tag size="small" effect="plain">{{ row.type }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column
                :label="t('atomicTaskTypeCenter.colParamRequired')"
                width="100"
                align="center"
              >
                <template #default="{ row }">
                  <el-tag
                    v-if="row.required"
                    size="small"
                    type="danger"
                    effect="plain"
                  >
                    {{ t('atomicTaskTypeCenter.requiredYes') }}
                  </el-tag>
                  <span v-else class="muted">{{ t('atomicTaskTypeCenter.requiredNo') }}</span>
                </template>
              </el-table-column>
              <el-table-column
                prop="description"
                :label="t('atomicTaskTypeCenter.colParamDescription')"
                show-overflow-tooltip
              />
            </el-table>

            <h3 class="atc__section-title">
              {{ t('atomicTaskTypeCenter.sectionTryForm') }}
            </h3>
            <el-alert
              type="info"
              :closable="false"
              show-icon
              class="atc__pane-alert"
              :title="t('atomicTaskTypeCenter.tryFormHintTitle')"
            >
              <template #default>
                {{ t('atomicTaskTypeCenter.tryFormHintBody') }}
              </template>
            </el-alert>
            <el-form
              :model="getDraft(schema.taskType)"
              label-width="160px"
              size="small"
              class="atc__form"
            >
              <el-form-item
                v-for="p in schema.parameters"
                :key="p.name"
                :label="p.name"
              >
                <component
                  :is="inputComponentFor(p)"
                  v-model="getDraft(schema.taskType)[p.name]"
                  v-bind="inputPropsFor(p)"
                />
                <div v-if="p.description" class="atc__field-hint">{{ p.description }}</div>
              </el-form-item>
            </el-form>
            <div class="atc__form-actions">
              <el-button :icon="DocumentCopy" @click="copyJson(schema.taskType)">
                {{ t('atomicTaskTypeCenter.btnCopyJson') }}
              </el-button>
              <el-button @click="resetDraft(schema.taskType)">
                {{ t('common.reset') }}
              </el-button>
            </div>
            <JsonPreview :data="getDraft(schema.taskType)" />

            <h3 class="atc__section-title">{{ t('atomicTaskTypeCenter.sectionSecurity') }}</h3>
            <el-table
              :data="schema.securityGates"
              border
              stripe
              size="small"
              :empty-text="t('atomicTaskTypeCenter.securityEmpty')"
              class="atc__table"
            >
              <el-table-column
                prop="field"
                :label="t('atomicTaskTypeCenter.colSecurityField')"
                width="260"
              >
                <template #default="{ row }">
                  <code>{{ row.field }}</code>
                </template>
              </el-table-column>
              <el-table-column
                prop="meaning"
                :label="t('atomicTaskTypeCenter.colSecurityMeaning')"
                show-overflow-tooltip
              />
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </SectionCard>
  </PageContainer>
</template>

<script setup lang="ts">
  import { ref, reactive } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { ElMessage } from 'element-plus'
  import { Refresh, DocumentCopy } from '@element-plus/icons-vue'
  import { ElInput, ElInputNumber, ElSwitch } from 'element-plus'
  import PageContainer from '@/components/common/PageContainer.vue'
  import PageHeader from '@/components/common/PageHeader.vue'
  import SectionCard from '@/components/common/SectionCard.vue'
  import EmptyState from '@/components/common/EmptyState.vue'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import {
    listAtomicTaskTypeSchemas,
    type AtomicTaskTypeSchema,
    type AtomicParamSpec,
  } from '@/api/atomicTaskTypes'

  const { t } = useI18n({ useScope: 'global' })

  const schemas = ref<AtomicTaskTypeSchema[]>([])
  const loading = ref(false)
  const loadError = ref<unknown>(null)
  const activeType = ref<string>('')
  // 每个 taskType 维护一份独立 draft;切 tab 不丢
  const drafts = reactive<Record<string, Record<string, unknown>>>({})

  function inputComponentFor(p: AtomicParamSpec) {
    if (p.type === 'boolean') return ElSwitch
    if (p.type === 'integer' || p.type === 'number') return ElInputNumber
    return ElInput
  }

  function inputPropsFor(p: AtomicParamSpec) {
    if (p.type === 'integer' || p.type === 'number') {
      return { controlsPosition: 'right' as const, class: 'atc__num' }
    }
    if (p.type === 'boolean') return {}
    return { placeholder: p.required ? t('common.required') : t('common.optional') }
  }

  function getDraft(taskType: string) {
    if (!drafts[taskType]) drafts[taskType] = {}
    return drafts[taskType]
  }

  function resetDraft(taskType: string) {
    drafts[taskType] = {}
  }

  async function copyJson(taskType: string) {
    const text = JSON.stringify(getDraft(taskType), null, 2)
    try {
      await navigator.clipboard.writeText(text)
      ElMessage.success(t('atomicTaskTypeCenter.copySuccess'))
    } catch {
      ElMessage.warning(t('atomicTaskTypeCenter.copyFailed'))
    }
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const list = await listAtomicTaskTypeSchemas()
      schemas.value = list
      if (list.length > 0 && !activeType.value) {
        activeType.value = list[0].taskType
      }
    } catch (err) {
      loadError.value = err
    } finally {
      loading.value = false
    }
  }

  void load()
</script>

<style scoped>
  .atc__intro {
    margin-bottom: var(--space-md, 16px);
  }

  .atc__error {
    margin: var(--space-md, 16px) 0;
  }

  .atc__tabs {
    margin-top: var(--space-sm, 12px);
  }

  .atc__tab-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .atc__tab-tag {
    margin-left: 4px;
  }

  .atc__pane {
    padding-top: 4px;
    display: flex;
    flex-direction: column;
    gap: var(--space-md, 16px);
  }

  .atc__pane-alert {
    font-size: 12px;
  }

  .atc__section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: var(--space-sm, 12px) 0 0;
  }

  .atc__table {
    width: 100%;
  }

  .atc__form {
    background: var(--color-bg-subtle, #f7f8fa);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content, 8px);
    padding: 16px;
  }

  .atc__form-actions {
    display: flex;
    gap: 8px;
  }

  .atc__field-hint {
    font-size: 12px;
    color: var(--color-text-tertiary);
    margin-top: 2px;
    line-height: 1.5;
  }

  .atc__num {
    width: 200px;
  }

  .muted {
    color: var(--color-text-tertiary);
  }
</style>
