SELECT json_build_object(
  'relations', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'biz'
    AND table_name IN (:'detail_table', :'batch_table', :'detail_view')),
  'templates', (SELECT count(*) FROM batch.file_template_config
    WHERE tenant_id = :'tenant_id' AND template_code = :'template_code')
);
