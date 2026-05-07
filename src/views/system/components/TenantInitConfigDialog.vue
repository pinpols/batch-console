<template>
  <el-dialog
    :model-value="modelValue"
    title="初始化租户配置"
    width="640px"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-alert type="info" :closable="false" show-icon class="mb-12">
      <template #title>
        将 JSON Spec 写入目标租户,覆盖全部 10 个配置域。SKIP_EXISTING 仅创建缺失项,UPSERT
        会覆盖已有项。
      </template>
    </el-alert>
    <el-form label-width="100px">
      <el-form-item label="目标租户">
        <el-tag>{{ form.targetTenantId }}</el-tag>
      </el-form-item>
      <el-form-item label="配置类型">
        <el-checkbox-group v-model="form.configTypes">
          <el-checkbox v-for="ct in ALL_CONFIG_TYPES" :key="ct" :label="ct" :value="ct" />
        </el-checkbox-group>
        <div class="form-hint">留空表示全部 10 个类型</div>
      </el-form-item>
      <el-form-item label="写入模式">
        <el-radio-group v-model="form.mode">
          <el-radio value="SKIP_EXISTING">SKIP_EXISTING</el-radio>
          <el-radio value="UPSERT">UPSERT</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="Spec JSON" required>
        <el-input
          v-model="form.specJson"
          type="textarea"
          :autosize="{ minRows: 8, maxRows: 20 }"
          placeholder='完整的配置 JSON,例如 {"jobDefinitions":[...],"workflowDefinitions":[...]}'
          style="font-family: var(--font-family-mono, monospace); font-size: 12px"
        />
      </el-form-item>
      <el-form-item label="试运行">
        <el-switch v-model="form.dryRun" />
        <span class="form-hint u-ml-8">开启后仅校验,不实际写入</span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">
        {{ form.dryRun ? '试运行' : '执行初始化' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { reactive, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import { batchInitTenantConfig, type ConfigType } from '@/api/ops'
  import { ALL_CONFIG_TYPES } from './tenantConfigTypes'

  const props = defineProps<{
    modelValue: boolean
    targetTenantId: string
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', v: boolean): void
    (e: 'result', data: unknown): void
  }>()

  const saving = ref(false)
  const form = reactive({
    targetTenantId: '',
    configTypes: [] as ConfigType[],
    mode: 'SKIP_EXISTING' as 'SKIP_EXISTING' | 'UPSERT',
    specJson: '',
    dryRun: true,
  })

  watch(
    () => props.modelValue,
    (open) => {
      if (!open) return
      form.targetTenantId = props.targetTenantId
      form.configTypes = []
      form.mode = 'SKIP_EXISTING'
      form.specJson = ''
      form.dryRun = true
    },
  )

  async function submit() {
    if (!form.specJson.trim()) {
      ElMessage.warning('Spec JSON 不能为空')
      return
    }
    let spec: Record<string, unknown>
    try {
      spec = JSON.parse(form.specJson)
    } catch {
      ElMessage.error('JSON 格式不合法')
      return
    }
    saving.value = true
    try {
      const res = await batchInitTenantConfig({
        targetTenantIds: [form.targetTenantId],
        spec,
        configTypes: form.configTypes.length ? form.configTypes : undefined,
        mode: form.mode,
        dryRun: form.dryRun,
      })
      emit('result', res)
      if (!form.dryRun) {
        ElMessage.success('初始化完成')
        emit('update:modelValue', false)
      }
    } finally {
      saving.value = false
    }
  }
</script>

<style scoped>
  .form-hint {
    margin-top: 4px;
    font-size: 12px;
    color: var(--color-text-tertiary, #909399);
  }

  .mb-12 {
    margin-bottom: 12px;
  }
</style>
