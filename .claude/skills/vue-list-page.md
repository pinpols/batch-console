# Vue List Page Scaffolding

Generate a new list page following the project's established patterns.

## Page Structure

```
<PageContainer>
  <PageHeader title="..." description="..." />
  <SectionCard>
    <ProTable :data :loading :total v-model:page v-model:page-size @change>
      <template #query>
        <ListPageQueryBar :model :filter-busy :refresh-busy :disabled @search @reset @refresh>
          <!-- el-form-item filters here -->
        </ListPageQueryBar>
      </template>
      <!-- el-table-column definitions -->
      <!-- action column with <div class="table-actions"> wrapper -->
    </ProTable>
  </SectionCard>
</PageContainer>
```

## Component Imports

```typescript
import PageContainer from '@/components/common/PageContainer.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import SectionCard from '@/components/common/SectionCard.vue'
import ListPageQueryBar from '@/components/table/ListPageQueryBar.vue'
import ProTable from '@/components/table/ProTable.vue'
import StatusTag from '@/components/common/StatusTag.vue'       // for boolean/enum columns
import CopyableText from '@/components/common/CopyableText.vue' // for ID/code columns
import HelpLabel from '@/components/common/HelpLabel.vue'       // for filter labels with tooltip
```

## Script Setup Pattern

```typescript
<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { toPageResult } from '@/api/adapters'
import { useListFilterFeedback } from '@/composables/useListFilterFeedback'
import { useXxxData } from '@/composables/queries/useXxx'      // TanStack Vue Query composable
import { useTenantStore } from '@/stores/tenant'

const tenant = useTenantStore()
const page = ref(1)
const pageSize = ref(20)

// Filters — reactive object, all optional, strings default to ''
const filters = reactive({
  someCode: '',
  enabled: undefined as boolean | undefined,
})

// Data source — TanStack Vue Query
const { data: allData, isPending, isFetching, refetch } = useXxxData()

// Loading states
const remoteBlocking = computed(() => isPending.value || isFetching.value)
const { filterBusy: queryActionBusy, tableBlocking, runSearch, runReset } =
  useListFilterFeedback(remoteBlocking)

// Client-side filtering
const filtered = computed(() => {
  const list = allData.value ?? []
  return list.filter((row) => {
    if (filters.someCode.trim() && !row.someCode?.includes(filters.someCode.trim())) return false
    if (filters.enabled != null && row.enabled !== filters.enabled) return false
    return true
  })
})

const total = computed(() => filtered.value.length)
const tableRows = computed(() => {
  const pr = toPageResult(filtered.value, page.value, pageSize.value)
  return pr.records as unknown as Record<string, unknown>[]
})

// Actions
function onSearch() {
  return runSearch(() => { page.value = 1 })
}

function reset() {
  return runReset(() => {
    filters.someCode = ''
    filters.enabled = undefined
    page.value = 1
  })
}
</script>
```

## ProTable Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `Record<string, unknown>[]` | required | Current page rows |
| `loading` | `boolean` | `false` | Show loading overlay |
| `total` | `number` | required | Total filtered count |
| `page` | `number` | required | 1-based current page (v-model) |
| `pageSize` | `number` | required | Items per page (v-model) |
| `border` | `boolean` | `true` | Show cell borders |
| `emptyText` | `string` | `'暂无数据'` | Empty state text |
| `filteredEmptyText` | `string` | auto | Empty text when filters active |
| `hasActiveFilters` | `boolean` | `false` | Toggle empty text variant |
| `skeletonRows` | `number` | `6` | Skeleton rows on first load |

## Common Column Patterns

- **Code/ID columns**: wrap with `<CopyableText :text="row.xxx" />`
- **Boolean columns**: use `<StatusTag :value="String(row.xxx)" category="yn" />`
- **Enum columns**: use `<StatusTag :value="row.xxx" category="xxxStatus" />`
- **Action columns**: `min-width="260" fixed="right"`, buttons inside `<div class="table-actions">`
- **Filter dropdowns**: use `el-select` with `clearable`, `style="width: 120px"`

## Router Registration

Add route in `src/router/index.ts` following existing pattern:
```typescript
{ path: '/section/page-name', component: () => import('@/views/section/PageName.vue') }
```