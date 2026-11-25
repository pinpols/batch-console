// 用途：隔离临时 Git 仓库测试与调用它们的提交钩子。
import { execFileSync } from 'node:child_process'

export function clearInheritedGitEnvironment() {
  const localVariables = execFileSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' })
  for (const variable of localVariables.trim().split('\n')) {
    delete process.env[variable]
  }
}
