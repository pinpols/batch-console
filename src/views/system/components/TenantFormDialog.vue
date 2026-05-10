<template>
  <el-dialog
    :model-value="modelValue"
    :title="editing ? `编辑租户 · ${form.tenantId}` : '新增租户'"
    width="540px"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-form ref="formRef" :model="form" :rules="formRules" label-width="92px">
      <el-form-item label="租户 ID" prop="tenantId">
        <el-input v-model="form.tenantId" :disabled="editing" placeholder="例如:acme-prod" />
        <div class="form-hint">
          小写字母 / 数字 / 短横线,2-64 位,首尾字母或数字 · <strong>创建后不可修改</strong>
        </div>
      </el-form-item>
      <el-form-item label="名称" prop="tenantName">
        <el-input v-model="form.tenantName" placeholder="租户显示名称" maxlength="256" />
      </el-form-item>
      <el-form-item label="描述" prop="description">
        <el-input
          v-model="form.description"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          placeholder="可选"
          maxlength="512"
          show-word-limit
        />
      </el-form-item>

      <template v-if="!editing">
        <el-divider content-position="left">
          <span class="section-divider__text">首位管理员账号</span>
        </el-divider>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="form-alert"
          title="新租户需要先有一个管理员账号才能登录,这里同时创建首位管理员。后续可在「登录账户」页继续添加更多账号。"
        />
        <el-form-item label="账号名" prop="username">
          <el-input
            v-model="form.username"
            placeholder="例:admin、op-acme(字母 / 数字 / . _ -)"
            maxlength="128"
          />
        </el-form-item>
        <el-form-item label="初始密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="≥ 12 位,建议大小写字母 + 数字混合"
            maxlength="256"
          />
          <div class="form-hint">用户首次登录后应立即修改</div>
        </el-form-item>
      </template>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">
        {{ editing ? '保存' : '创建' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
  import { computed, reactive, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import type { FormRules } from 'element-plus'
  import { createTenant, updateTenant, type Tenant } from '@/api/tenants'
  import { useFormValidate, rules } from '@/composables/useFormValidate'

  const props = defineProps<{
    modelValue: boolean
    initial: Tenant | null
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', v: boolean): void
    /** payload 携带 tenantId 和 created 标记;父组件可据此决定是否展示"创建后引导卡片" */
    (e: 'saved', payload: { tenantId: string; created: boolean }): void
  }>()

  const editing = ref(false)
  const saving = ref(false)
  const form = reactive({
    tenantId: '',
    tenantName: '',
    description: '',
    username: '',
    password: '',
  })

  const { formRef, validate } = useFormValidate()

  // 编辑态下 tenantId / username / password 不校验(灰显或不显示);
  // 新建态下要走完整规则
  const formRules = computed<FormRules>(() => {
    const base: FormRules = {
      tenantName: [rules.required('名称必填'), rules.maxLength(256)],
    }
    if (!editing.value) {
      Object.assign(base, {
        tenantId: [
          rules.required('tenantId 必填'),
          rules.pattern(
            /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/,
            '小写字母/数字/短横线,长度 2-64,首尾字母或数字',
          ),
        ],
        username: [
          rules.required('账号名必填'),
          rules.pattern(/^[a-zA-Z0-9][a-zA-Z0-9._-]+$/, '字母 / 数字 / . _ -,首字符须字母或数字'),
          rules.minLength(2),
        ],
        // BE 实际接受 ≥8,FE 加严到 ≥12 与「批量新增」「BE BatchCreateTenantRequest」对齐,
        // 避免单租户用 8 位弱密码后批量场景又要求 12 的不一致体验
        password: [rules.required('初始密码必填'), rules.minLength(12)],
      })
    }
    return base
  })

  watch(
    () => props.modelValue,
    (open) => {
      if (!open) return
      const row = props.initial
      editing.value = !!row
      form.tenantId = row?.tenantId ?? ''
      form.tenantName = row?.tenantName ?? ''
      form.description = row?.description ?? ''
      form.username = ''
      form.password = ''
    },
  )

  async function submit() {
    if (!(await validate())) return
    saving.value = true
    try {
      const tenantId = form.tenantId.trim()
      if (editing.value) {
        await updateTenant(tenantId, {
          tenantName: form.tenantName.trim(),
          description: form.description || undefined,
        })
        ElMessage.success('已更新')
      } else {
        await createTenant({
          tenantId,
          tenantName: form.tenantName.trim(),
          description: form.description || undefined,
          username: form.username.trim(),
          password: form.password,
        })
        // 不再 toast"已创建"——父组件会展示带"去初始化 / 查看列表"的引导卡片
      }
      emit('saved', { tenantId, created: !editing.value })
      emit('update:modelValue', false)
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

  .section-divider__text {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary, #606266);
    letter-spacing: 0.3px;
  }

  .form-alert {
    margin-bottom: 16px;
    font-size: 12px;
  }
</style>
