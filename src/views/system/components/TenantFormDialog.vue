<template>
  <el-dialog
    :model-value="modelValue"
    :title="editing ? `编辑租户:${form.tenantId}` : '新增租户'"
    width="520px"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <el-form label-width="100px">
      <el-form-item label="tenantId" required>
        <el-input v-model="form.tenantId" :disabled="editing" placeholder="例如:acme-prod" />
        <div class="form-hint">小写字母、数字、短横线;长度 2–64;首尾需为字母或数字。</div>
      </el-form-item>
      <el-form-item label="名称" required>
        <el-input v-model="form.tenantName" placeholder="租户显示名称" maxlength="256" />
      </el-form-item>
      <el-form-item label="描述">
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
        <el-form-item label="操作账号" required>
          <el-input
            v-model="form.username"
            placeholder="初始操作账号用户名(ROLE_TENANT_USER)"
            maxlength="128"
          />
          <div class="form-hint">字母、数字、._- ,至少 2 个字符。</div>
        </el-form-item>
        <el-form-item label="初始密码" required>
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
  import { reactive, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import { createTenant, updateTenant, type Tenant } from '@/api/tenants'

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
    if (!editing.value) {
      if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(form.tenantId)) {
        ElMessage.warning('tenantId 格式非法:小写字母 / 数字 / 短横线,长度 2–64')
        return
      }
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(form.username) || form.username.length < 2) {
        ElMessage.warning('操作账号用户名格式非法:字母 / 数字 / ._- ,至少 2 个字符')
        return
      }
      if (form.password.length < 8) {
        ElMessage.warning('初始密码至少 8 个字符')
        return
      }
    }
    if (!form.tenantName.trim()) {
      ElMessage.warning('名称不能为空')
      return
    }
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
