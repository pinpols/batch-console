-- 只观察本夹具唯一 application_name；排除当前检查连接本身。
SELECT count(*)
  FROM pg_stat_activity
 WHERE datname = current_database()
   AND application_name = :'application_name'
   AND pid <> pg_backend_pid();
