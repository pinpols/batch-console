<template>
  <el-dialog
    :model-value="modelValue"
    title="跨租户复制配置"
    width="640px"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-alert type="info" :closable="false" show-icon class="mb-12">
      <template #title>从源租户读取配置,自动写入目标租户,无需手写 Spec。</template>
    </el-alert>
    <el-form ref="copyFormRef" :model="form" :rules="copyFormRules" label-width="100px">
      <el-form-item label="源租户" prop="sourceTenantId">
        <el-select
          class="query-w-280"
          v-model="form.sourceTenantId"
          filterable
          placeholder="选择源租户"
        >
          <el-option
            v-for="t in sourceableItems"
            :key="t.tenantId"
            :label="`${t.tenantId} — ${t.tenantName}`"
            :value="t.tenantId"
          />
        </el-select>
        <div class="form-hint">系统/内置租户(system / default / default-tenant)已隐藏</div>
      </el-form-item>
      <el-form-item label="目标租户" prop="targetTenantIds">
        <el-select
          v-model="form.targetTenantIds"
          multiple
          filterable
          placeholder="选择一个或多个目标租户"
          class="query-w-full"
        >
          <el-option
            v-for="t in targetableItems"
            :key="t.tenantId"
            :label="`${t.tenantId} — ${t.tenantName}`"
            :value="t.tenantId"
          />
        </el-select>
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
      <el-form-item label="试运行">
        <el-switch v-model="form.dryRun" />
        <span class="form-hint u-ml-8">开启后仅预览差异,不实际写入</span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">
        {{ form.dryRun ? '试运行' : '执行复制' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import type { FormRules } from 'element-plus'
  import { copyTenantConfig, type ConfigType } from '@/api/ops'
  import type { Tenant } from '@/api/tenants'
  import { ALL_CONFIG_TYPES, isReservedTenant } from './tenantConfigTypes'
  import { useFormValidate, rules } from '@/composables/useFormValidate'

  const props = defineProps<{
    modelValue: boolean
    items: Tenant[]
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', v: boolean): void
    (e: 'result', data: unknown): void
  }>()

  const saving = ref(false)
  const form = reactive({
    sourceTenantId: '',
    targetTenantIds: [] as string[],
    configTypes: [] as ConfigType[],
    mode: 'SKIP_EXISTING' as 'SKIP_EXISTING' | 'UPSERT',
    dryRun: true,
  })

  const { formRef: copyFormRef, validate: validateCopyForm } = useFormValidate()
  const copyFormRules: FormRules = {
    sourceTenantId: [rules.required('请选择源租户', 'change')],
    targetTenantIds: [
      {
        validator: (_r, v: unknown[], cb) =>
          Array.isArray(v) && v.length > 0 ? cb() : cb(new Error('请选择至少一个目标租户')),
        trigger: 'change',
      },
    ],
  }

  // 源租户:排除系统/内置租户(参考 tenantConfigTypes.RESERVED_TENANT_IDS)
  const sourceableItems = computed(() => props.items.filter((x) => !isReservedTenant(x.tenantId)))
  // 目标租户:同样排掉系统租户(系统配置不该被业务租户配置覆盖),且不能选当前源
  const targetableItems = computed(() =>
    props.items.filter((x) => !isReservedTenant(x.tenantId) && x.tenantId !== form.sourceTenantId),
  )

  watch(
    () => props.modelValue,
    (open) => {
      if (!open) return
      form.sourceTenantId = ''
      form.targetTenantIds = []
      form.configTypes = []
      form.mode = 'SKIP_EXISTING'
      form.dryRun = true
    },
  )

  async function submit() {
    if (!(await validateCopyForm())) return
    saving.value = true
    try {
      const res = await copyTenantConfig({
        sourceTenantId: form.sourceTenantId,
        targetTenantIds: form.targetTenantIds,
        configTypes: form.configTypes.length ? form.configTypes : undefined,
        mode: form.mode,
        dryRun: form.dryRun,
      })
      emit('result', res)
      if (!form.dryRun) {
        ElMessage.success('复制完成')
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
