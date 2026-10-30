BEGIN;
SET LOCAL app.tenant_id = :'tenant_id';

DELETE FROM batch.job_dependency
 WHERE tenant_id = :'tenant_id' AND downstream_job_code = :'job_code';
DELETE FROM batch.job_definition
 WHERE tenant_id = :'tenant_id' AND job_code = :'job_code';
DELETE FROM batch.job_definition
 WHERE tenant_id = :'tenant_id' AND job_code = :'upstream_job_code';

SELECT json_build_object(
  'jobDefinitionsRemaining', (SELECT count(*) FROM batch.job_definition
                               WHERE tenant_id = :'tenant_id'
                                 AND job_code IN (:'job_code', :'upstream_job_code')),
  'dependencyRowsRemaining', (SELECT count(*) FROM batch.job_dependency
                               WHERE tenant_id = :'tenant_id'
                                 AND downstream_job_code = :'job_code')
);
COMMIT;
