SELECT format('SELECT json_build_object(''businessRows'', count(*)) FROM biz.%I WHERE tenant_id = %L', :'table_name', :'tenant_id') \gexec
