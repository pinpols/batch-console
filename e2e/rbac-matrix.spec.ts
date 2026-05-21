/**
 * RBAC 5 真实角色 × 9 关键写接口 = 45 格矩阵。
 *
 * Why:Plan B 档全程用 admin 跑,4 个角色的权限边界从未验证。
 *     生产事故里"权限越权"是 P0 级安全事件。
 *
 * 5 角色 (ADR-032 2026-05 重设计,CONFIG_ADMIN 已合并到 ADMIN):
 *   ROLE_ADMIN          平台管理员(跨租户)
 *   ROLE_TENANT_ADMIN   租户管理员(本租户内,Service 层 enforceTenantScope 锁定)
 *   ROLE_AUDITOR        审计员(跨租户只读)
 *   ROLE_TENANT_USER    租户操作员(本租户,触发任务 + 自助)
 *   ROLE_USER           兼容旧 JWT,等同 TENANT_USER
 *
 * 矩阵约定:
 *   ✅ = 200/201/202   ❌ = 403
 *   ⚠️ = 404 / 业务 4xx (接口存在但资源不足以测真路径,不算授权失败)
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const API = process.env.BC_API_BASE || 'http://localhost:18080'

// 2026-05 角色重设计后 5 角色(CONFIG_ADMIN 已升 ADMIN,新加 TENANT_ADMIN):
// admin/auditor 跨租户,tenantAdmin/tenantUser/user 绑租户。storageState 由 global-setup.cjs 生成。
type RoleKey = 'admin' | 'tenantAdmin' | 'auditor' | 'tenantUser' | 'user'
const ROLE_KEYS: RoleKey[] = ['admin', 'tenantAdmin', 'auditor', 'tenantUser', 'user']
const ROLE_LABEL: Record<RoleKey, string> = {
  admin: 'ROLE_ADMIN',
  tenantAdmin: 'ROLE_TENANT_ADMIN',
  auditor: 'ROLE_AUDITOR',
  tenantUser: 'ROLE_TENANT_USER',
  user: 'ROLE_USER',
}
const ROLE_TENANT: Record<RoleKey, string> = {
  admin: 'system',
  tenantAdmin: 'ta', // TENANT_ADMIN 绑业务租户(tadmin-ta 账号在 ta 下)
  auditor: 'system',
  tenantUser: 'tx',
  user: 'tx',
}

// 期望矩阵:true = 允许 (期望 2xx);false = 拒绝 (期望 403)
// 注:这是基于 BE 当前 RBAC 设计的预期;若 BE 实际返不一致,有 2 种可能:
//   a) FE 描述的角色边界与 BE 实际不一致 → 报告 BE
//   b) 测试预期错 → 修预期 + 更新 [rbac_5roles_only] memory
type Endpoint = {
  key: string
  method: 'POST' | 'PUT' | 'DELETE'
  url: (tenantId: string) => string
  body?: () => Record<string, unknown>
  expect: Record<RoleKey, boolean>
  /** 测完成功后清理(避免脏数据) */
  cleanup?: (ctx: APIRequestContext, response: unknown) => Promise<void>
}

const ts = () => Date.now().toString(36)
const rand = () => Math.random().toString(36).slice(2, 8)
const e2ePrefix = () => `e2e-rbac-${ts()}-${rand()}`

