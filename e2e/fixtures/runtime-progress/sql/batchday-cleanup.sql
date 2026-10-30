-- 只处理保存的数字身份；意外Job副作用阻止清理，避免隐藏失败证据。
begin;
set local lock_timeout='5s';
select set_config('app.tenant_id',:'tenant_id',true) as ignored \gset
create temporary table governance_scope on commit drop as select :'tenant_id'::text as tenant;
do $$ begin
 if exists(select 1 from batch.job_instance where tenant_id=(select tenant from governance_scope)) then raise exception 'Unexpected Job side effects'; end if;
end $$;
delete from batch.job_execution_log where tenant_id=:'tenant_id' and message='BATCH_DAY_MANUAL_OPERATION';
delete from batch.console_user_account where id=any(string_to_array(:'extra_account_ids',',')::bigint[]) and username in(:'auditor_name',:'user_name') and tenant_id=:'tenant_id';
select json_build_object('extraAccounts',(select count(*) from batch.console_user_account where id=any(string_to_array(:'extra_account_ids',',')::bigint[]) or username in(:'auditor_name',:'user_name')),
 'manualDayLogs',(select count(*) from batch.job_execution_log where tenant_id=:'tenant_id' and message='BATCH_DAY_MANUAL_OPERATION'));
commit;
