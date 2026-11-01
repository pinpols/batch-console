BEGIN;
SET LOCAL app.tenant_id = :'tenant_id';
SELECT json_build_object(
    'definitionVersion', (SELECT version FROM batch.workflow_definition
        WHERE tenant_id = :'tenant_id' AND id = NULLIF(:'workflow_definition_id', '0')::bigint),
    'occurrences', coalesce((SELECT json_agg(json_build_object(
        'status', occurrence_status, 'bizDate', biz_date, 'scheduledFireTime', scheduled_fire_time)
        ORDER BY scheduled_fire_time)
        FROM batch.scheduled_occurrence
        WHERE tenant_id = :'tenant_id'
          AND workflow_definition_id = NULLIF(:'workflow_definition_id', '0')::bigint
          AND occurrence_status != 'SUPERSEDED'), '[]'::json),
    'actualFires', coalesce((SELECT json_agg(json_build_object(
        'scheduledFireTime', scheduled_fire_time, 'fireInstanceId', fire_instance_id,
        'refireCount', refire_count, 'actualFireTime', actual_fire_time, 'fireKind', fire_kind)
        ORDER BY actual_fire_time, id)
        FROM batch.scheduled_occurrence_fire
        WHERE tenant_id = :'tenant_id'
          AND workflow_definition_id = NULLIF(:'workflow_definition_id', '0')::bigint), '[]'::json),
    'coverage', (SELECT json_build_object(
        'scheduleVersion', schedule_version,
        'coverageThrough', coverage_through_at,
        'lastSuccessAt', last_success_at)
        FROM batch.scheduled_occurrence_coverage
        WHERE tenant_id = :'tenant_id'
          AND workflow_definition_id = NULLIF(:'workflow_definition_id', '0')::bigint)
);
COMMIT;
