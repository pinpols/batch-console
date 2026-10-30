import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import type { APIRequestContext } from '@playwright/test'
import { expect, csrfHeaders } from '../../support/app'
import { requiredEnvironment } from '../closure-recovery/fixture'
import { WorkflowBulkFixture } from '../workflow-bulk/fixture'

/** 无Job副作用的控制图验收；业务动作走API，SQL只准备身份/回读/精确清理。 */
export class ControlProgressFixture extends WorkflowBulkFixture {
  readonly adminName = `progress-admin-${randomUUID()}`
  readonly readerName = `progress-reader-${randomUUID()}`
  readonly password = randomBytes(24).toString('base64url')
  private accountIds: number[] = []
  private prepared = false

  prepare() {
    this.run('prepare')
    this.prepared = true
    const passwordHash = this.hashPassword()
    this.accountIds = this.ownedSql<number[]>('credentials-prepare', {
      password_hash: passwordHash,
    })
  }

  private hashPassword(): string {
    const workspace = resolve(__dirname, '../../..')
    const jar = resolve(
      process.env.E2E_CONSOLE_JAR ??
        resolve(workspace, '../file-batch-system/build/runtime-jars/console.jar'),
    )
    const scratch = mkdtempSync(join(tmpdir(), 'runtime-progress-password-'))
    try {
      execFileSync(
        'unzip',
        [
          '-q',
          jar,
          'BOOT-INF/lib/*',
          'BOOT-INF/classes/io/github/pinpols/batch/console/domain/rbac/support/ConsolePasswordHasher.class',
          '-d',
          scratch,
        ],
        { timeout: 30_000 },
      )
      const classpath = [join(scratch, 'BOOT-INF/classes'), join(scratch, 'BOOT-INF/lib/*')].join(
        delimiter,
      )
      return execFileSync('java', ['-cp', classpath, join(__dirname, 'PasswordHash.java')], {
        env: { ...process.env, E2E_PROGRESS_PASSWORD: this.password },
        timeout: 30_000,
        encoding: 'utf8',
      }).trim()
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  }

  protected ownedSql<T>(
    script:
      | 'credentials-prepare'
      | 'credentials-cleanup'
      | 'pipeline-prepare'
      | 'pipeline-advance'
      | 'pipeline-cleanup'
      | 'batchday-prepare'
      | 'batchday-state'
      | 'batchday-cleanup'
      | 'atomic-config-state'
      | 'atomic-config-cleanup'
      | 'result-version-prepare'
      | 'result-version-state'
      | 'result-version-cleanup'
      | 'workflow-version-state'
      | 'workflow-version-tenant-prepare'
      | 'workflow-version-tenant-cleanup'
      | 'persistent-waits-prepare'
      | 'persistent-waits-seed'
      | 'persistent-waits-state'
      | 'persistent-waits-cleanup'
      | 'persistent-waits-accounts-cleanup'
      | 'manual-upload-roles-prepare'
      | 'manual-upload-target-prepare'
      | 'manual-upload-state'
      | 'manual-upload-cleanup'
      | 'scheduler-waits-seed'
      | 'scheduler-waits-make-due'
      | 'scheduler-waits-state'
      | 'scheduler-waits-cleanup'
      | 'scheduler-waits-definitions-cleanup'
      | 'scheduler-waits-release-seed'
      | 'scheduler-waits-release-make-due'
      | 'quartz-progress-prepare'
      | 'quartz-progress-state'
      | 'quartz-progress-cleanup'
      | 'multi-calendar-progress-prepare'
      | 'multi-calendar-progress-state'
      | 'export-replay-prepare'
      | 'export-replay-state'
      | 'export-replay-cleanup'
      | 'process-worker-prepare'
      | 'process-worker-state'
      | 'process-worker-cleanup'
      | 'process-business-state'
      | 'process-platform-cleanup'
      | 'dispatch-worker-state'
      | 'dispatch-worker-cleanup'
      | 'worker-progress-state'
      | 'worker-progress-cleanup'
      | 'import-worker-prepare'
      | 'import-worker-state'
      | 'import-worker-cleanup'
      | 'workflow-replay-prepare'
      | 'workflow-replay-repair'
      | 'workflow-replay-input-state'
      | 'workflow-replay-state'
      | 'workflow-replay-cleanup'
      | 'workflow-replay-residue'
      | 'workflow-replay-final-cleanup'
      | 'oidc-identity-state'
      | 'oidc-identity-cleanup'
      | 'forensic-export-state'
      | 'forensic-export-cleanup',
    extra: Record<string, string> = {},
    database = requiredEnvironment('E2E_CLOSURE_PG_DATABASE'),
  ): T {
    const args = [
      'exec',
      '-i',
      requiredEnvironment('E2E_CLOSURE_PG_CONTAINER'),
      'psql',
      '-X',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      requiredEnvironment('E2E_CLOSURE_PG_USER'),
      '-d',
      database,
    ]
    const values = {
      tenant_id: this.tenantId,
      calendar_code: this.calendarCode,
      admin_name: this.adminName,
      reader_name: this.readerName,
      account_ids: this.accountIds.join(','),
      ...extra,
    }
    for (const [name, value] of Object.entries(values)) args.push('-v', `${name}=${value}`)
    const output = execFileSync('docker', args, {
      input: readFileSync(join(__dirname, 'sql', `${script}.sql`), 'utf8'),
      encoding: 'utf8',
      timeout: 30_000,
    }).trim()
    return JSON.parse(output) as T
  }

  workflowVersionSnapshots() {
    return this.ownedSql<
      Array<{
        workflowDefinitionId: number
        version: number
        nodes: Array<Record<string, unknown>>
        edges: Array<Record<string, unknown>>
      }>
    >('workflow-version-state')
  }

  prepareWorkflowVersionTenant(tenantId: string) {
    return this.ownedSql<{ tenantId: string }>('workflow-version-tenant-prepare', {
      other_tenant_id: tenantId,
    })
  }

  cleanupWorkflowVersionTenant(tenantId: string) {
    return this.ownedSql<{ tenantRowsRemaining: number }>('workflow-version-tenant-cleanup', {
      other_tenant_id: tenantId,
    })
  }

  async login(request: APIRequestContext, reader = false) {
    const response = await request.post('/api/console/auth/login', {
      headers: { 'X-Tenant-Id': reader ? this.tenantId : 'system' },
      data: { username: reader ? this.readerName : this.adminName, password: this.password },
    })
    expect(response.status(), '独占验收身份必须通过真实认证').toBe(200)
    expect((await request.get('/api/console/auth/check')).status()).toBe(204)
  }

  async mutate(
    request: APIRequestContext,
    path: string,
    data?: object,
    method = 'POST',
    params: Record<string, string> = {},
  ) {
    return request.fetch(path, {
      method,
      params: { tenantId: this.tenantId, ...params },
      data,
      headers: {
        ...(await csrfHeaders(request)),
        'X-Tenant-Id': this.tenantId,
        'Idempotency-Key': randomUUID(),
      },
    })
  }

  async finish(request: APIRequestContext, reader?: APIRequestContext) {
    if (!this.prepared) return {}
    for (const run of this.state().runs) {
      if (run.status === 'PAUSED')
        expect(
          (await this.mutate(request, `/api/console/workflow-runs/${run.id}/resume`, {})).status(),
        ).toBe(200)
      if (!['SUCCESS', 'FAILED', 'TERMINATED'].includes(run.status))
        expect(
          (
            await this.mutate(request, `/api/console/workflow-runs/${run.id}/terminate`, {})
          ).status(),
        ).toBe(200)
    }
    await expect
      .poll(
        () =>
          this.state().runs.every((run) =>
            ['SUCCESS', 'FAILED', 'TERMINATED'].includes(run.status),
          ),
        { timeout: 45_000 },
      )
      .toBe(true)
    if (reader) await this.mutate(reader, '/api/console/auth/logout', {})
    await this.mutate(request, '/api/console/auth/logout', {})
    const credentialAccounts = this.ownedSql<number>('credentials-cleanup')
    expect(credentialAccounts, '本例凭据账户必须清零').toBe(0)
    return { ...this.cleanup(), credentialAccounts }
  }
}

/** SQL仅驱动独占流水线的传输/投影夹具，不能代替Worker业务验收。 */
export class PipelineProgressFixture extends ControlProgressFixture {
  private pipelineIds: number[] = []
  preparePipeline() {
    const result = this.ownedSql<{ pipelineId: number; stepId: number }>('pipeline-prepare')
    this.pipelineIds = [result.pipelineId]
    return result
  }
  advancePipeline() {
    return this.ownedSql<{ status: string; rows: number }>('pipeline-advance', {
      pipeline_ids: this.pipelineIds.join(','),
    })
  }
  override async finish(request: APIRequestContext, reader?: APIRequestContext) {
    const pipelines = this.ownedSql<number>('pipeline-cleanup', {
      pipeline_ids: this.pipelineIds.join(','),
    })
    expect(pipelines, '独占Pipeline与步骤/位点残留必须为0').toBe(0)
    return { ...(await super.finish(request, reader)), pipelineRows: pipelines }
  }
}

/** 验收真实 Quartz 计划投影、定时运行及租户当日进度推送；只清理本例定义的调度副作用。 */
export class QuartzDailyProgressFixture extends ControlProgressFixture {
  private scheduledWorkflowDefinitionId = 0
  private readonly scheduledWorkflowDefinitionIds = new Set<number>()

