BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TEMP TABLE owned_job_definitions AS
SELECT id, tenant_id, job_code
FROM batch.job_definition
WHERE tenant_id = :'tenant_id'
  AND job_code = :'job_code'
  AND (id = NULLIF(:'job_definition_id', '0')::bigint OR NULLIF(:'job_definition_id', '0') IS NULL);
CREATE TEMP TABLE owned_workflow_definitions AS
SELECT id, tenant_id
FROM batch.workflow_definition
WHERE tenant_id = :'tenant_id'
  AND single_job_definition_id IN (SELECT id FROM owned_job_definitions);
CREATE TEMP TABLE owned_workflow_runs AS
SELECT id, tenant_id, run_status
FROM batch.workflow_run
WHERE tenant_id = :'tenant_id'
  AND single_job_definition_id IN (SELECT id FROM owned_job_definitions);
CREATE TEMP TABLE owned_instances AS
SELECT id, tenant_id, dedup_key
FROM batch.job_instance
WHERE tenant_id = :'tenant_id'
  AND job_definition_id IN (SELECT id FROM owned_job_definitions);
CREATE TEMP TABLE owned_partitions AS
SELECT id, tenant_id, job_instance_id
FROM batch.job_partition
WHERE tenant_id = :'tenant_id'
  AND job_instance_id IN (SELECT id FROM owned_instances);
CREATE TEMP TABLE owned_tasks AS
SELECT id, tenant_id, job_instance_id
FROM batch.job_task
WHERE tenant_id = :'tenant_id'
  AND job_instance_id IN (SELECT id FROM owned_instances);
CREATE TEMP TABLE owned_events AS
SELECT id, event_key
FROM batch.outbox_event
WHERE tenant_id = :'tenant_id'
  AND aggregate_type IN ('JOB_INSTANCE', 'JOB_TASK')
  AND ((aggregate_type = 'JOB_INSTANCE' AND aggregate_id IN (SELECT id FROM owned_instances))
    OR (aggregate_type = 'JOB_TASK' AND aggregate_id IN (SELECT id FROM owned_tasks)));

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM batch.job_instance
    WHERE id IN (SELECT id FROM owned_instances)
      AND instance_status NOT IN ('SUCCESS', 'FAILED', 'PARTIAL_FAILED', 'CANCELLED', 'TERMINATED')
  ) THEN RAISE EXCEPTION 'Owned Job instance is still active'; END IF;
  IF EXISTS (
    SELECT 1 FROM batch.job_partition
    WHERE id IN (SELECT id FROM owned_partitions)
      AND partition_status NOT IN ('SUCCESS', 'FAILED', 'CANCELLED', 'TERMINATED')
  ) THEN RAISE EXCEPTION 'Owned Job partition is still active'; END IF;
  IF EXISTS (
    SELECT 1 FROM batch.job_task
    WHERE id IN (SELECT id FROM owned_tasks)
      AND task_status NOT IN ('SUCCESS', 'FAILED', 'CANCELLED', 'TERMINATED')
  ) THEN RAISE EXCEPTION 'Owned Job task is still active'; END IF;
  IF EXISTS (
    SELECT 1 FROM batch.workflow_run
    WHERE id IN (SELECT id FROM owned_workflow_runs)
      AND run_status NOT IN ('SUCCESS', 'SUCCESS_DRY_RUN', 'FAILED', 'FAILED_DRY_RUN', 'TERMINATED')
  ) THEN RAISE EXCEPTION 'Owned single-Job Workflow run is still active'; END IF;
  IF EXISTS (
    SELECT 1
    FROM batch.workflow_run run
    JOIN batch.workflow_node_run node ON node.workflow_run_id = run.id
    WHERE node.job_instance_id IN (SELECT id FROM owned_instances)
      AND run.run_status NOT IN ('SUCCESS', 'SUCCESS_DRY_RUN', 'FAILED', 'FAILED_DRY_RUN', 'TERMINATED')
  ) THEN RAISE EXCEPTION 'Workflow run linked to an owned Job instance is still active'; END IF;
END $$;

