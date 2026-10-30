-- 模拟已提交状态的投影变化，只更新保存身份且属于本例租户的行。
BEGIN;
UPDATE batch.pipeline_progress SET processed_count=88,completed=true,completed_at=now(),updated_at=now()
WHERE tenant_id=:'tenant_id' AND pipeline_instance_id=ANY(string_to_array(:'pipeline_ids',',')::bigint[]);
UPDATE batch.pipeline_step_run SET step_status='SUCCESS',finished_at=now()
WHERE pipeline_instance_id IN (SELECT id FROM batch.pipeline_instance
  WHERE tenant_id=:'tenant_id' AND id=ANY(string_to_array(:'pipeline_ids',',')::bigint[]));
UPDATE batch.pipeline_instance SET run_status='SUCCESS',finished_at=now(),updated_at=now()
WHERE tenant_id=:'tenant_id' AND id=ANY(string_to_array(:'pipeline_ids',',')::bigint[]);
SELECT json_build_object('status',run_status,'rows',
 (SELECT processed_count FROM batch.pipeline_progress WHERE tenant_id=:'tenant_id' AND pipeline_instance_id=p.id AND stage='LOAD'))
FROM batch.pipeline_instance p WHERE tenant_id=:'tenant_id' AND id=ANY(string_to_array(:'pipeline_ids',',')::bigint[]);
COMMIT;
