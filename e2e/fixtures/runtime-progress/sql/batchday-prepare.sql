-- 独占租户：仅建立治理前置状态；后续状态变更全部通过被验收API执行。
begin;
with added as (
 insert into batch.console_user_account(tenant_id,username,display_name,password_hash,authorities_csv,enabled,must_change_password)
 select :'tenant_id', v.name, v.name, a.password_hash, v.role, true, false
 from batch.console_user_account a
 cross join (values (:'auditor_name','ROLE_AUDITOR'),(:'user_name','ROLE_TENANT_USER')) v(name,role)
 where a.username=:'admin_name' and a.tenant_id='system'
 returning id
), days as (
 insert into batch.batch_day_instance(tenant_id,calendar_code,biz_date,day_status,cutoff_at,frozen)
 values (:'tenant_id',:'calendar_code',:'day_date'::date,'OPEN',current_timestamp+interval '14 days',false),
        (:'tenant_id',:'calendar_code',:'day_date'::date+1,'CUTOFF',current_timestamp-interval '1 hour',true)
 returning id
)
select json_build_object('accountIds',(select json_agg(id) from added),'dayIds',(select json_agg(id) from days));
commit;