  configureCurrentBusinessCalendar() {
    return this.ownedSql<{ updatedRows: number }>('quartz-progress-prepare')
  }

  rememberScheduledWorkflow(id: number) {
    if (Number.isSafeInteger(id) && id > 0) {
      this.scheduledWorkflowDefinitionId = id
      this.scheduledWorkflowDefinitionIds.add(id)
    }
  }

  quartzProgressState() {
    return this.ownedSql<{
      definitionVersion: number | null
      occurrences: Array<{ status: string; bizDate: string | null; scheduledFireTime: string }>
      coverage: {
        scheduleVersion: number
        coverageThrough: string
        lastSuccessAt: string
      } | null
    }>('quartz-progress-state', {
      workflow_definition_id: String(this.scheduledWorkflowDefinitionId),
    })
  }

  async disableScheduledWorkflow(request: APIRequestContext) {
    for (const id of this.scheduledWorkflowDefinitionIds) {
      const response = await this.mutate(
        request,
        `/api/console/workflow-definitions/${id}/schedule-enabled`,
        { tenantId: this.tenantId, enabled: false },
        'PATCH',
      )
      expect(response.status(), '关闭本例 Quartz 定时任务').toBe(200)
    }
  }

  override cleanup() {
    const scheduleCleanup: Record<string, number> = {}
    for (const id of this.scheduledWorkflowDefinitionIds) {
      const cleaned = this.ownedSql<Record<string, number>>('quartz-progress-cleanup', {
        workflow_definition_id: String(id),
      })
      for (const [key, count] of Object.entries(cleaned))
        scheduleCleanup[key] = (scheduleCleanup[key] ?? 0) + count
    }
    expect(
      Object.values(scheduleCleanup).every((count) => count === 0),
      `本例Quartz计划和覆盖水位必须精确清零: ${JSON.stringify(scheduleCleanup)}`,
    ).toBe(true)
    return { ...super.cleanup(), ...scheduleCleanup }
  }
}

/** 为 readiness 与容量等待安全投影验收准备真实持久行和四角色身份。 */
export class PersistentWaitFixture extends ControlProgressFixture {
  readonly auditorName = `wait-auditor-${randomUUID()}`
  readonly userName = `wait-user-${randomUUID()}`
  readonly readinessRequestId = `wait-readiness-${randomUUID()}`
  readonly capacityRequestId = `wait-capacity-${randomUUID()}`
  workflowDefinitionId = 0
  workflowCode = ''
  private roleAccountsPrepared = false
  private waitsSeeded = false

