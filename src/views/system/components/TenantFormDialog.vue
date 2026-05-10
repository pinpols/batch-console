<template>
  <el-dialog
    :model-value="modelValue"
    :title="editing ? `编辑租户:${form.tenantId}` : '新增租户'"
    width="520px"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
      <el-form-item label="tenantId" prop="tenantId">
        <el-input v-model="form.tenantId" :disabled="editing" placeholder="例如:acme-prod" />
        <div class="form-hint">小写字母、数字、短横线;长度 2–64;首尾需为字母或数字。</div>
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
        <el-form-item label="操作账号" prop="username">
          <el-input
            v-model="form.username"
            placeholder="初始操作账号用户名(ROLE_TENANT_USER)"
            maxlength="128"
          />
          <div class="form-hint">字母、数字、._- ,至少 2 个字符。</div>
        </el-form-item>
        <el-form-item label="初始密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="至少 8 个字符"
            maxlength="256"
          />
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
    (e: 'saved'): void
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
          rules.required('操作账号必填'),
          rules.pattern(/^[a-zA-Z0-9][a-zA-Z0-9._-]+$/, '字母/数字/._- 组合,至少 2 个字符'),
          rules.minLength(2),
        ],
        password: [rules.required('初始密码必填'), rules.minLength(8)],
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
      if (editing.value) {
        await updateTenant(form.tenantId, {
          tenantName: form.tenantName.trim(),
          description: form.description || undefined,
        })
        ElMessage.success('已更新')
      } else {
        await createTenant({
          tenantId: form.tenantId.trim(),
          tenantName: form.tenantName.trim(),
          description: form.description || undefined,
          username: form.username.trim(),
          password: form.password,
        })
        ElMessage.success('已创建')
      }
      emit('saved')
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
  }
</style>
