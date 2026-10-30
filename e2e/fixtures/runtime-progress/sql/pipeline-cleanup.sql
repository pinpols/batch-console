-- 精确删除本例保存的Pipeline数字身份，再以租户和数字身份双向检查残留。
BEGIN;
DELETE FROM batch.pipeline_progress WHERE tenant_id=:'tenant_id'
  AND pipeline_instance_id=ANY(string_to_array(:'pipeline_ids',',')::bigint[]);
DELETE FROM batch.pipeline_step_run WHERE pipeline_instance_id IN
 (SELECT id FROM batch.pipeline_instance WHERE tenant_id=:'tenant_id'
  AND id=ANY(string_to_array(:'pipeline_ids',',')::bigint[]));
DELETE FROM batch.pipeline_instance WHERE tenant_id=:'tenant_id'
  AND id=ANY(string_to_array(:'pipeline_ids',',')::bigint[]);
COMMIT;
SELECT (SELECT count(*) FROM batch.pipeline_instance WHERE tenant_id=:'tenant_id' OR id=ANY(string_to_array(:'pipeline_ids',',')::bigint[]))
  +(SELECT count(*) FROM batch.pipeline_step_run WHERE pipeline_instance_id=ANY(string_to_array(:'pipeline_ids',',')::bigint[]))
  +(SELECT count(*) FROM batch.pipeline_progress WHERE tenant_id=:'tenant_id' OR pipeline_instance_id=ANY(string_to_array(:'pipeline_ids',',')::bigint[]));