  prepareWaitRoles() {
    const result = this.ownedSql<{ roleAccountsCreated: number }>('persistent-waits-prepare', {
      auditor_name: this.auditorName,
      user_name: this.userName,
    })
    this.roleAccountsPrepared = true
    expect(result.roleAccountsCreated).toBe(2)
  }

  seedWaits(workflowDefinitionId: number, workflowCode: string) {
    this.workflowDefinitionId = workflowDefinitionId
    this.workflowCode = workflowCode
    this.waitsSeeded = true
    const result = this.ownedSql<{ readinessCount: number; capacityCount: number }>(
      'persistent-waits-seed',
      {
        workflow_definition_id: String(workflowDefinitionId),
        workflow_code: workflowCode,
        biz_date: this.bizDate,
        readiness_request_id: this.readinessRequestId,
        capacity_request_id: this.capacityRequestId,
      },
    )
    expect(result).toEqual({ readinessCount: 1, capacityCount: 1 })
  }

  persistentWaitState() {
    return this.ownedSql<{
      readinessCount: number
      capacityCount: number
      workflowCode: string
      privatePayloadMarkerPresent: boolean
    }>('persistent-waits-state', {
      workflow_definition_id: String(this.workflowDefinitionId),
      readiness_request_id: this.readinessRequestId,
      capacity_request_id: this.capacityRequestId,
    })
  }

