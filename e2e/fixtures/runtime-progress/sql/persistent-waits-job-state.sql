SELECT json_build_object(
  'status', wait_status,
  'attempts', attempt_count,
  'reason', last_not_ready_reason
)
FROM batch.job_dependency_waiting_launch
WHERE tenant_id = :'tenant_id' AND request_id = :'job_wait_request_id';
