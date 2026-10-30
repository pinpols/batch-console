SELECT set_config('app.tenant_id', :'tenant_id', false) AS ignored \gset
SELECT format('SELECT count(*) AS source_rows FROM biz.%I WHERE tenant_id = %L', :'source_table', :'tenant_id') AS source_sql \gset
:source_sql \gset
SELECT format('SELECT count(*) AS source_total_rows FROM biz.%I', :'source_table') AS source_total_sql \gset
:source_total_sql \gset
SELECT format('SELECT count(*) AS target_rows, count(DISTINCT record_no) AS distinct_rows, coalesce(sum(total_amount), 0) AS total_amount FROM biz.%I WHERE tenant_id = %L', :'target_table', :'tenant_id') AS target_sql \gset
:target_sql \gset
SELECT format('SELECT coalesce(json_agg(json_build_object(''recordNo'', record_no, ''amount'', total_amount) ORDER BY record_no), ''[]''::json) AS target_records FROM biz.%I WHERE tenant_id = %L', :'target_table', :'tenant_id') AS records_sql \gset
:records_sql \gset
SELECT format('SELECT count(*) AS outside_rows FROM biz.%I WHERE tenant_id != %L', :'target_table', :'tenant_id') AS outside_sql \gset
:outside_sql \gset
SET ROLE batch_business_writer;
SELECT format('SELECT count(*) AS rls_source_rows FROM biz.%I', :'source_table') AS rls_sql \gset
:rls_sql \gset
RESET ROLE;
SELECT json_build_object(
  'businessDatabase', current_database(),
  'sourceRows', :'source_rows'::int, 'sourceTotalRows', :'source_total_rows'::int, 'rlsSourceRows', :'rls_source_rows'::int,
  'targetRows', :'target_rows'::int, 'distinctRows', :'distinct_rows'::int,
  'totalAmount', :'total_amount'::numeric, 'records', :'target_records'::json,
  'outsideTargetRows', :'outside_rows'::int,
  'stagedRows', (SELECT count(*) FROM batch.process_staging WHERE tenant_id = :'tenant_id' AND batch_key = :'batch_key'),
  'generations', (SELECT coalesce(json_agg(json_build_object('id', generation_id, 'taskId', job_task_id, 'status', generation_status) ORDER BY created_at), '[]'::json)
    FROM batch.process_staging_generation WHERE tenant_id = :'tenant_id' AND batch_key = :'batch_key'),
  'activeCommitQueries', (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active' AND pid != pg_backend_pid() AND position(:'target_table' IN query) > 0 AND lower(query) LIKE '%insert into%'),
  'activeCommitUsers', (SELECT coalesce(json_agg(DISTINCT usename), '[]'::json) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active' AND pid != pg_backend_pid() AND position(:'target_table' IN query) > 0 AND lower(query) LIKE '%insert into%')
);