  override async finish(request: APIRequestContext, reader?: APIRequestContext) {
    let waitCleanup: Record<string, number> = {}
    let roleAccountCleanup = 0
    if (this.waitsSeeded) {
      waitCleanup = this.ownedSql<Record<string, number>>('persistent-waits-cleanup', {
        workflow_definition_id: String(this.workflowDefinitionId),
        readiness_request_id: this.readinessRequestId,
        capacity_request_id: this.capacityRequestId,
      })
      expect(Object.values(waitCleanup).reduce((sum, count) => sum + count, 0)).toBe(0)
    }
    if (this.roleAccountsPrepared) {
      roleAccountCleanup = this.ownedSql<number>('persistent-waits-accounts-cleanup', {
        auditor_name: this.auditorName,
        user_name: this.userName,
      })
      expect(roleAccountCleanup).toBe(0)
    }
    return {
      ...(await super.finish(request, reader)),
      ...waitCleanup,
      roleAccountsRemaining: roleAccountCleanup,
    }
  }
}

export class BatchDayGovernanceFixture extends ControlProgressFixture {
  readonly auditorName = `governance-auditor-${randomUUID()}`
  readonly userName = `governance-user-${randomUUID()}`
  private dayIds: number[] = []
  private extraAccountIds: number[] = []
  prepareDays() {
    const data = this.ownedSql<{ dayIds: number[]; accountIds: number[] }>('batchday-prepare', {
      day_date: this.bizDate,
      auditor_name: this.auditorName,
      user_name: this.userName,
    })
    this.dayIds = data.dayIds
    this.extraAccountIds = data.accountIds
  }
  governanceState() {
    return this.ownedSql<{
      days: Array<{ id: number; date: string; status: string; frozen: boolean }>
      audits: Array<{ operation: string; operator: string; reason: string }>
      paused: boolean | null
      catchupEvents: Array<{ action: string; reason: string }>
    }>('batchday-state', { day_ids: this.dayIds.join(',') })
  }
  override async finish(request: APIRequestContext, reader?: APIRequestContext) {
    const extra = this.ownedSql<Record<string, number>>('batchday-cleanup', {
      day_ids: this.dayIds.join(','),
      extra_account_ids: this.extraAccountIds.join(','),
      auditor_name: this.auditorName,
      user_name: this.userName,
    })
    expect(Object.values(extra).every((count) => count === 0)).toBe(true)
    return { ...(await super.finish(request, reader)), ...extra }
  }
}

export class AtomicTaskConfigFixture extends BatchDayGovernanceFixture {
  readonly tenantAdminConfigName = `atomic-ui-${randomUUID()}`
  readonly adminConfigName = `atomic-admin-${randomUUID()}`
  readonly auditorConfigName = `atomic-auditor-${randomUUID()}`
  readonly userConfigName = `atomic-user-${randomUUID()}`
  private atomicPrepared = false

  override prepare() {
    super.prepare()
    this.prepareDays()
    this.atomicPrepared = true
  }