UPDATE batch.workflow_node_run
SET job_instance_id = NULL
WHERE job_instance_id IN (SELECT id FROM owned_instances);
UPDATE batch.workflow_run
SET single_job_definition_id = NULL
WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM owned_workflow_runs);
UPDATE batch.workflow_definition
SET single_job_definition_id = NULL
WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM owned_workflow_definitions);
DELETE FROM batch.event_delivery_log
WHERE tenant_id = :'tenant_id' AND outbox_event_id IN (SELECT id FROM owned_events);
DELETE FROM batch.event_outbox_retry
WHERE tenant_id = :'tenant_id' AND outbox_event_id IN (SELECT id FROM owned_events);
DELETE FROM batch.outbox_event
WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM owned_events);
DELETE FROM batch.outbox_event_dedup_key
WHERE tenant_id = :'tenant_id' AND event_key IN (SELECT event_key FROM owned_events);
DELETE FROM batch.worker_report_outbox
WHERE tenant_id = :'tenant_id' AND task_id IN (SELECT id FROM owned_tasks);
DELETE FROM batch.job_execution_log
WHERE tenant_id = :'tenant_id'
  AND (job_instance_id IN (SELECT id FROM owned_instances)
    OR job_partition_id IN (SELECT id FROM owned_partitions));
DELETE FROM batch.console_push_job_delivery
WHERE tenant_id = :'tenant_id' AND job_instance_id IN (SELECT id FROM owned_instances);
DELETE FROM batch.job_monitoring_alert_claim
WHERE tenant_id = :'tenant_id' AND job_instance_id IN (SELECT id FROM owned_instances);
DELETE FROM batch.data_quality_check
WHERE tenant_id = :'tenant_id' AND job_instance_id IN (SELECT id FROM owned_instances);
DELETE FROM batch.asset_partition
WHERE tenant_id = :'tenant_id' AND job_instance_id IN (SELECT id FROM owned_instances);
DELETE FROM batch.result_version
WHERE tenant_id = :'tenant_id' AND job_instance_id IN (SELECT id FROM owned_instances);
DELETE FROM batch.job_instance_dedup_key
WHERE tenant_id = :'tenant_id' AND first_instance_id IN (SELECT id FROM owned_instances);
DELETE FROM batch.job_step_instance
WHERE tenant_id = :'tenant_id' AND job_instance_id IN (SELECT id FROM owned_instances);
DELETE FROM batch.job_task
WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM owned_tasks);
DELETE FROM batch.job_partition
WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM owned_partitions);
DELETE FROM batch.job_instance
WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM owned_instances);
DELETE FROM batch.job_definition
WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM owned_job_definitions);
DELETE FROM batch.worker_registry
WHERE tenant_id = :'tenant_id' AND worker_code = :'worker_code';
COMMIT;

SELECT json_build_object(
  'jobDefinitions', (SELECT count(*) FROM batch.job_definition WHERE tenant_id = :'tenant_id' AND job_code = :'job_code'),
  'instances', (SELECT count(*) FROM batch.job_instance WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM owned_instances)),
  'partitions', (SELECT count(*) FROM batch.job_partition WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM owned_partitions)),
  'tasks', (SELECT count(*) FROM batch.job_task WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM owned_tasks)),
  'stepInstances', (SELECT count(*) FROM batch.job_step_instance WHERE tenant_id = :'tenant_id' AND job_instance_id IN (SELECT id FROM owned_instances)),
  'executionLogs', (SELECT count(*) FROM batch.job_execution_log WHERE tenant_id = :'tenant_id' AND (job_instance_id IN (SELECT id FROM owned_instances) OR job_partition_id IN (SELECT id FROM owned_partitions))),
  'workerReports', (SELECT count(*) FROM batch.worker_report_outbox WHERE tenant_id = :'tenant_id' AND task_id IN (SELECT id FROM owned_tasks)),
  'jobEvents', (SELECT count(*) FROM batch.outbox_event WHERE tenant_id = :'tenant_id' AND id IN (SELECT id FROM owned_events)),
  'workerRegistry', (SELECT count(*) FROM batch.worker_registry WHERE tenant_id = :'tenant_id' AND worker_code = :'worker_code')
);
