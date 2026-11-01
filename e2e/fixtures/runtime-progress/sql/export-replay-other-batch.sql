-- 只为本次隔离租户增加另一批次，用于证明导出 SQL 的批次过滤真实生效。
BEGIN;
SELECT format('INSERT INTO biz.%I VALUES (2, %L, %L)', :'batch_table', :'tenant_id', :'batch_no' || '-other') \gexec
SELECT format('INSERT INTO biz.%I VALUES (%L, 2, 999998, ''OUTSIDE-BATCH'', -2)', :'detail_table', :'tenant_id') \gexec
-- 其他租户使用相同批次号并保留真实关联，确保租户过滤不是仅由 JOIN 偶然排除。
SELECT format('INSERT INTO biz.%I VALUES (3, %L, %L)', :'batch_table', :'tenant_id' || '-other', :'batch_no') \gexec
SELECT format('UPDATE biz.%I SET batch_id = 3 WHERE tenant_id = %L AND record_no = ''OUTSIDE-TENANT''', :'detail_table', :'tenant_id' || '-other') \gexec
COMMIT;
SELECT json_build_object('insertedRows', count(*)) FROM batch.tenant WHERE tenant_id = :'tenant_id';