  savedConfigState() {
    return this.ownedSql<
      Array<{
        tenantId: string
        taskType: string
        name: string
        parameters: string
        createdBy: string | null
      }>
    >('atomic-config-state', { config_names: this.configNames() })
  }

  override async finish(request: APIRequestContext, reader?: APIRequestContext) {
    if (!this.atomicPrepared) return super.finish(request, reader)
    let configCleanup:
      { atomicConfigDeleted: number; atomicConfigRowsRemaining: number } | undefined
    let configError: unknown
    try {
      const result = this.ownedSql<{ deleted: number; remaining: number }>(
        'atomic-config-cleanup',
        { config_names: this.configNames() },
      )
      expect(result.remaining, '本例Atomic配置清理后必须无残留').toBe(0)
      configCleanup = {
        atomicConfigDeleted: result.deleted,
        atomicConfigRowsRemaining: result.remaining,
      }
    } catch (error) {
      configError = error
    }
    try {
      const baseCleanup = await super.finish(request, reader)
      if (configError) {
        throw new AggregateError([configError], 'Atomic config cleanup failed')
      }
      return { ...baseCleanup, ...configCleanup }
    } catch (baseError) {
      if (configError) {
        throw new AggregateError(
          [configError, baseError],
          'Atomic config and shared fixture cleanup failed',
        )
      }
      throw baseError
    }
  }

  private configNames() {
    return [
      this.tenantAdminConfigName,
      this.adminConfigName,
      this.auditorConfigName,
      this.userConfigName,
    ].join(',')
  }
}

export class ResultVersionGovernanceFixture extends BatchDayGovernanceFixture {
  readonly effectiveBusinessKey = `e2e-result-effective-${randomUUID()}`
  readonly archivedBusinessKey = `e2e-result-archived-${randomUUID()}`
  readonly adminArchivedBusinessKey = `e2e-result-admin-archived-${randomUUID()}`
  readonly payloadMarker = `result-payload-private-${randomUUID()}`
  private versionsPrepared = false

  override prepare() {
    super.prepare()
    this.prepareDays()
    this.ownedSql('result-version-prepare', {
      effective_business_key: this.effectiveBusinessKey,
      archived_business_key: this.archivedBusinessKey,
      admin_archived_business_key: this.adminArchivedBusinessKey,
      payload_marker: this.payloadMarker,
    })
    this.versionsPrepared = true
  }

  resultVersionState() {
    return this.ownedSql<{
      versions: Array<{
        id: number
        businessKey: string
        versionNo: number
        status: string
        jobInstanceId: number
        payloadJson: string | null
      }>
      audits: Array<{
        aggregateId: string
        action: string
        tenantId: string
        operatorId: string
        result: string
      }>
    }>('result-version-state', {
      effective_business_key: this.effectiveBusinessKey,
      archived_business_key: this.archivedBusinessKey,
      admin_archived_business_key: this.adminArchivedBusinessKey,
    })
  }

  override async finish(request: APIRequestContext, reader?: APIRequestContext) {
    if (!this.versionsPrepared) return super.finish(request, reader)
    let versionCleanup: { resultVersionsDeleted: number; resultVersionRowsRemaining: number }
    try {
      versionCleanup = this.ownedSql('result-version-cleanup', {
        effective_business_key: this.effectiveBusinessKey,
        archived_business_key: this.archivedBusinessKey,
        admin_archived_business_key: this.adminArchivedBusinessKey,
      })
      expect(versionCleanup.resultVersionRowsRemaining, '本例结果版本清理后必须无残留').toBe(0)
    } catch (versionError) {
      try {
        await super.finish(request, reader)
      } catch (baseError) {
        throw new AggregateError(
          [versionError, baseError],
          'Result version and shared fixture cleanup failed',
        )
      }
      throw versionError
    }
    return { ...(await super.finish(request, reader)), ...versionCleanup }
  }
}

export interface WorkerProgressState {
  worker: { status: string; workerGroup: string } | null
  runs: Array<{ id: number; status: string }>
  nodes: Array<{
    workflowRunId: number
    nodeCode: string
    status: string
    jobInstanceId: number | null
  }>
  instances: Array<{
    id: number
    status: string
    expectedPartitions: number
    successPartitions: number
    failedPartitions: number
  }>
  partitions: Array<{
    id: number
    jobInstanceId: number
    status: string
    workerCode: string | null
  }>
  tasks: Array<{ id: number; jobInstanceId: number; status: string; workerCode: string | null }>
}

/** 独占租户与临时Worker；默认Atomic只读SQL，子类可选择正式Worker执行链。 */
export class WorkerExecutionProgressFixture extends ControlProgressFixture {
  protected get workerRuntimeKind(): 'atomic' | 'process' {
    return 'atomic'
  }

