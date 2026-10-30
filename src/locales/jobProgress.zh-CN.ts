export default {
  stateCount: '{status}: {count}',
  title: '作业阶段与执行进度',
  status: '作业状态：{status}',
  currentStage: '当前阶段：{stage}',
  pipelineLink: '查看 Pipeline #{id}',
  PARTITION: '计划分区',
  TASK: '已创建技术任务',
  counts: '已收口 {closed} / {total}，成功 {success}，已创建 {created}',
  notCreated: '尚无运行记录',
  denominator:
    '分区分母来自本次作业计划；任务分母仅为已创建任务，不代表未来总量。收口包含失败、取消和终止，不等于成功。阶段采用运行冻结的平台版本，不从当前作业定义回填。',
  pipelineVersion: '平台 Pipeline {code}，语义版本 {version}；展示阶段顺序，条件阶段可能不执行。',
  noGraph:
    '没有可核实的平台阶段版本。保留实际阶段记录，不推断未知依赖图；GENERAL / ATOMIC 作业不一定有文件 Pipeline。',
  stage: '平台阶段',
  attempt: '尝试序号',
  processed: '已处理记录',
}
