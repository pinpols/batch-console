-- 数字身份、租户和日历共同限定独立回读；只返回状态与业务审计，不返回凭据。
select json_build_object(
 'days',coalesce((select json_agg(json_build_object('id',id,'date',biz_date,'status',day_status,'frozen',frozen) order by biz_date)
 from batch.batch_day_instance where tenant_id=:'tenant_id' and calendar_code=:'calendar_code' and id=any(string_to_array(:'day_ids',',')::bigint[])),'[]'),
 'audits',coalesce((select json_agg(json_build_object('operation',operation_type,'operator',operator_id,'reason',coalesce(comment,reason_code)) order by id)
 from batch.batch_day_operation_audit where tenant_id=:'tenant_id' and calendar_code=:'calendar_code'),'[]'),
 'paused',(select paused from batch.batch_day_catchup_control where tenant_id=:'tenant_id' and calendar_code=:'calendar_code'),
 'catchupEvents',coalesce((select json_agg(json_build_object('action',action,'reason',reason) order by id)
 from batch.batch_day_catchup_control_event where tenant_id=:'tenant_id' and calendar_code=:'calendar_code'),'[]'));
