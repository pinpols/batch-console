-- 准确限定本例审计租户，目标配置与收据仍由真实导入 API 提交。
-- DDL 同事务安装，trigger 创建失败时 function 也回滚。
BEGIN;
CREATE FUNCTION batch.:"fault_name"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'closure browser audit write fault' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER :"fault_name" BEFORE UPDATE ON batch.config_sync_log
FOR EACH ROW WHEN (NEW.tenant_id = :'tenant_id')
EXECUTE FUNCTION batch.:"fault_name"();
COMMIT;
