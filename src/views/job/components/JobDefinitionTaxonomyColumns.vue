<template>
  <el-table-column
    v-if="props.isColVisible('triggerMode')"
    prop="triggerMode"
    :label="t('jobDefinitionList.colTriggerMode')"
    width="125"
  >
    <template #default="{ row }">
      <JobDefinitionTaxonomyCell :value="row.triggerMode" />
    </template>
  </el-table-column>
  <el-table-column
    v-if="props.isColVisible('dependsOnJobCode')"
    prop="dependsOnJobCode"
    :label="t('jobDefinitionList.colDependency')"
    min-width="150"
    show-overflow-tooltip
  >
    <template #default="{ row }">
      <JobDefinitionTaxonomyCell
        :value="row.dependsOnJobCode || t('jobDefinitionList.noDependency')"
        :muted="!row.dependsOnJobCode"
      />
    </template>
  </el-table-column>
</template>

<script setup lang="ts">
  import { useI18n } from 'vue-i18n'
  import JobDefinitionTaxonomyCell from './JobDefinitionTaxonomyCell.vue'

  const props = defineProps<{
    isColVisible: (key: string) => boolean
  }>()
  const { t } = useI18n({ useScope: 'global' })
</script>
