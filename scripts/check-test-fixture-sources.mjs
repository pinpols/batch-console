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
const testConfig = JSON.parse(readFileSync(join(root, 'e2e/test-config.json'), 'utf8'))
const platformServiceOrigins = new Set(
  [
    testConfig.frontendBaseUrl,
    testConfig.apiBaseUrl,
    testConfig.orchestratorBaseUrl,
    testConfig.mockServerBaseUrl,
    testConfig.prometheusBaseUrl,
    testConfig.alertmanagerBaseUrl,
  ]
    .filter(Boolean)
    .map((value) => new URL(value).origin),
)

function sourceViolations(file, text) {
  const relativeFile = file.replaceAll('\\', '/')
  const isTest =
    (relativeFile.startsWith('src/') && relativeFile.endsWith('.test.ts')) ||
    (relativeFile.startsWith('e2e/') && /\.(ts|cjs|mjs)$/.test(relativeFile)) ||
    relativeFile === 'playwright.config.cjs'
  const isE2e = relativeFile.startsWith('e2e/') || relativeFile === 'playwright.config.cjs'
  const source = ts.createSourceFile(relativeFile, text, ts.ScriptTarget.Latest, true)
  const violations = []

  function visit(node) {
    const urlText = ts.isStringLiteralLike(node)
      ? node.text
      : ts.isTemplateExpression(node)
        ? node.head.text
        : null
    if (isTest && relativeFile !== contractTest && ts.isStringLiteralLike(node)) {
      if (persistedKeyPattern.test(node.text)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
        violations.push(
          `${relativeFile}:${line + 1}: 测试不得重复写持久化键 ${node.text}；请引用权威常量，契约预期放在 ${contractTest}`,
        )
      }
    }
    const dynamicPortAuthority =
      ts.isTemplateExpression(node) && /^https?:\/\/[^/]+:$/.test(urlText ?? '')
    if (isTest && isE2e && urlText && !dynamicPortAuthority && /^https?:\/\//.test(urlText)) {
        try {
          const url = new URL(urlText)
          const isLocalService = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
          if (isLocalService || platformServiceOrigins.has(url.origin)) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
            violations.push(
              `${relativeFile}:${line + 1}: 测试不得重复写平台服务地址 ${urlText}；请使用 e2e/config.cjs 或相对页面路径`,
            )
          }
        } catch {
          // Malformed URL fixtures are handled by the behavior test that owns them.
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
  if (!passed)
    console.error(`  expected ${expected} finding(s), got ${actual.length}: ${actual.join('; ')}`)
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
  const badE2eKey = sourceViolations(
    'e2e/example.spec.ts',
    "localStorage.setItem('batch-console-session', '1')",
  )
  const badE2eHelperKey = sourceViolations(
    'e2e/support/example.ts',
    "localStorage.setItem('batch-console-session', '1')",
  )
  const allowedE2eFixture = sourceViolations(
    'e2e/example.spec.ts',
    "localStorage.setItem('tenant-a', '1')",
  )
  const badE2eEndpoint = sourceViolations(
    'e2e/example.spec.ts',
    "page.goto('http://localhost:5173/jobs')",
  )
  const badE2eTemplateEndpoint = sourceViolations(
    'e2e/example.spec.ts',
    'page.goto(`http://localhost:5173/jobs/${jobId}`)',
  )
  const allowedDynamicLocalEndpoint = sourceViolations(
    'e2e/example.spec.ts',
    'page.goto(`http://127.0.0.1:${serverPort}/health`)',
  )
  const staleDefaultAfterSourceChange = sourceViolations(
    'e2e/example.spec.ts',
    "page.goto('http://localhost:5174/jobs')",
  )
  const allowedExternalEndpoint = sourceViolations(
    'e2e/example.spec.ts',
    "expect(url).toBe('https://tenant.example/path')",
  )
  const allowedSharedStub = sourceViolations(
    sharedStorageStub,
    "vi.stubGlobal('localStorage', { getItem: () => null })",
  )

  const results = [
    assertSelfTest('重复持久化键应拦截', badDuplicate, 1),
    assertSelfTest('测试内联 localStorage 桩应拦截', badInlineStub, 1),
    assertSelfTest('独立键契约预期应放行', allowedContract, 0),
    assertSelfTest('测试专属租户数据应放行', allowedTestData, 0),
    assertSelfTest('E2E 重复持久化键应拦截', badE2eKey, 1),
    assertSelfTest('E2E 公共 helper 重复持久化键应拦截', badE2eHelperKey, 1),
    assertSelfTest('E2E 场景数据应放行', allowedE2eFixture, 0),
    assertSelfTest('重复平台服务地址应拦截', badE2eEndpoint, 1),
    assertSelfTest('模板字符串中的平台服务地址应拦截', badE2eTemplateEndpoint, 1),
    assertSelfTest('动态临时服务端口应放行', allowedDynamicLocalEndpoint, 0),
    assertSelfTest('事实源变更后旧本地服务地址仍应拦截', staleDefaultAfterSourceChange, 1),
    assertSelfTest('外部服务契约地址应放行', allowedExternalEndpoint, 0),
    assertSelfTest('共享 localStorage 桩实现应放行', allowedSharedStub, 0),
  ]
  if (results.some((passed) => !passed)) {
    console.error(
      '❌ 不通过 | code=TEST_FIXTURE_SOURCES_SELF_TEST | gate=测试配置事实来源 | exit_code=1 | action=fix_and_retry',
    )
    process.exit(1)
  }
}

function collectTests(directory, files = []) {
  const isE2eDirectory = relative(root, directory).replaceAll('\\', '/').split('/').includes('e2e')
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    const stat = statSync(path)
    if (stat.isDirectory()) collectTests(path, files)
    else if (
      name.endsWith('.test.ts') ||
      (isE2eDirectory && /\.(ts|cjs|mjs)$/.test(name))
    )
      files.push(path)
  }
  return files
}

runSelfTests()

const testFiles = [...collectTests(sourceRoot), ...collectTests(join(root, 'e2e'))]
const violations = testFiles.flatMap((file) =>
  sourceViolations(relative(root, file), readFileSync(file, 'utf8')),
)

if (violations.length) {
  console.error('[test-fixture-sources] 检查失败:')
  for (const violation of violations) console.error(`- ${violation}`)
  console.error(
    '❌ 不通过 | code=TEST_FIXTURE_SOURCES | gate=测试配置事实来源 | exit_code=1 | action=fix_and_retry',
  )
  process.exit(1)
}

console.log(`[test-fixture-sources] 已检查 ${testFiles.length} 个测试文件`)
console.log(
  '✅ 通过 | code=TEST_FIXTURE_SOURCES | gate=测试配置事实来源 | exit_code=0 | action=none',
)
