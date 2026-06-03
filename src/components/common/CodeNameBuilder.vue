<template>
  <div class="code-name-builder">
    <div class="cnb-row">
      <el-select
        v-model="domain"
        class="cnb-domain"
        :placeholder="t('codeNameBuilder.domainLabel')"
      >
        <el-option v-for="d in DOMAINS" :key="d" :label="d" :value="d" />
      </el-select>
      <span class="cnb-sep">_</span>
      <el-input
        v-model="biz"
        class="cnb-biz"
        :placeholder="t('codeNameBuilder.bizPlaceholder')"
        maxlength="30"
        show-word-limit
        @input="onBizInput"
      />
      <span class="cnb-sep">_</span>
      <el-input
        v-model="version"
        class="cnb-version"
        :placeholder="t('codeNameBuilder.versionPlaceholder')"
        maxlength="6"
      />
    </div>
    <div class="cnb-preview" :class="{ 'cnb-preview--err': !ok && biz }">
      <span class="cnb-preview__label">{{ t('codeNameBuilder.previewLabel') }}:</span>
      <code>{{ finalCode || '—' }}</code>
      <span v-if="!ok && biz" class="cnb-preview__err">{{ errMsg }}</span>
    </div>
    <div v-if="similar.length > 0" class="cnb-similar">
      {{ t('codeNameBuilder.bizHint') }}
      <span>{{ t('codeNameBuilder.existingPrefix', { list: similar.slice(0, 3).join(' / ') }) }}</span>
    </div>
    <div v-else class="cnb-hint">{{ t('codeNameBuilder.bizHint') }}</div>
  </div>
</template>

<script setup lang="ts">
  /**
   * 资源 code 命名向导(jobCode / workflowCode / templateCode / channelCode 通用)。
   *
   * 3 段:DOMAIN 下拉(5 固定) + 业务名 input(自动转大写 + 非法字符转 _) + 可选版本。
   * 实时拼接为 `{DOMAIN}_{BIZ}[_v{N}]`,emit 给父组件。可选 existingCodes 显示同前缀已有,
   * 帮助避免重名 / 跟现有命名风格保持一致。
   */
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'

  const { t } = useI18n({ useScope: 'global' })

  const DOMAINS = ['IMPORT', 'EXPORT', 'PROCESS', 'DISPATCH', 'WORKFLOW']
  const BIZ_RE = /^[A-Z][A-Z0-9_]{2,29}$/

  const props = withDefaults(
    defineProps<{
      modelValue: string
      defaultDomain?: string
      /** 同业务域已存在的 code 列表(autocomplete 用) */
      existingCodes?: string[]
    }>(),
    { defaultDomain: 'IMPORT', existingCodes: () => [] },
  )

  const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

  const domain = ref(props.defaultDomain)
  const biz = ref('')
  const version = ref('')

  // 反解 modelValue:DOMAIN_BIZ[_vN]
  watch(
    () => props.modelValue,
    (v) => {
      if (!v || v === finalCode.value) return
      const m = /^([A-Z]+)_([A-Z][A-Z0-9_]*?)(?:_v(\d+))?$/.exec(v)
      if (m && DOMAINS.includes(m[1])) {
        domain.value = m[1]
        biz.value = m[2]
        version.value = m[3] ? `v${m[3]}` : ''
      } else {
        biz.value = v
      }
    },
    { immediate: true },
  )

  function onBizInput(v: string) {
    biz.value = v.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
  }

  const versionSuffix = computed(() => {
    if (!version.value.trim()) return ''
    const n = version.value.replace(/^v/i, '')
    if (!/^\d+$/.test(n)) return ''
    return `_v${n}`
  })

  const finalCode = computed(() => {
    if (!biz.value) return ''
    return `${domain.value}_${biz.value}${versionSuffix.value}`
  })

  const validation = computed(() => {
    if (!biz.value) return { ok: false, errMsg: '' }
    if (biz.value.length < 3 || biz.value.length > 30) {
      return { ok: false, errMsg: t('codeNameBuilder.errBizLength') }
    }
    if (!BIZ_RE.test(biz.value)) {
      return { ok: false, errMsg: t('codeNameBuilder.errBizFormat') }
    }
    return { ok: true, errMsg: '' }
  })

  const ok = computed(() => validation.value.ok)
  const errMsg = computed(() => validation.value.errMsg)

  const similar = computed(() => {
    if (!props.existingCodes?.length) return []
    const prefix = `${domain.value}_`
    return props.existingCodes.filter((c) => c.startsWith(prefix) && c !== finalCode.value)
  })

  watch(finalCode, (v) => emit('update:modelValue', v))
</script>

<style scoped>
  .code-name-builder {
    width: 100%;
  }
  .cnb-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .cnb-domain {
    width: 140px;
    flex-shrink: 0;
  }
  .cnb-biz {
    flex: 1;
    min-width: 0;
  }
  .cnb-version {
    width: 100px;
    flex-shrink: 0;
  }
  .cnb-sep {
    color: var(--color-text-tertiary);
    font-weight: 600;
    user-select: none;
  }
  .cnb-preview {
    margin-top: 6px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cnb-preview__label {
    color: var(--color-text-tertiary);
  }
  .cnb-preview code {
    font-family:
      ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
    color: var(--el-color-primary);
    font-weight: 600;
  }
  .cnb-preview--err code {
    color: var(--el-color-danger);
  }
  .cnb-preview__err {
    color: var(--el-color-danger);
  }
  .cnb-hint,
  .cnb-similar {
    margin-top: 4px;
    font-size: 12px;
    color: var(--color-text-tertiary);
  }
</style>
