-- 只向本例独立业务库准备源/目标和延迟触发器，不写平台运行状态。
BEGIN;
SELECT set_config('app.tenant_id', :'tenant_id', true) AS ignored \gset
SELECT format('CREATE TABLE biz.%I (tenant_id text NOT NULL, record_no text NOT NULL, amount numeric NOT NULL, PRIMARY KEY (tenant_id, record_no))', :'source_table') \gexec
SELECT format('CREATE TABLE biz.%I (tenant_id text NOT NULL, record_no text NOT NULL, total_amount numeric NOT NULL, PRIMARY KEY (tenant_id, record_no))', :'target_table') \gexec
SELECT format('ALTER TABLE biz.%I ENABLE ROW LEVEL SECURITY', name) FROM (VALUES (:'source_table'), (:'target_table')) AS owned(name) \gexec
SELECT format('ALTER TABLE biz.%I FORCE ROW LEVEL SECURITY', name) FROM (VALUES (:'source_table'), (:'target_table')) AS owned(name) \gexec
SELECT format('CREATE POLICY tenant_isolation_strict ON biz.%I FOR ALL TO PUBLIC USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))', name) FROM (VALUES (:'source_table'), (:'target_table')) AS owned(name) \gexec
SELECT format('GRANT SELECT, INSERT, UPDATE, DELETE ON biz.%I TO batch_business_writer', name) FROM (VALUES (:'source_table'), (:'target_table')) AS owned(name) \gexec
SELECT format('INSERT INTO biz.%I SELECT %L, lpad(n::text, 6, ''0''), n * 1.25 FROM generate_series(1,600) AS n', :'source_table', :'tenant_id') \gexec
SELECT format('INSERT INTO biz.%I VALUES (%L, ''OUTSIDE-TENANT'', 999999)', :'source_table', :'outside_tenant_id') \gexec
SELECT format($ddl$
  CREATE FUNCTION biz.%I() RETURNS trigger LANGUAGE plpgsql AS $body$
  BEGIN
    PERFORM pg_sleep(0.08);
    RETURN NEW;
  END
  $body$
$ddl$, :'pause_function') \gexec
SELECT format('CREATE TRIGGER process_commit_pause BEFORE INSERT ON biz.%I FOR EACH ROW EXECUTE FUNCTION biz.%I()', :'target_table', :'pause_function') \gexec
COMMIT;
SELECT json_build_object('preparedTables', 2);
