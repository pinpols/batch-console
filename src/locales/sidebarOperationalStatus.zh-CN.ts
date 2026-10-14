export default {
  operationalStatus: {
    normal: '服务正常',
    scheduled: '计划维护',
    readOnly: '只读维护中',
    maintenance: '系统维护中',
    adminBypass: '维护中（管理员诊断）',
    degraded: '服务降级',
    unknown: '状态未知',
  },
  operationalStatusDescription: {
    normal: '服务运行正常，维护状态已同步，当前没有生效中的维护或已知降级。',
    scheduled: '已发布维护公告，计划时间尚未生效。',
    readOnly: '当前处于只读维护，写操作受限。',
    maintenance: '当前处于全冻结维护，普通业务请求受限。',
    adminBypass: '维护期间允许管理员有限诊断读取，业务写操作仍受保护。',
    degraded: '最近收到后端降级信号，部分数据或功能可能受限。',
    unknown: '维护状态尚未同步、已过期或同步失败。',
  },
}
