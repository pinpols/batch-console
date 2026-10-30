// 按 jobType 预填触发 payload 模板:文件/内容型作业需要的必填字段(英文字段名,非 i18n 文案)。
export function triggerInputTemplate(jobType: string | undefined): string {
  switch (jobType) {
    case 'IMPORT':
      return '{\n  "templateCode": "",\n  "content": "header1,header2\\nvalue1,value2"\n}'
    case 'EXPORT':
      return '{\n  "templateCode": ""\n}'
    case 'DISPATCH':
      return '{\n  "fileId": 0\n}'
    default:
      return '{}'
  }
}
