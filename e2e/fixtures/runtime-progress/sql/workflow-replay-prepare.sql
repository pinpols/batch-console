-- 准备受控 HTTP 目标的业务输入；只准备输入，不写运行或任务状态。
BEGIN;
CREATE SCHEMA IF NOT EXISTS biz;
SELECT format('CREATE TABLE biz.%I (tenant_id text NOT NULL, record_no integer NOT NULL, PRIMARY KEY (tenant_id, record_no))', :'table_name') \gexec
SELECT format('ALTER TABLE biz.%I ENABLE ROW LEVEL SECURITY', :'table_name') \gexec
SELECT format('ALTER TABLE biz.%I FORCE ROW LEVEL SECURITY', :'table_name') \gexec
SELECT format('CREATE POLICY tenant_isolation_strict ON biz.%I FOR ALL TO PUBLIC USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))', :'table_name') \gexec
GRANT USAGE ON SCHEMA biz TO batch_business_writer;
SELECT format('GRANT SELECT ON biz.%I TO batch_business_writer', :'table_name') \gexec
COMMIT;
SELECT json_build_object('businessTables', count(*)) FROM information_schema.tables
 WHERE table_schema = 'biz' AND table_name = :'table_name';
