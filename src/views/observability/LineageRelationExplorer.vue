<template>
  <section class="lineage-relations" aria-labelledby="lineage-relations-title">
    <h3 id="lineage-relations-title">{{ t('lineageEvidence.relationsTitle') }}</h3>
    <p>{{ t('lineageEvidence.relationsHint') }}</p>
    <el-select
      v-model="selectedKey"
      filterable
      :aria-label="t('lineageEvidence.selectRecord')"
      class="lineage-relations__select"
    >
      <el-option
        v-for="node in graph.nodes"
        :key="node.key"
        :label="nodeLabel(node)"
        :value="node.key"
      />
    </el-select>
    <template v-if="selected">
      <h4>{{ nodeLabel(selected) }}</h4>
      <p v-if="!selectedRelations.length">{{ t('lineageEvidence.noConfirmedLinks') }}</p>
      <ul v-else>
        <li
          v-for="relation in selectedRelations"
          :key="`${relation.from}-${relation.field}-${relation.to}`"
        >
          <el-button link type="primary" @click="selectedKey = relation.from">{{
            labelFor(relation.from)
          }}</el-button>
          <span> · {{ relation.field }} → </span>
          <el-button link type="primary" @click="selectedKey = relation.to">{{
            labelFor(relation.to)
          }}</el-button>
        </li>
      </ul>
      <ul v-if="selectedUnresolved.length" class="lineage-relations__unresolved">
        <li v-for="item in selectedUnresolved" :key="`${item.from}-${item.field}`">
          {{ item.field }}<span v-if="item.reference"> #{{ item.reference }}</span> ·
          {{ t(`lineageEvidence.relationIssues.${item.reason}`) }}
        </li>
      </ul>
      <JsonPreview :data="selected.data" />
    </template>
  </section>
</template>
<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { LineageEvidence } from '@/api/lineage'
  import JsonPreview from '@/components/common/JsonPreview.vue'
  import { buildLineageRelations, type LineageNode } from './lineageRelations'

  const props = defineProps<{ evidence: LineageEvidence }>()
  const { t } = useI18n()
  const graph = computed(() => buildLineageRelations(props.evidence))
  const selectedKey = ref('')
  watch(
    () => props.evidence,
    () => {
      selectedKey.value = graph.value.nodes[0]?.key ?? ''
    },
    { immediate: true },
  )
  const selected = computed(() => graph.value.nodes.find((node) => node.key === selectedKey.value))
  const selectedRelations = computed(() =>
    graph.value.relations.filter(
      (relation) => relation.from === selectedKey.value || relation.to === selectedKey.value,
    ),
  )
  const selectedUnresolved = computed(() =>
    graph.value.unresolved.filter((item) => item.from === selectedKey.value),
  )
  function nodeLabel(node: LineageNode) {
    const names = {
      version: 'resultVersionTitle',
      job: 'jobInstanceTitle',
      pipeline: 'pipelineInstances',
      file: 'fileRecords',
      dispatch: 'dispatchRecords',
    } as const
    return `${t(`lineageEvidence.${names[node.type]}`)} ${node.id ? `#${node.id}` : t('lineageEvidence.idUnavailable')}`
  }
  function labelFor(key: string) {
    const node = graph.value.nodes.find((item) => item.key === key)
    return node ? nodeLabel(node) : key
  }
</script>
<style scoped>
  .lineage-relations {
    margin: var(--space-md) 0;
    padding: var(--space-md);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-content);
  }
  .lineage-relations h3 {
    margin: 0;
  }
  .lineage-relations p {
    color: var(--color-text-secondary);
  }
  .lineage-relations__select {
    width: min(100%, 420px);
  }
  .lineage-relations li {
    overflow-wrap: anywhere;
  }
</style>
