BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL app.tenant_id = :'tenant_id';
DELETE FROM batch.scheduled_occurrence_catch_up_audit
 WHERE tenant_id = :'tenant_id'
   AND workflow_definition_id = NULLIF(:'workflow_definition_id', '0')::bigint;
DELETE FROM batch.scheduled_occurrence_supersession_history
 WHERE tenant_id = :'tenant_id'
   AND workflow_definition_id = NULLIF(:'workflow_definition_id', '0')::bigint;
DELETE FROM batch.scheduled_occurrence
 WHERE tenant_id = :'tenant_id'
   AND workflow_definition_id = NULLIF(:'workflow_definition_id', '0')::bigint;
DELETE FROM batch.scheduled_occurrence_coverage
 WHERE tenant_id = :'tenant_id'
   AND workflow_definition_id = NULLIF(:'workflow_definition_id', '0')::bigint;
SELECT json_build_object(
    'catchUpAuditRemaining', (SELECT count(*) FROM batch.scheduled_occurrence_catch_up_audit
        WHERE tenant_id = :'tenant_id' AND workflow_definition_id = NULLIF(:'workflow_definition_id', '0')::bigint),
    'supersessionHistoryRemaining', (SELECT count(*) FROM batch.scheduled_occurrence_supersession_history
        WHERE tenant_id = :'tenant_id' AND workflow_definition_id = NULLIF(:'workflow_definition_id', '0')::bigint),
    'scheduledOccurrencesRemaining', (SELECT count(*) FROM batch.scheduled_occurrence
        WHERE tenant_id = :'tenant_id' AND workflow_definition_id = NULLIF(:'workflow_definition_id', '0')::bigint),
    'coverageRowsRemaining', (SELECT count(*) FROM batch.scheduled_occurrence_coverage
        WHERE tenant_id = :'tenant_id' AND workflow_definition_id = NULLIF(:'workflow_definition_id', '0')::bigint)
);
COMMIT;
