<template>
  <el-dialog
    :model-value="modelValue"
    title="初始化租户配置"
    width="640px"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-alert type="info" :closable="false" show-icon class="mb-12">
      <template #title>
        把一份配置 JSON 写入目标租户,可覆盖全部 10 类配置(作业 / 工作流 / 流水线 / 文件渠道 / 模板 /
        队列 / 窗口 / 日历 / 配额 / 告警路由)。
      </template>
    </el-alert>
    <el-form ref="initFormRef" :model="form" :rules="initFormRules" label-width="100px">
      <el-form-item label="目标租户">
        <el-tag>{{ form.targetTenantId }}</el-tag>
      </el-form-item>
      <el-form-item label="配置类型" prop="configTypes">
        <el-checkbox-group v-model="form.configTypes">
          <el-checkbox v-for="ct in ALL_CONFIG_TYPES" :key="ct" :label="ct" :value="ct" />
        </el-checkbox-group>
        <div class="form-hint">留空表示全部 10 个类型</div>
      </el-form-item>
      <el-form-item label="写入模式" prop="mode">
        <el-radio-group v-model="form.mode">
          <el-radio value="SKIP_EXISTING">仅补缺失项</el-radio>
          <el-radio value="UPSERT">覆盖更新已有</el-radio>
        </el-radio-group>
        <div class="form-hint">
          {{
            form.mode === 'SKIP_EXISTING'
              ? '已存在的配置保持不动,只新建源租户里多出来的'
              : '已存在的配置会被源租户的版本覆盖,慎用'
          }}
        </div>
      </el-form-item>
      <el-form-item label="Spec JSON" prop="specJson">
        <el-input
          v-model="form.specJson"
          type="textarea"
          :autosize="{ minRows: 8, maxRows: 20 }"
          placeholder='完整的配置 JSON,例如 {"jobDefinitions":[...],"workflowDefinitions":[...]}'
          style="font-family: var(--font-family-mono, monospace); font-size: 12px"
        />
      </el-form-item>
      <el-form-item label="试运行" prop="dryRun">
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
  import type { FormRules } from 'element-plus'
  import { batchInitTenantConfig, type ConfigType } from '@/api/ops'
  import { ALL_CONFIG_TYPES } from './tenantConfigTypes'
  import { useFormValidate, rules } from '@/composables/useFormValidate'

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

  const { formRef: initFormRef, validate: validateInitForm } = useFormValidate()
  const initFormRules: FormRules = {
    specJson: [rules.required('Spec JSON 必填')],
  }

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
    if (!(await validateInitForm())) return
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
