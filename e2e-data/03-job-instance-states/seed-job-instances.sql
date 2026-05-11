-- seed-job-instances.sql
-- 在 ta 租户造 4 种状态的 JobInstance + 1 个 FAILED partition,供 e2e 测试。
-- 真实表名:batch.job_instance / batch.job_partition (NOT partition_instance)
--
-- 状态枚举(ck_job_instance_status):
--   CREATED / WAITING / READY / RUNNING / PARTIAL_FAILED / SUCCESS / FAILED / CANCELLED / TERMINATED
-- 触发类型(ck_job_instance_trigger_type):
--   SCHEDULED / API / MANUAL / EVENT / CATCH_UP
--
-- 前置:ta 租户内 jobCode='TA_INC_ORDER_AGG' 的 job_definition 已存在(由 01 包导入)。
--
-- 用法(BE 同事执行):
--   PGPASSWORD=xxx psql -h localhost -p 15432 -U batch -d batch_console \
--     -f e2e-data/03-job-instance-states/seed-job-instances.sql
-- 清理:
--   DELETE FROM batch.job_partition WHERE job_instance_id IN
--     (SELECT id FROM batch.job_instance WHERE instance_no LIKE 'e2e-%');
--   DELETE FROM batch.job_instance WHERE instance_no LIKE 'e2e-%';

BEGIN;

DO $$
DECLARE
  v_tenant    VARCHAR := 'ta';
  v_job_code  VARCHAR := 'TA_INC_ORDER_AGG';
  v_jd_id     BIGINT;
  v_running   BIGINT;
  v_success   BIGINT;
  v_failed    BIGINT;
  v_cancelled BIGINT;
BEGIN
  SELECT id INTO v_jd_id FROM batch.job_definition
   WHERE tenant_id = v_tenant AND job_code = v_job_code LIMIT 1;
  IF v_jd_id IS NULL THEN
    RAISE EXCEPTION 'job_definition not found: tenant=% job_code=%', v_tenant, v_job_code;
  END IF;

  -- 1. RUNNING — 测 cancel / terminate
  INSERT INTO batch.job_instance (
    tenant_id, job_definition_id, job_code, instance_no, biz_date,
    trigger_type, instance_status, priority, dedup_key, started_at
  ) VALUES (
    v_tenant, v_jd_id, v_job_code, 'e2e-running-1', '2026-05-01',
    'MANUAL', 'RUNNING', 5, 'e2e-running-1-dedup', NOW() - INTERVAL '5 minutes'
  ) RETURNING id INTO v_running;

  -- 2. SUCCESS — 测 rerun-request
  INSERT INTO batch.job_instance (
    tenant_id, job_definition_id, job_code, instance_no, biz_date,
    trigger_type, instance_status, priority, dedup_key, started_at, finished_at
  ) VALUES (
    v_tenant, v_jd_id, v_job_code, 'e2e-success-1', '2026-04-30',
    'SCHEDULED', 'SUCCESS', 5, 'e2e-success-1-dedup',
    NOW() - INTERVAL '2 hours', NOW() - INTERVAL '110 minutes'
  ) RETURNING id INTO v_success;

  -- 3. FAILED — 测 compensation-request,挂个 FAILED partition
  INSERT INTO batch.job_instance (
    tenant_id, job_definition_id, job_code, instance_no, biz_date,
    trigger_type, instance_status, priority, dedup_key,
    expected_partition_count, success_partition_count, failed_partition_count,
    started_at, finished_at
  ) VALUES (
    v_tenant, v_jd_id, v_job_code, 'e2e-failed-1', '2026-04-29',
    'SCHEDULED', 'FAILED', 5, 'e2e-failed-1-dedup',
    1, 0, 1,
    NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours'
  ) RETURNING id INTO v_failed;

  -- 4. CANCELLED — 测重新触发(取代不存在的 BLOCKED 枚举)
  INSERT INTO batch.job_instance (
    tenant_id, job_definition_id, job_code, instance_no, biz_date,
    trigger_type, instance_status, priority, dedup_key, started_at, finished_at
  ) VALUES (
    v_tenant, v_jd_id, v_job_code, 'e2e-cancelled-1', '2026-04-28',
    'MANUAL', 'CANCELLED', 5, 'e2e-cancelled-1-dedup',
    NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 50 minutes'
  ) RETURNING id INTO v_cancelled;

  -- 5. FAILED partition on failed instance
  INSERT INTO batch.job_partition (
    tenant_id, job_instance_id, partition_no, partition_status
  ) VALUES (
    v_tenant, v_failed, 1, 'FAILED'
  );

  RAISE NOTICE 'created ids: running=% success=% failed=% cancelled=%',
    v_running, v_success, v_failed, v_cancelled;
END $$;

COMMIT;

-- 验证:
-- SELECT instance_no, instance_status, biz_date FROM batch.job_instance
--   WHERE instance_no LIKE 'e2e-%' ORDER BY id;
-- SELECT partition_no, partition_status FROM batch.job_partition
--   WHERE tenant_id='ta' AND job_instance_id IN
--     (SELECT id FROM batch.job_instance WHERE instance_no LIKE 'e2e-%');
