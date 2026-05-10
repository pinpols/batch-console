<template>
  <el-dialog
    :model-value="modelValue"
    title="批量新增租户"
    width="620px"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-form ref="batchFormRef" :model="form" :rules="batchFormRules" label-width="100px">
      <el-form-item label="租户列表" prop="tenantsText">
        <el-input
          v-model="form.tenantsText"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 10 }"
          placeholder="每行一个:tenantId,tenantName[,description]"
        />
        <div class="form-hint">每行格式:tenantId,名称[,描述]。最多 50 个。</div>
      </el-form-item>
      <el-form-item label="用户名前缀" prop="usernamePrefix">
        <el-input
          v-model="form.usernamePrefix"
          placeholder="默认 op-,最终用户名为 {前缀}{tenantId}"
          maxlength="32"
        />
      </el-form-item>
      <el-form-item label="共享密码" prop="password">
        <el-input
          v-model="form.password"
          type="password"
          show-password
          placeholder="所有租户共享的初始密码,≥ 12 位"
          maxlength="256"
        />
        <div class="form-hint">建议大小写字母 + 数字混合;每个租户首次登录后立即修改</div>
      </el-form-item>
      <el-divider content-position="left">配置初始化(可选)</el-divider>
      <el-form-item label="源租户">
        <el-select
          class="query-w-280"
          v-model="form.initConfigFrom"
          clearable
          filterable
          placeholder="留空跳过(default 为内置模板)"
        >
          <template #empty>
            <div class="empty-hint">系统/内置租户已隐藏</div>
          </template>
          <el-option
            v-for="t in sourceableItems"
            :key="t.tenantId"
            :label="`${t.tenantId} — ${t.tenantName}`"
            :value="t.tenantId"
          >
            <span>{{ t.tenantId }} — {{ t.tenantName }}</span>
            <el-tag
              v-if="isTemplateTenant(t.tenantId)"
              size="small"
              type="primary"
              effect="plain"
              class="u-ml-8"
            >
              推荐模板
            </el-tag>
          </el-option>
        </el-select>
        <div class="form-hint">选择后将复制源租户的全部 10 类配置(系统租户已隐藏)</div>
      </el-form-item>
      <el-form-item v-if="form.initConfigFrom" label="初始化模式">
        <el-radio-group v-model="form.initMode">
          <el-radio value="SKIP_EXISTING">SKIP_EXISTING</el-radio>
          <el-radio value="UPSERT">UPSERT</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">批量创建</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import type { FormRules } from 'element-plus'
  import { batchCreateTenants, type Tenant } from '@/api/tenants'
  import { isReservedTenant, isTemplateTenant } from './tenantConfigTypes'
  import { useFormValidate, rules } from '@/composables/useFormValidate'

  const props = defineProps<{
    modelValue: boolean
    items: Tenant[]
  }>()

  // 与 TenantCopyConfigDialog 一致:源租户排除 system/default/default-tenant
  const sourceableItems = computed(() => props.items.filter((x) => !isReservedTenant(x.tenantId)))

  const emit = defineEmits<{
    (e: 'update:modelValue', v: boolean): void
    (e: 'saved'): void
    (e: 'result', data: unknown): void
  }>()

  const saving = ref(false)
  const form = reactive({
    tenantsText: '',
    usernamePrefix: 'op-',
    password: '',
    initConfigFrom: '',
    initMode: 'SKIP_EXISTING' as 'SKIP_EXISTING' | 'UPSERT',
  })

  watch(
    () => props.modelValue,
    (open) => {
      if (!open) return
      form.tenantsText = ''
      form.usernamePrefix = 'op-'
      form.password = ''
      form.initConfigFrom = ''
      form.initMode = 'SKIP_EXISTING'
    },
  )

  const { formRef: batchFormRef, validate: validateBatchForm } = useFormValidate()
  // tenantsText 校验逻辑复杂(逐行解析 + 数量上限),写自定义 validator
  const batchFormRules: FormRules = {
    tenantsText: [
      rules.required('请至少填写一个租户'),
      {
        validator: (_r, v: string, cb) => {
          const items = parseTenants(v ?? '')
          if (items.length === 0) return cb(new Error('请至少填写一个租户'))
          if (items.length > 50) return cb(new Error('单次最多 50 个租户'))
          for (const t of items) {
            if (!t.tenantId || !t.tenantName) {
              return cb(new Error(`每行至少包含 tenantId 和名称:${t.tenantId || '(空)'}`))
            }
          }
          cb()
        },
        trigger: 'blur',
      },
    ],
    password: [rules.required('共享密码必填'), rules.minLength(12)],
  }

  function parseTenants(text: string) {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [tenantId = '', tenantName = '', description] = line.split(',').map((s) => s.trim())
        return { tenantId, tenantName, description: description || undefined }
      })
  }

  async function submit() {
    if (!(await validateBatchForm())) return
    const tenants = parseTenants(form.tenantsText)
    saving.value = true
    try {
      const res = await batchCreateTenants({
        tenants,
        usernamePrefix: form.usernamePrefix || undefined,
        password: form.password,
        initConfigFrom: form.initConfigFrom || undefined,
        initMode: form.initConfigFrom ? form.initMode : undefined,
      })
      emit('update:modelValue', false)
      if (res.configInit) {
        const ci = res.configInit
        ElMessage.success(
          `已创建 ${tenants.length} 个租户,配置初始化:${ci.successTenants} 成功 / ${ci.failureTenants} 失败`,
        )
        emit('result', res.configInit)
      } else {
        ElMessage.success(`已批量创建 ${tenants.length} 个租户`)
      }
      emit('saved')
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
    line-height: 1.4;
  }

  .empty-hint {
    padding: 8px 12px;
    font-size: 12px;
    color: var(--color-text-tertiary, #909399);
  }
</style>
