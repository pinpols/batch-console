-- 独占验收表的写入延迟用于观察真实 LOAD 进度，不直接写执行状态。
BEGIN;
CREATE SCHEMA IF NOT EXISTS biz;
SELECT format('CREATE TABLE biz.%I (tenant_id text NOT NULL, record_no text NOT NULL, amount numeric NOT NULL, PRIMARY KEY (tenant_id, record_no))', :'table_name') \gexec
SELECT format('ALTER TABLE biz.%I ENABLE ROW LEVEL SECURITY', :'table_name') \gexec
SELECT format('ALTER TABLE biz.%I FORCE ROW LEVEL SECURITY', :'table_name') \gexec
SELECT format('CREATE POLICY tenant_isolation_strict ON biz.%I FOR ALL TO PUBLIC USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))', :'table_name') \gexec
GRANT USAGE ON SCHEMA biz TO batch_business_writer;
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON biz.%I TO batch_business_writer', :'table_name') \gexec
SELECT format($ddl$
  CREATE FUNCTION biz.%I() RETURNS trigger LANGUAGE plpgsql AS $body$
  BEGIN
    PERFORM pg_sleep(0.08);
    RETURN NEW;
  END
  $body$
$ddl$, :'pause_function') \gexec
SELECT format('CREATE TRIGGER import_progress_pause BEFORE INSERT ON biz.%I FOR EACH ROW EXECUTE FUNCTION biz.%I()', :'table_name', :'pause_function') \gexec

INSERT INTO batch.file_template_config (
  tenant_id, template_code, template_name, template_type, file_format_type,
  charset, delimiter, quote_char, escape_char, header_rows, footer_rows,
  checksum_type, compress_type, encrypt_type, field_mappings, query_param_schema,
  streaming_enabled, page_size, fetch_size, chunk_size, load_target_ref,
  enabled, version, created_by, updated_by
) VALUES (
  :'tenant_id', :'template_code', 'Real file Pipeline progress acceptance', 'IMPORT', 'DELIMITED',
  'UTF-8', ',', '"', '"', 1, 0,
  'NONE', 'NONE', 'NONE',
  '[{"name":"recordNo","targetColumn":"record_no","type":"STRING","required":true},{"name":"amount","targetColumn":"amount","type":"DECIMAL","required":true}]'::jsonb,
  jsonb_build_object('jdbcMappedImport', jsonb_build_object(
    'schema', 'biz', 'table', :'table_name', 'tenantColumn', 'tenant_id',
    'columnMappings', jsonb_build_array(
      jsonb_build_object('from', 'recordNo', 'to', 'record_no'),
      jsonb_build_object('from', 'amount', 'to', 'amount')),
    'conflictColumns', jsonb_build_array('tenant_id', 'record_no'))),
  true, 25, 25, 25, 'jdbc_mapped', true, 1, 'e2e', 'e2e'
);
COMMIT;
SELECT json_build_object('templates', count(*)) FROM batch.file_template_config
 WHERE tenant_id = :'tenant_id' AND template_code = :'template_code';
