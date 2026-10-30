-- 独占只读导出源；延迟视图仅提供真实GENERATE观察窗口，不写运行状态。
BEGIN;
CREATE SCHEMA IF NOT EXISTS biz;
SELECT format('CREATE TABLE biz.%I (id bigint PRIMARY KEY, tenant_id text NOT NULL, batch_no text NOT NULL)', :'batch_table') \gexec
SELECT format('CREATE TABLE biz.%I (tenant_id text NOT NULL, batch_id bigint NOT NULL, row_no bigint NOT NULL, record_no text NOT NULL, amount numeric NOT NULL, PRIMARY KEY (tenant_id, row_no))', :'detail_table') \gexec
SELECT format('ALTER TABLE biz.%I ENABLE ROW LEVEL SECURITY', name) FROM unnest(ARRAY[:'batch_table', :'detail_table']) name \gexec
SELECT format('ALTER TABLE biz.%I FORCE ROW LEVEL SECURITY', name) FROM unnest(ARRAY[:'batch_table', :'detail_table']) name \gexec
SELECT format('CREATE POLICY tenant_isolation_strict ON biz.%I FOR ALL TO PUBLIC USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))', name) FROM unnest(ARRAY[:'batch_table', :'detail_table']) name \gexec
SELECT format('INSERT INTO biz.%I VALUES (1, %L, %L)', :'batch_table', :'tenant_id', :'batch_no') \gexec
SELECT format('INSERT INTO biz.%I SELECT %L, 1, n, lpad(n::text, 6, ''0''), n * 1.25 FROM generate_series(1, 1200) n', :'detail_table', :'tenant_id') \gexec
SELECT format('INSERT INTO biz.%I VALUES (%L, 1, 999999, ''OUTSIDE-TENANT'', -1)', :'detail_table', :'tenant_id' || '-other') \gexec
SELECT format('CREATE INDEX ON biz.%I (tenant_id, batch_id, row_no)', :'detail_table') \gexec
SELECT format('ANALYZE biz.%I', :'detail_table') \gexec
SELECT format('CREATE VIEW biz.%I WITH (security_invoker=true) AS SELECT tenant_id, batch_id, row_no, record_no, amount FROM biz.%I WHERE pg_sleep(0.04) IS NOT NULL', :'detail_view', :'detail_table') \gexec
GRANT USAGE ON SCHEMA biz TO batch_business_writer;
SELECT format('GRANT SELECT ON biz.%I TO batch_business_writer', name) FROM unnest(ARRAY[:'batch_table', :'detail_table', :'detail_view']) name \gexec
INSERT INTO batch.file_template_config (
  tenant_id, template_code, template_name, template_type, file_format_type,
  charset, delimiter, quote_char, escape_char, header_rows, footer_rows,
  checksum_type, compress_type, encrypt_type, field_mappings, query_param_schema,
  streaming_enabled, page_size, fetch_size, chunk_size, export_data_ref,
  enabled, version, created_by, updated_by
) VALUES (
  :'tenant_id', :'template_code', 'Whole Workflow replay export source', 'EXPORT', 'DELIMITED',
  'UTF-8', ',', '"', '"', 1, 0, 'SHA-256', 'NONE', 'NONE',
  '[{"name":"recordNo","sourceColumn":"record_no","type":"STRING"},{"name":"amount","sourceColumn":"amount","type":"DECIMAL"}]'::jsonb,
  jsonb_build_object('csvColumns', jsonb_build_array(
      jsonb_build_object('header','recordNo','source','detail.record_no'),
      jsonb_build_object('header','amount','source','detail.amount')),
    'jdbcMappedExport', jsonb_build_object(
    'schema', 'biz', 'batchTable', :'batch_table', 'batchTenantColumn', 'tenant_id',
    'batchNoColumn', 'batch_no', 'batchSelectColumns', jsonb_build_array('id','batch_no','tenant_id'),
    'detailTable', :'detail_view', 'detailFkColumn', 'batch_id', 'detailOrderByColumn', 'row_no',
    'detailSelectColumns', jsonb_build_array('row_no','record_no','amount'))),
  true, 25, 25, 25, 'jdbc_mapped_export', true, 1, 'e2e', 'e2e'
);
COMMIT;
SELECT json_build_object('templates', count(*)) FROM batch.file_template_config
 WHERE tenant_id = :'tenant_id' AND template_code = :'template_code';
