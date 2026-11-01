<template>
  <MPullRefresh :on-refresh="refresh">
    <div class="m-page">
      <div class="m-page__header">
        <button class="m-page__back" @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          <span>{{ t('common.backToPrev') }}</span>
        </button>
      </div>
      <WorkflowExecutionPanel v-if="validRunId" ref="panel" :run-id="runId" />
      <div v-else class="m-empty">{{ t('mobile.workflowViewer.invalidId') }}</div>
    </div>
  </MPullRefresh>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { ArrowLeft } from '@lucide/vue'
  import MPullRefresh from '@/layout-mobile/MPullRefresh.vue'
  import WorkflowExecutionPanel from '@/components/workflow/WorkflowExecutionPanel.vue'
  import { useSmartBack } from '@/composables/useSmartBack'

  const { t } = useI18n()
  const route = useRoute()
  const goBack = useSmartBack('/m/ops/summary')
  const runId = computed(() => Number(route.params.id))
  const validRunId = computed(() => Number.isSafeInteger(runId.value) && runId.value > 0)
  const panel = ref<InstanceType<typeof WorkflowExecutionPanel> | null>(null)
  async function refresh() {
    await panel.value?.refresh()
  }
</script>