  protected workerArguments(): string[] {
    return []
  }

  private readonly suffix = randomUUID().replaceAll('-', '').slice(0, 20)
  readonly workerCode = `progress-${this.workerRuntimeKind}-${this.suffix}`
  readonly consumerGroup = `progress-${this.workerRuntimeKind}-${this.suffix}`
  readonly jobCode = `progress-job-${this.suffix}`
  readonly workflowCode = `progress-flow-${this.suffix}`
  readonly workerLogDir = mkdtempSync(join(tmpdir(), `wdi-${this.workerRuntimeKind}-progress-`))
  private workerProcess?: ChildProcess
  private workerStartupError?: Error
  private readonly jobDefinitions = new Map<string, number>()

  async startWorker() {
    const frontendRoot = resolve(__dirname, '../../..')
    const backendRoot = resolve(frontendRoot, '../file-batch-system')
    const jar = resolve(
      backendRoot,
      process.env[`E2E_${this.workerRuntimeKind.toUpperCase()}_WORKER_JAR`] ||
        `build/runtime-jars/worker-${this.workerRuntimeKind}.jar`,
    )
    const script = [
      'set -euo pipefail',
      'BE_ROOT="$1"',
      'JAR="$2"',
      'WORKER_CODE="$3"',
      'TENANT_ID="$4"',
      'CONSUMER_GROUP="$5"',
      'WORKER_KIND="$6"',
      'shift 6',
      'cd "$BE_ROOT"',
      'source "$BE_ROOT/scripts/lib/env-common.sh"',
      'batch_configure_local_jvm_control_plane_env',
      'batch_configure_local_jvm_runtime_env',
      'exec java --enable-native-access=ALL-UNNAMED -XX:TieredStopAtLevel=1 -XX:+UseSerialGC -Xshare:off -Djava.net.preferIPv4Stack=false -Djava.net.preferIPv6Addresses=false -jar "$JAR" --spring.profiles.active=local "--batch.worker.${WORKER_KIND}.worker-code=$WORKER_CODE" "--batch.worker.${WORKER_KIND}.tenant-id=$TENANT_ID" "--batch.worker.${WORKER_KIND}.consumer-group-id=$CONSUMER_GROUP" --batch.worker.kafka.subscribe-mode=TENANT_SCOPED "--batch.worker.kafka.tenant-allowlist=$TENANT_ID" --server.port=0 "$@"',
    ].join('\n')
    const log = openSync(join(this.workerLogDir, 'worker.log'), 'w')
    const child = spawn(
      'bash',
      [
        '-c',
        script,
        'worker-progress',
        backendRoot,
        jar,
        this.workerCode,
        this.tenantId,
        this.consumerGroup,
        this.workerRuntimeKind,
        ...this.workerArguments(),
      ],
      { cwd: backendRoot, stdio: ['ignore', log, log] },
    )
    closeSync(log)
    this.workerProcess = child
    this.workerStartupError = undefined
    child.once('error', (error) => {
      this.workerStartupError = error
    })

    const deadline = Date.now() + 45_000
    while (Date.now() < deadline) {
      if (this.workerStartupError) {
        throw new Error(`临时 ${this.workerRuntimeKind.toUpperCase()} Worker 无法启动`, {
          cause: this.workerStartupError,
        })
      }
      if (isChildExited(child)) {
        throw new Error(
          `临时 ${this.workerRuntimeKind.toUpperCase()} Worker 在注册前退出 (${child.exitCode ?? child.signalCode})；日志：${this.workerLogDir}`,
        )
      }
      if (this.workerProgressState().worker?.status === 'ONLINE') return
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000))
    }
    throw new Error(
      `临时 ${this.workerRuntimeKind.toUpperCase()} Worker 未在 45 秒内注册到独占租户`,
    )
  }

  workerProgressState(): WorkerProgressState {
    return this.ownedSql<WorkerProgressState>('worker-progress-state', {
      worker_code: this.workerCode,
      job_code: this.jobCode,
      workflow_code: this.workflowCode,
      job_definition_ids: [...this.jobDefinitions.values()].join(','),
    })
  }

  rememberJobDefinition(id: number, jobCode = this.jobCode) {
    if (Number.isSafeInteger(id) && id > 0) this.jobDefinitions.set(jobCode, id)
  }

  override async finish(request: APIRequestContext, reader?: APIRequestContext) {
    let terminalWaitError: unknown
    try {
      await expect
        .poll(
          () => {
            const state = this.workerProgressState()
            const terminal = (status: string) =>
              ['SUCCESS', 'FAILED', 'PARTIAL_FAILED', 'CANCELLED', 'TERMINATED'].includes(status)
            return (
              state.runs.every((run) => terminal(run.status)) &&
              state.instances.every((instance) => terminal(instance.status)) &&
              state.partitions.every((partition) => terminal(partition.status)) &&
              state.tasks.every((task) => terminal(task.status))
            )
          },
          { timeout: 75_000, intervals: [1000, 2000, 3000] },
        )
        .toBe(true)
    } catch (error) {
      terminalWaitError = error
    }

    await this.stopWorker()
    let workerCleanup: Record<string, number> | undefined
    let workerCleanupError: unknown
    try {
      workerCleanup = {}
      const definitions = this.jobDefinitions.size
        ? [...this.jobDefinitions]
        : [[this.jobCode, 0] as const]
      for (const [jobCode, definitionId] of definitions) {
        const cleaned = this.ownedSql<Record<string, number>>('worker-progress-cleanup', {
          worker_code: this.workerCode,
          job_code: jobCode,
          job_definition_id: String(definitionId),
        })
        for (const [key, count] of Object.entries(cleaned))
          workerCleanup[key] = (workerCleanup[key] ?? 0) + count
      }
      expect(
        Object.values(workerCleanup).every((count) => count === 0),
        `${this.workerRuntimeKind.toUpperCase()} Worker 作业副作用必须清零: ${JSON.stringify(workerCleanup)}`,
      ).toBe(true)
    } catch (error) {
      workerCleanupError = error
    }

    let parentCleanup: Record<string, unknown> | undefined
    let parentCleanupError: unknown
    try {
      parentCleanup = await super.finish(request, reader)
    } catch (error) {
      parentCleanupError = error
    }
    const errors = [terminalWaitError, workerCleanupError, parentCleanupError].filter(Boolean)
    if (errors.length) {
      throw new AggregateError(errors, '真实 Worker 进度验收或其精确清理失败')
    }
    return { ...parentCleanup, ...workerCleanup }
  }

  protected async stopWorker(signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM') {
    const child = this.workerProcess
    this.workerProcess = undefined
    if (!child || isChildExited(child)) return
    child.kill(signal)
    if (await waitForChildExit(child, 10_000)) return
    child.kill('SIGKILL')
    if (!(await waitForChildExit(child, 10_000))) {
      throw new Error(`无法停止本例启动的 ${this.workerRuntimeKind.toUpperCase()} Worker 子进程`)
    }
  }
}

function isChildExited(child: ChildProcess) {
  return child.exitCode !== null || child.signalCode !== null
}

function waitForChildExit(child: ChildProcess, timeoutMs: number) {
  return new Promise<boolean>((resolveWait) => {
    if (isChildExited(child)) {
      resolveWait(true)
      return
    }
    const onExit = () => {
      clearTimeout(timer)
      resolveWait(true)
    }
    const timer = setTimeout(() => {
      child.off('exit', onExit)
      resolveWait(isChildExited(child))
    }, timeoutMs)
    child.once('exit', onExit)
  })
}
