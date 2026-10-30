-- 沿用 B182 的清理顺序，仅处理本例独占租户；活跃运行或意外 Job 阻止删除。
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create temporary table owned_definitions on commit drop as
select id,tenant_id from batch.workflow_definition
where tenant_id=:'tenant_id' and id=any(string_to_array(:'workflow_ids',',')::bigint[]);
do $$ begin
 perform id from batch.workflow_definition where id in(select id from owned_definitions) for update;
end $$;
create temporary table owned_runs on commit drop as
select id,tenant_id,run_status from batch.workflow_run
where tenant_id=:'tenant_id' and workflow_definition_id in(select id from owned_definitions);
create temporary table owned_requests on commit drop as
select id,tenant_id,request_id from batch.trigger_request
where tenant_id=:'tenant_id'
  and (workflow_definition_id in(select id from owned_definitions)
    or parent_workflow_run_id in(select id from owned_runs));
do $$ begin
 if exists(select 1 from owned_runs where run_status not in ('SUCCESS','SUCCESS_DRY_RUN','FAILED','FAILED_DRY_RUN','TERMINATED')) then raise exception 'Owned run still active'; end if;
 if exists(select 1 from batch.job_instance where trigger_request_id in(select id from owned_requests)) then raise exception 'Unexpected Job side effects'; end if;
end $$;
create temporary table owned_events on commit drop as
select id,event_key from batch.outbox_event
where tenant_id=:'tenant_id' and aggregate_type='WORKFLOW_RUN' and aggregate_id in(select id from owned_runs);
create temporary table owned_terminal_keys on commit drop as
select tenant_id||':workflow:'||id||':terminal' as event_key from owned_runs;
delete from batch.webhook_delivery_log where tenant_id=:'tenant_id' and terminal_event_key in(select event_key from owned_terminal_keys);
delete from batch.notification_delivery_log where tenant_id=:'tenant_id' and terminal_event_key in(select event_key from owned_terminal_keys);
delete from batch.workflow_terminal_notification_receipt where tenant_id=:'tenant_id' and event_key in(select event_key from owned_terminal_keys);
delete from batch.event_delivery_log where tenant_id=:'tenant_id' and outbox_event_id in(select id from owned_events);
delete from batch.event_outbox_retry where tenant_id=:'tenant_id' and outbox_event_id in(select id from owned_events);
delete from batch.outbox_event where tenant_id=:'tenant_id' and id in(select id from owned_events);
delete from batch.outbox_event_dedup_key where tenant_id=:'tenant_id' and event_key in(select event_key from owned_events);
delete from batch.workflow_node_run where workflow_run_id in(select id from owned_runs);
delete from batch.expected_work_occurrence where tenant_id=:'tenant_id'
 and workflow_definition_id in(select id from owned_definitions);
delete from batch.workflow_run where tenant_id=:'tenant_id' and id in(select id from owned_runs);
delete from batch.trigger_outbox_event where tenant_id=:'tenant_id' and request_id in(select request_id from owned_requests);
delete from batch.trigger_request_idempotency_alias where tenant_id=:'tenant_id' and request_id in(select request_id from owned_requests);
delete from batch.trigger_request where tenant_id=:'tenant_id' and id in(select id from owned_requests);
delete from batch.workflow_definition_version where tenant_id=:'tenant_id' and workflow_definition_id in(select id from owned_definitions);
delete from batch.file_group_expectation_definition where tenant_id=:'tenant_id'
 and workflow_definition_id in(select id from owned_definitions);
delete from batch.workflow_edge where workflow_definition_id in(select id from owned_definitions);
delete from batch.workflow_node where workflow_definition_id in(select id from owned_definitions);
delete from batch.console_operation_audit where tenant_id=:'tenant_id'
 and ((aggregate_type='workflow_definition' and aggregate_id in(select id::text from owned_definitions))
   or (aggregate_type='workflow_run' and aggregate_id in(select id::text from owned_runs)));
delete from batch.workflow_definition where tenant_id=:'tenant_id' and id in(select id from owned_definitions);
delete from batch.console_operation_audit where tenant_id=:'tenant_id';
delete from batch.batch_day_operation_audit where tenant_id=:'tenant_id';
delete from batch.batch_day_instance where tenant_id=:'tenant_id';
delete from batch.batch_day_open_cursor where tenant_id=:'tenant_id';
delete from batch.batch_day_catchup_control_event where tenant_id=:'tenant_id';
delete from batch.batch_day_catchup_control where tenant_id=:'tenant_id';
delete from batch.business_calendar where tenant_id=:'tenant_id';
delete from batch.tenant_configuration_revision where tenant_id=:'tenant_id';
delete from batch.tenant where tenant_id=:'tenant_id';
commit;
