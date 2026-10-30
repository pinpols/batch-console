WITH uploaded_file AS (
  SELECT *
    FROM batch.file_record
   WHERE tenant_id = :'tenant_id'
     AND file_name = :'file_name'
     AND metadata_json ->> 'channelCode' = :'channel_code'
     AND metadata_json ->> 'uploadMode' = 'APP_MANAGED'
   ORDER BY id DESC
   LIMIT 1
)
SELECT json_build_object(
  'fileId', (SELECT id FROM uploaded_file),
  'objectFileCount', (SELECT count(*) FROM batch.file_record recorded
                       JOIN uploaded_file source ON source.storage_path = recorded.storage_path
                         AND source.storage_bucket = recorded.storage_bucket),
  'fileCount', (SELECT count(*) FROM batch.file_record
                 WHERE tenant_id = :'tenant_id'
                   AND file_name = :'file_name'
                   AND metadata_json ->> 'channelCode' = :'channel_code'
                   AND metadata_json ->> 'uploadMode' = 'APP_MANAGED'),
  'fileSizeBytes', (SELECT file_size_bytes FROM uploaded_file),
  'fileStatus', (SELECT file_status FROM uploaded_file),
  'storageBucket', (SELECT storage_bucket FROM uploaded_file),
  'storagePath', (SELECT storage_path FROM uploaded_file),
  'uploadMode', (SELECT metadata_json ->> 'uploadMode' FROM uploaded_file),
  'arrivalState', (SELECT metadata_json ->> 'arrivalState' FROM uploaded_file),
  'arrivalConfirmedAt', (SELECT metadata_json ->> 'arrivalConfirmedAt' FROM uploaded_file),
  'bizDate', (SELECT biz_date::text FROM uploaded_file),
  'metadataBizDate', (SELECT metadata_json ->> 'bizDate' FROM uploaded_file),
  'fileGroupCode', (SELECT metadata_json ->> 'fileGroupCode' FROM uploaded_file),
  'bundleWorkflowCode', (SELECT metadata_json ->> 'bundleWorkflowCode' FROM uploaded_file),
  'bundleTemplateCode', (SELECT metadata_json ->> 'bundleTemplateCode' FROM uploaded_file),
  'requiredFileSet', (SELECT metadata_json ->> 'requiredFileSet' FROM uploaded_file),
  'workflowDefinitionId', (SELECT id FROM batch.workflow_definition
                            WHERE tenant_id = :'tenant_id'
                              AND workflow_code = :'workflow_code'
                            ORDER BY id DESC LIMIT 1),
  'workflowRunCount', (SELECT count(*)
                        FROM batch.workflow_run run
                        JOIN batch.workflow_definition workflow
                          ON workflow.tenant_id = run.tenant_id
                         AND workflow.id = run.workflow_definition_id
                       WHERE run.tenant_id = :'tenant_id'
                         AND workflow.workflow_code = :'workflow_code'
                         AND run.biz_date = (SELECT biz_date FROM uploaded_file)),
  'workflowRunId', (SELECT run.id
                     FROM batch.workflow_run run
                     JOIN batch.workflow_definition workflow
                       ON workflow.tenant_id = run.tenant_id
                      AND workflow.id = run.workflow_definition_id
                    WHERE run.tenant_id = :'tenant_id'
                      AND workflow.workflow_code = :'workflow_code'
                      AND run.biz_date = (SELECT biz_date FROM uploaded_file)
                    ORDER BY run.id DESC LIMIT 1),
  'workflowRunStatus', (SELECT run.run_status
                          FROM batch.workflow_run run
                          JOIN batch.workflow_definition workflow
                            ON workflow.tenant_id = run.tenant_id
                           AND workflow.id = run.workflow_definition_id
                         WHERE run.tenant_id = :'tenant_id'
                           AND workflow.workflow_code = :'workflow_code'
                           AND run.biz_date = (SELECT biz_date FROM uploaded_file)
                         ORDER BY run.id DESC LIMIT 1),
  'auditOperations', coalesce((
    SELECT json_agg(operation_type ORDER BY created_at, id)
      FROM batch.file_audit_log
     WHERE tenant_id = :'tenant_id'
       AND file_id = (SELECT id FROM uploaded_file)
  ), '[]'::json),
  'channelCount', (SELECT count(*) FROM batch.file_channel_config
                    WHERE tenant_id = :'tenant_id'
                      AND channel_code = :'channel_code'),
  'expectationCount', (SELECT count(*) FROM batch.file_group_expectation_definition
                        WHERE tenant_id = :'tenant_id'
                          AND file_group_code = :'file_group_code'),
  'templateCount', (SELECT count(*) FROM batch.file_template_config
                     WHERE tenant_id = :'tenant_id'
                       AND template_code = :'template_code')
);
