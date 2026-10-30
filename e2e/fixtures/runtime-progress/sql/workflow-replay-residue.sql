-- 独立检查所有本例租户表，不能仅凭父记录删除推断副作用全部清零。
CREATE TEMP TABLE owned_replay_tenant AS SELECT :'tenant_id'::text AS tenant_id;
CREATE TEMP TABLE owned_replay_residue (table_name text, row_count bigint);
DO $$
DECLARE
  target record;
  owned_tenant text := (SELECT tenant_id FROM owned_replay_tenant);
  remaining bigint;
BEGIN
  FOR target IN
    SELECT columns.table_schema, columns.table_name
      FROM information_schema.columns columns
      JOIN information_schema.tables tables
        ON tables.table_schema = columns.table_schema AND tables.table_name = columns.table_name
     WHERE columns.column_name = 'tenant_id'
       AND columns.table_schema IN ('batch', 'archive', 'biz')
       AND tables.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE tenant_id = $1', target.table_schema, target.table_name)
      INTO remaining USING owned_tenant;
    IF remaining > 0 THEN
      INSERT INTO owned_replay_residue VALUES (target.table_schema || '.' || target.table_name, remaining);
    END IF;
  END LOOP;
END $$;
SELECT coalesce(json_object_agg(table_name, row_count), '{}'::json) FROM owned_replay_residue;
