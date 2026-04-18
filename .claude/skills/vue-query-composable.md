# Vue Query Composable Generation

Generate a TanStack Vue Query composable following the project's established pattern.

## File Location

`src/composables/queries/use{EntityName}.ts`

## Template

```typescript
import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { xxxApi } from '@/api/xxx'           // or import { queryXxx } from '@/api/queries/xxx'
import { useTenantStore } from '@/stores/tenant'

/**
 * 获取当前租户的全量 {Entity} 列表，30s 内缓存不重复请求。
 * queryKey 包含 tenantId，切换租户自动重新获取。
 */
export function use{EntityName}() {
  const tenant = useTenantStore()

  return useQuery({
    queryKey: computed(() => ['{query-key}', tenant.tenantId]),
    queryFn: () => xxxApi.listXxx(tenant.tenantId),
  })
}
```

## Conventions

1. **queryKey**: always a `computed` that includes `tenant.tenantId` — ensures automatic refetch on tenant switch
2. **queryKey format**: `['entity-name', tenantId]` — kebab-case, descriptive
3. **queryFn**: calls the API module's list method, passing `tenant.tenantId`
4. **No extra options**: rely on the global VueQuery defaults (30s staleTime set in `src/main.ts` or plugin)
5. **Return**: directly return `useQuery(...)` — let the consumer destructure `{ data, isPending, isFetching, refetch }`
6. **Naming**: `use` + PascalCase entity name (e.g. `useJobDefinitions`, `useWorkers`, `useAlerts`)

## When to Add Extra Parameters

If the composable needs a reactive filter (e.g. `workflowDefinitionId`), accept it as a `Ref` or `computed` and include it in the queryKey:

```typescript
import type { Ref } from 'vue'

export function useWorkflowNodes(workflowDefinitionId: Ref<number | undefined>) {
  const tenant = useTenantStore()

  return useQuery({
    queryKey: computed(() => ['workflow-nodes', tenant.tenantId, workflowDefinitionId.value]),
    queryFn: () => queryWorkflowNodes(tenant.tenantId, workflowDefinitionId.value),
    enabled: computed(() => workflowDefinitionId.value != null),
  })
}
```

## Existing Composables (for reference)

- `useJobDefinitions` — `jobApi.listDefinitions(tenantId)`
- `useWorkers` — `queryWorkers(tenantId)`
- `useConsoleMeta` — metadata/enums