// 期望矩阵基于 BE 实际 @PreAuthorize 配置(2026-05-18 核对 file-batch-system controllers)。
// 与原 plan 文档描述的"应当如何"可能有差异:差异会反映在测试结果里,作为 BE 设计审查输入。
const ENDPOINTS: Endpoint[] = [
  {
    // ConsoleTenantController.create() @PreAuthorize ROLE_ADMIN
    // CreateTenantRequest: tenantId/tenantName/username/password @NotBlank
    key: 'POST /tenants',
    method: 'POST',
    url: () => '/api/console/tenants',
    body: () => {
      const id = e2ePrefix()
      return {
        tenantId: id,
        tenantName: '[E2E RBAC] tenant create',
        description: 'rbac matrix test',
        username: 'op-' + id,
        password: 'admin12345',
      }
    },
    expect: { admin: true, tenantAdmin: false, auditor: false, tenantUser: false, user: false },
  },
  {
    // ConsoleResourceQueueController class-level @PreAuthorize ROLE_ADMIN
    key: 'POST /queues',
    method: 'POST',
    url: () => '/api/console/queues',
    body: () => ({
      tenantId: 'tx',
      queueCode: e2ePrefix(),
      queueName: '[E2E RBAC] queue',
      queueType: 'MIXED',
      maxRunningJobs: 1,
      fairShareWeight: 1,
      enabled: true,
    }),
    expect: { admin: true, tenantAdmin: false, auditor: false, tenantUser: false, user: false },
  },
  {
    // ConsoleQuotaPolicyController class-level @PreAuthorize ROLE_ADMIN
    key: 'POST /quota-policies',
    method: 'POST',
    url: () => '/api/console/quota-policies',
    body: () => ({
      tenantId: 'tx',
      policyCode: e2ePrefix(),
      maxRunningJobsPerTenant: 1,
      maxPartitionsPerTenant: 1,
      maxQpsPerTenant: 1,
      fairShareWeight: 1,
      enabled: true,
    }),
    expect: { admin: true, tenantAdmin: false, auditor: false, tenantUser: false, user: false },
  },
  {
    // ConsoleConfigController.POST /releases @PreAuthorize ROLE_ADMIN (方法级别)
    // ConfigReleaseUpsertRequest 字段:tenantId/configType/configKey/configName 全 @NotBlank
    key: 'POST /config/releases',
    method: 'POST',
    url: () => '/api/console/config/releases',
    body: () => ({
      tenantId: 'tx',
      configKey: e2ePrefix(),
      configName: '[E2E RBAC] release ' + rand(),
      configType: 'JSON',
      operatorId: 'admin',
    }),
    expect: { admin: true, tenantAdmin: false, auditor: false, tenantUser: false, user: false },
  },
  {
    // ConsoleJobDefinitionController class-level @PreAuthorize ROLE_ADMIN
    key: 'POST /job-definitions',
    method: 'POST',
    url: () => '/api/console/job-definitions',
    body: () => ({
      tenantId: 'tx',
      jobCode: e2ePrefix(),
      jobName: '[E2E RBAC] job',
      jobType: 'GENERAL',
      scheduleType: 'MANUAL',
      executionMode: 'FULL',
      enabled: true,
    }),
    expect: { admin: true, tenantAdmin: false, auditor: false, tenantUser: false, user: false },
  },
  {
    // ConsoleApiKeyController class-level @PreAuthorize hasAnyAuthority(ADMIN, TENANT_USER)
    // create() 用 @RequestParam("tenantId"),在 query 不在 body
    key: 'POST /api-keys',
    method: 'POST',
    url: () => '/api/console/api-keys?tenantId=tx',
    body: () => ({ keyName: e2ePrefix() }),
    expect: { admin: true, tenantAdmin: false, auditor: false, tenantUser: true, user: false },
  },
  {
    // ConsoleUserAccountController class-level @PreAuthorize hasAnyAuthority('ROLE_ADMIN','ROLE_TENANT_ADMIN')
    // (ADR-032):TENANT_ADMIN 可在本租户加员工,Service 层 enforceTenantScope 强制 tenantId=principal.tenantId
    key: 'POST /users',
    method: 'POST',
    url: () => '/api/console/users',
    body: () => ({
      username: e2ePrefix(),
      password: 'admin123',
      displayName: '[E2E RBAC]',
      tenantId: 'tx',
      authoritiesCsv: 'ROLE_TENANT_USER',
    }),
    expect: { admin: true, tenantAdmin: true, auditor: false, tenantUser: false, user: false },
  },
  {
    // ConsoleSelfServiceJobController class-level @PreAuthorize hasAnyAuthority(ADMIN, TENANT_USER)
    // RerunRequest: tenantId/jobCode/bizDate @NotBlank
    key: 'POST /self-service/rerun-request',
    method: 'POST',
    url: () => '/api/console/self-service/jobs/rerun-request',
    body: () => ({
      tenantId: 'tx',
      jobCode: 'nonexistent-job-' + rand(),
      bizDate: '2026-05-18',
      reason: '[E2E RBAC] rerun',
    }),
    expect: { admin: true, tenantAdmin: false, auditor: false, tenantUser: true, user: false },
  },
  {
    // ConsoleAlertRoutingController class-level @PreAuthorize ROLE_ADMIN
    key: 'POST /alert-routings',
    method: 'POST',
    url: () => '/api/console/alert-routings',
    body: () => ({
      tenantId: 'tx',
      routeCode: e2ePrefix(),
      routeName: '[E2E RBAC] route',
      severity: 'ERROR',
      team: 'e2e',
      receiver: 'e2e@example.com',
    }),
    expect: { admin: true, tenantAdmin: false, auditor: false, tenantUser: false, user: false },
  },
]

