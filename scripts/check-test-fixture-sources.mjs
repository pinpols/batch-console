#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = join(root, 'src')
const contractTest = 'src/constants/storageKeys.test.ts'
const sharedStorageStub = 'src/test-utils/localStorage.ts'
const persistedKeyPattern = /^batch-console(?:-|:)/

function sourceViolations(file, text) {
  const relativeFile = file.replaceAll('\\', '/')
  const isTest = relativeFile.startsWith('src/') && relativeFile.endsWith('.test.ts')
  const source = ts.createSourceFile(relativeFile, text, ts.ScriptTarget.Latest, true)
  const violations = []

  function visit(node) {
    if (isTest && relativeFile !== contractTest && ts.isStringLiteralLike(node)) {
      if (persistedKeyPattern.test(node.text)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
        violations.push(
          `${relativeFile}:${line + 1}: 测试不得重复写持久化键 ${node.text}；请引用权威常量，契约预期放在 ${contractTest}`,
        )
      }
    }

    if (
      isTest &&
      relativeFile !== sharedStorageStub &&
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'vi' &&
      node.expression.name.text === 'stubGlobal' &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      node.arguments[0].text === 'localStorage'
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
      violations.push(
        `${relativeFile}:${line + 1}: 测试应复用 ${sharedStorageStub}，不要内联创建 localStorage 桩`,
      )
    }

    ts.forEachChild(node, visit)
  }

  visit(source)
  return violations
}

function assertSelfTest(name, actual, expected) {
  const passed = actual.length === expected
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
  if (!passed) console.error(`  expected ${expected} finding(s), got ${actual.length}: ${actual.join('; ')}`)
  return passed
}

function runSelfTests() {
  const badDuplicate = sourceViolations(
    'src/example.test.ts',
    "storage.set('batch-console-session', '1')",
  )
  const badInlineStub = sourceViolations(
    'src/example.test.ts',
    "vi.stubGlobal('localStorage', { getItem: () => null })",
  )
  const allowedContract = sourceViolations(
    contractTest,
    "expect(STORAGE_KEYS.session).toBe('batch-console-session')",
  )
  const allowedTestData = sourceViolations('src/example.test.ts', "storage.set('tenant-a', '1')")
  const allowedSharedStub = sourceViolations(
    sharedStorageStub,
    "vi.stubGlobal('localStorage', { getItem: () => null })",
  )

  const results = [
    assertSelfTest('重复持久化键应拦截', badDuplicate, 1),
    assertSelfTest('测试内联 localStorage 桩应拦截', badInlineStub, 1),
    assertSelfTest('独立键契约预期应放行', allowedContract, 0),
    assertSelfTest('测试专属租户数据应放行', allowedTestData, 0),
    assertSelfTest('共享 localStorage 桩实现应放行', allowedSharedStub, 0),
  ]
  if (results.some((passed) => !passed)) process.exit(1)
}

function collectTests(directory, files = []) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    const stat = statSync(path)
    if (stat.isDirectory()) collectTests(path, files)
    else if (name.endsWith('.test.ts')) files.push(path)
  }
  return files
}

runSelfTests()

const testFiles = collectTests(sourceRoot)
const violations = testFiles.flatMap((file) =>
  sourceViolations(relative(root, file), readFileSync(file, 'utf8')),
)

if (violations.length) {
  console.error('[test-fixture-sources] 检查失败:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log(`[test-fixture-sources] 通过，检查 ${testFiles.length} 个测试文件`)
