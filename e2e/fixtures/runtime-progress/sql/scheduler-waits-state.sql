SELECT json_build_object(
  'calendarRows', (SELECT count(*) FROM batch.calendar_dependency_wait
                    WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                      AND biz_date = :'calendar_biz_date'),
  'calendarStatus', (SELECT wait_status FROM batch.calendar_dependency_wait
                      WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                        AND biz_date = :'calendar_biz_date'),
  'batchDayRows', (SELECT count(*) FROM batch.batch_day_instance
                    WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                      AND biz_date = :'calendar_biz_date'),
  'batchDayStatus', (SELECT day_status FROM batch.batch_day_instance
                      WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                        AND biz_date = :'calendar_biz_date' ORDER BY id DESC LIMIT 1),
  'manualAction', (SELECT manual_action FROM batch.calendar_dependency_wait
                    WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                      AND biz_date = :'calendar_biz_date'),
  'manualReason', (SELECT manual_reason FROM batch.calendar_dependency_wait
                    WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                      AND biz_date = :'calendar_biz_date'),
  'manualOperatorPresent', (SELECT manual_operator_id IS NOT NULL
                             FROM batch.calendar_dependency_wait
                            WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                              AND biz_date = :'calendar_biz_date'),
  'jobRows', (SELECT count(*) FROM batch.job_dependency_waiting_launch
               WHERE tenant_id = :'tenant_id' AND job_code = :'job_code'),
  'jobWaitRequestId', (SELECT request_id FROM batch.job_dependency_waiting_launch
                        WHERE tenant_id = :'tenant_id' AND job_code = :'job_code'
                        ORDER BY id DESC LIMIT 1),
  'jobWaitStatus', (SELECT wait_status FROM batch.job_dependency_waiting_launch
                     WHERE tenant_id = :'tenant_id' AND job_code = :'job_code'
                     ORDER BY id DESC LIMIT 1),
  'triggerRequestRows', (SELECT count(*) FROM batch.trigger_request
                          WHERE tenant_id = :'tenant_id'
                            AND request_id = (SELECT request_id FROM batch.job_dependency_waiting_launch
                                               WHERE tenant_id = :'tenant_id' AND job_code = :'job_code'
                                               ORDER BY id DESC LIMIT 1)),
  'triggerRequestStatus', (SELECT request_status FROM batch.trigger_request
                            WHERE tenant_id = :'tenant_id'
                              AND request_id = (SELECT request_id FROM batch.job_dependency_waiting_launch
                                                 WHERE tenant_id = :'tenant_id' AND job_code = :'job_code'
                                                 ORDER BY id DESC LIMIT 1)),
  'jobCode', :'job_code',
  'privatePayloadMarkerPresent', (SELECT launch_payload #> '{params,privatePayloadMarker}' IS NOT NULL
                                   FROM batch.job_dependency_waiting_launch
                                  WHERE tenant_id = :'tenant_id' AND job_code = :'job_code'
                                  ORDER BY id DESC LIMIT 1),
  'jobDefinitionRows', (SELECT count(*) FROM batch.job_definition
                         WHERE tenant_id = :'tenant_id'
                           AND job_code IN (:'job_code', :'upstream_job_code')),
  'dependencyRows', (SELECT count(*) FROM batch.job_dependency
                      WHERE tenant_id = :'tenant_id' AND downstream_job_code = :'job_code'),
  'releaseCalendarRows', (SELECT count(*) FROM batch.calendar_dependency_wait
                           WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                             AND biz_date = :'release_biz_date'),
  'releaseCalendarStatus', (SELECT wait_status FROM batch.calendar_dependency_wait
                             WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                               AND biz_date = :'release_biz_date'),
  'releaseManualAction', (SELECT manual_action FROM batch.calendar_dependency_wait
                           WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                             AND biz_date = :'release_biz_date'),
  'releaseManualReason', (SELECT manual_reason FROM batch.calendar_dependency_wait
                           WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                             AND biz_date = :'release_biz_date'),
  'releaseManualOperatorPresent', (SELECT manual_operator_id IS NOT NULL
                                    FROM batch.calendar_dependency_wait
                                   WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                                     AND biz_date = :'release_biz_date'),
  'releaseBatchDayRows', (SELECT count(*) FROM batch.batch_day_instance
                           WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                             AND biz_date = :'release_biz_date'),
  'releaseBatchDayStatus', (SELECT day_status FROM batch.batch_day_instance
                             WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                               AND biz_date = :'release_biz_date' ORDER BY id DESC LIMIT 1),
  'releaseBatchOperationReason', (SELECT operation_reason FROM batch.batch_day_instance
                                   WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                                     AND biz_date = :'release_biz_date' ORDER BY id DESC LIMIT 1),
  'releaseBatchOperatedByPresent', (SELECT operated_by IS NOT NULL FROM batch.batch_day_instance
                                     WHERE tenant_id = :'tenant_id' AND calendar_code = :'calendar_code'
                                       AND biz_date = :'release_biz_date' ORDER BY id DESC LIMIT 1)
);
