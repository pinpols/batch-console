<template>
  <el-dialog
    :model-value="modelValue"
    title="初始化租户配置"
    width="640px"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <!-- 体检"痛点 7":手写 JSON 只有原作者能完成。先把人引到"复制配置"快路径,
         避免他们在这里手写 spec — 复制是无 JSON、有 dryRun 的 wizard 版,真正常用的入口 -->
    <el-alert type="warning" :closable="false" show-icon class="mb-12">
      <template #title>
        <strong>高级路径 — 需手写 Spec JSON。</strong>
        日常推荐用「页头 → 复制配置」从源租户(default 模板或同业务租户)一键复制,无需写 JSON。
      </template>
    </el-alert>
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
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <!-- 体检"痛点 8":dryRun 开关藏一层心智成本,容易把试运行当正式执行;
           改成两个明确按钮 — 灰色试运行 + 红色正式执行,主次和后果一眼能看 -->
      <el-button
        plain
        :loading="saving && lastDryRun"
        :disabled="saving && !lastDryRun"
        @click="submit(true)"
      >
        试运行预览
      </el-button>
      <el-button
        type="danger"
        :loading="saving && !lastDryRun"
        :disabled="saving && lastDryRun"
        @click="submit(false)"
      >
        正式执行初始化
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
  // 用于两个按钮区分 loading 状态:点试运行时只有"试运行"按钮转,反之亦然
  const lastDryRun = ref(true)
  const form = reactive({
    targetTenantId: '',
    configTypes: [] as ConfigType[],
    mode: 'SKIP_EXISTING' as 'SKIP_EXISTING' | 'UPSERT',
    specJson: '',
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
      lastDryRun.value = true
    },
  )

  async function submit(dryRun: boolean) {
    if (!(await validateInitForm())) return
    let spec: Record<string, unknown>
    try {
      spec = JSON.parse(form.specJson)
    } catch {
      ElMessage.error('JSON 格式不合法')
      return
    }
    saving.value = true
    lastDryRun.value = dryRun
    try {
      const res = await batchInitTenantConfig({
        targetTenantIds: [form.targetTenantId],
        spec,
        configTypes: form.configTypes.length ? form.configTypes : undefined,
        mode: form.mode,
        dryRun,
      })
      emit('result', res)
      if (!dryRun) {
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
