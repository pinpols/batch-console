-- 模拟补齐缺失业务输入；重放执行仍必须经页面、审批和真实 Worker。
SELECT format('INSERT INTO biz.%I (tenant_id, record_no) VALUES (%L, 1)', :'table_name', :'tenant_id') \gexec
SELECT format('SELECT json_build_object(''businessRows'', count(*)) FROM biz.%I WHERE tenant_id = %L', :'table_name', :'tenant_id') \gexec