// 业务 4xx 也视为"通过"——只要不是 403 即可
function isAuthorized(status: number): boolean {
  // 403 = 拒绝;其余(包括 200/201/202/400/404/409/500)都表示"接口能调到"
  return status !== 403
}
function isDenied(status: number): boolean {
  return status === 403
}

for (const role of ROLE_KEYS) {
  test.describe(`RBAC: ${ROLE_LABEL[role]}`, () => {
    test.use({
      storageState: path.resolve(__dirname, `.auth/role-${role}.json`),
    })

    for (const ep of ENDPOINTS) {
      const expected = ep.expect[role]
      const verdict = expected ? '✅ 允许' : '❌ 拒绝'
      test(`${ep.key} → 期望 ${verdict}`, async ({ request }) => {
        const url = ep.url(ROLE_TENANT[role])
        const idemKey = `e2e-rbac-${ts()}-${rand()}`
        const init: Parameters<typeof request.post>[1] = {
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Id': ROLE_TENANT[role],
            'Idempotency-Key': idemKey,
          },
          data: ep.body ? ep.body() : undefined,
          failOnStatusCode: false,
        }
        let res
        if (ep.method === 'POST') res = await request.post(url, init)
        else if (ep.method === 'PUT') res = await request.put(url, init)
        else res = await request.delete(url, init)

        const status = res.status()
        const body = await res.text().catch(() => '')
        const ctx = `${role} → ${ep.method} ${url}\n  status=${status}\n  body=${body.slice(0, 200)}`

        if (expected) {
          // 允许:不应 403。其他 4xx/5xx 表示业务错或资源不足,不算授权失败。
          expect(isDenied(status), `期望非 403,实际:\n${ctx}`).toBe(false)
        } else {
          // 拒绝:必须 403。若 BE 返 200 就是越权 bug。
          expect(status, `期望 403,实际:\n${ctx}`).toBe(403)
        }
      })
    }
  })
}

test.describe('跨租户越权', () => {
  test.use({
    storageState: path.resolve(__dirname, '.auth/role-tenantUser.json'),
  })

  test('TENANT_USER 用自身 cookie 调他租户的写接口 → 应 403/404 不应 200', async ({ request }) => {
    // op-tx 属 tx 租户,试图操作 ta 的资源
    const res = await request.post('/api/console/queues', {
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': 'ta',
        'Idempotency-Key': `e2e-cross-tenant-${ts()}`,
      },
      data: {
        tenantId: 'ta',
        queueCode: e2ePrefix(),
        queueName: '[E2E cross-tenant]',
        queueType: 'MIXED',
        maxRunningJobs: 1,
        fairShareWeight: 1,
      },
      failOnStatusCode: false,
    })
    expect([403, 404].includes(res.status()), `cross-tenant write 应拒绝,实际 ${res.status()}`).toBe(true)
  })
})
