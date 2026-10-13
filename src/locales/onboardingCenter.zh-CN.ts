const onboardingCenter = {
  eyebrow: '快速开始',
  continue: '继续配置',
  remindLater: '稍后提醒',
  progress: '已完成 {completed}/{total} 项',
  partialFailure: '部分状态暂时无法读取；已保留成功加载的进度，可稍后刷新。',
  completedTitle: '当前角色的基础接入已完成',
  completedDescription: '引导中心会保留在这里，后续可随时回来复核配置和运行状态。',
  blockers: '{count} 项配置待处理',
  moreBlockers: '另有 {count} 项，请进入配置页查看完整清单。',
  importConfig: '导入配置包',
  viewGuide: '查看指南',
  role: {
    admin: {
      title: '完成平台首条可运行链路',
      description: '按租户、作业、配置、Worker 和成功运行的顺序完成基础接入。',
    },
    auditor: {
      title: '建立运行与审计视角',
      description: '先确认租户和运行记录，再进入操作审计完成巡检入口。',
    },
    tenantAdmin: {
      title: '让当前租户具备运行条件',
      description: '完成作业配置与就绪检查，接入 Worker，并验证首个成功实例。',
    },
    tenantUser: {
      title: '运行并确认首个作业',
      description: '确认管理员已准备可运行作业，然后发起运行并查看结果。',
    },
  },
  status: {
    completed: '已完成',
    current: '可开始',
    blocked: '需处理',
    pending: '待前置步骤',
    unavailable: '状态未知',
  },
  step: {
    'tenant-context': {
      title: '确定工作租户',
      description: '选择要操作的业务租户，后续配置和运行数据都按租户隔离。',
      blockedDescription: '当前账号没有可用租户，请联系平台管理员分配租户。',
      action: '管理租户',
    },
    'job-config': {
      title: '创建作业配置',
      description: '新建一个作业定义，或通过配置包一次导入所需资源。',
      action: '新建作业',
    },
    'configuration-readiness': {
      title: '消除配置阻塞项',
      description: '使用租户就绪检查定位缺失引用和关键配置，逐项修复后再运行。',
      action: '处理配置',
    },
    'worker-online': {
      title: '让 Worker 上线',
      description: '确认至少一个执行 Worker 已注册并在线，能够接收当前租户任务。',
      action: '查看 Worker',
    },
    'first-success': {
      title: '完成首个成功运行',
      description: '发起一次作业运行，并在实例列表确认它成功结束。',
      blockedDescription: '管理员尚未准备可运行作业，请联系租户管理员。',
      action: '运行作业',
    },
    'runnable-job': {
      title: '确认可运行作业',
      description: '当前租户已有作业定义，可以进入列表选择作业。',
      blockedDescription: '当前租户还没有作业定义，请联系租户管理员完成配置。',
      action: '查看作业',
    },
    'inspect-run': {
      title: '检查运行实例',
      description: '查看实例状态、时间线与异常信息，建立日常巡检入口。',
      action: '查看实例',
    },
    'audit-trail': {
      title: '查看操作审计',
      description: '打开操作审计记录，确认关键变更可以按操作者和时间追溯。',
      action: '打开审计',
    },
  },
} as const

export default onboardingCenter
