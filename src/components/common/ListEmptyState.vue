<template>
  <!-- 有筛选时是“筛选无结果”，给重置入口；否则才按“还没有数据”展示并引导下一步 -->
  <EmptyState
    v-if="filtered"
    variant="filter-empty"
    :title="t('empty.filterTitle')"
    :description="filteredDescription || t('empty.filterDescription')"
    :image-size="imageSize"
  >
    <template #action>
      <el-button plain :icon="RotateCcw" @click="emit('reset')">
        {{ t('common.reset') }}
      </el-button>
    </template>
  </EmptyState>
  <EmptyState
    v-else
    variant="tenant-empty"
    :title="title"
    :description="description"
    :image-size="imageSize"
  >
    <template v-if="slots.action || actionText" #action>
      <slot name="action">
        <el-button type="primary" :icon="actionIcon" @click="actionTo && router.push(actionTo)">
          {{ actionText }}
        </el-button>
      </slot>
    </template>
  </EmptyState>
</template>

<script setup lang="ts">
  import { useSlots, type Component } from 'vue'
  import { useRouter } from 'vue-router'
  import { useI18n } from 'vue-i18n'
  import { RotateCcw } from '@lucide/vue'
  import EmptyState from '@/components/common/EmptyState.vue'

  /**
   * 列表空态：区分“筛选后无结果”和“租户还没有数据”。
   * 前者给“重置”，后者沿用页面传入的标题、说明和下一步引导（actionText/actionTo，或 action 插槽）。
   */
  withDefaults(
    defineProps<{
      /** 当前是否有收窄结果的筛选 */
      filtered: boolean
      title?: string
      description?: string
      /** 筛选无结果时的说明，默认通用文案 */
      filteredDescription?: string
      imageSize?: number
      /** “还没有数据”时的下一步按钮 */
      actionText?: string
      actionTo?: string
      actionIcon?: Component
    }>(),
    {
      title: '',
      description: '',
      filteredDescription: '',
      imageSize: 80,
      actionText: '',
      actionTo: '',
      actionIcon: undefined,
    },
  )
  const emit = defineEmits<{ reset: [] }>()
  const slots = useSlots()
  const router = useRouter()
  const { t } = useI18n({ useScope: 'global' })
</script>
