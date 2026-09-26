#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const packageJsonPath = join(rootDir, 'package.json')
const lockPath = join(rootDir, 'package-lock.json')
const outDir = join(rootDir, 'docs', 'compliance')
const sbomPath = join(outDir, 'sbom.json')
const thirdPartyPath = join(outDir, 'THIRD-PARTY-LICENSES.md')

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
const lockPackages = lock.packages || {}
const rootPackage = lockPackages[''] || {}

function parsePackagePath(path) {
  const prefix = 'node_modules/'
  if (!path.startsWith(prefix)) return null
  const name = path.slice(prefix.length)
  if (!name || name.includes('/node_modules/')) return null
  return name
}

function purl(name, version) {
  const encoded = name.startsWith('@')
    ? '@' + name.slice(1).split('/').map(encodeURIComponent).join('/')
    : encodeURIComponent(name)
  return `pkg:npm/${encoded}@${encodeURIComponent(version)}`
}

function normalizeLicense(value) {
  if (!value || typeof value !== 'string') return 'NOASSERTION'
  return value.trim() || 'NOASSERTION'
}

const components = Object.entries(lockPackages)
  .map(([path, meta]) => {
    const name = parsePackagePath(path)
    if (!name || !meta.version) return null
    const license = normalizeLicense(meta.license)
    const component = {
      type: 'library',
      'bom-ref': `pkg:npm/${name}@${meta.version}`,
      name,
      version: String(meta.version),
      purl: purl(name, String(meta.version)),
      licenses: [{ license: { id: license } }],
      scope: rootPackage.dependencies?.[name] ? 'required' : 'optional',
    }
    if (meta.resolved) {
      component.externalReferences = [{ type: 'distribution', url: meta.resolved }]
    }
    return component
  })
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version))

const dependencies = [
  {
    ref: `pkg:npm/${packageJson.name}@${packageJson.version}`,
    dependsOn: components.map((component) => component['bom-ref']),
  },
]

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.6',
  serialNumber: `urn:uuid:${createHash('sha256')
    .update(`${packageJson.name}@${packageJson.version}:${components.length}`)
    .digest('hex')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, '$1-$2-$3-$4-$5')}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: {
      type: 'application',
      name: packageJson.name,
      version: packageJson.version,
      licenses: [{ license: { id: packageJson.license || 'NOASSERTION' } }],
      purl: `pkg:npm/${packageJson.name}@${packageJson.version}`,
    },
    tools: {
      components: [
        {
          type: 'application',
          name: 'scripts/generate-frontend-compliance.mjs',
          version: '1',
        },
      ],
    },
  },
  components,
  dependencies,
}

const licenseCounts = new Map()
for (const component of components) {
  const license = component.licenses[0].license.id
  licenseCounts.set(license, (licenseCounts.get(license) || 0) + 1)
}

function tableRows(rows) {
  return rows.map((row) => `| ${row.join(' | ')} |`).join('\n')
}

const directDependencies = Object.entries(packageJson.dependencies || {}).sort(([a], [b]) =>
  a.localeCompare(b),
)
const devDependencies = Object.entries(packageJson.devDependencies || {}).sort(([a], [b]) =>
  a.localeCompare(b),
)

const markdown = `# 前端第三方软件使用声明

**Product**: \`${packageJson.name}\`
**Version**: \`${packageJson.version}\`
**License**: \`${packageJson.license || 'NOASSERTION'}\`
**Generated**: \`${new Date().toISOString().slice(0, 10)}\`
**Source**: \`package.json\` + \`package-lock.json\`

本文档是前端仓库第三方 npm 组件的人工可读快照。机器可读 SBOM 见 [sbom.json](./sbom.json)。

## 摘要

| Item | Count |
|---|---:|
| Runtime direct dependencies | ${directDependencies.length} |
| Development direct dependencies | ${devDependencies.length} |
| Resolved lockfile components | ${components.length} |

## 许可证分布

| License | Component count |
|---|---:|
${tableRows([...licenseCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([license, count]) => [license, String(count)]))}

## 运行时直接依赖

| Package | Version range |
|---|---|
${tableRows(directDependencies.map(([name, version]) => [`\`${name}\``, `\`${version}\``]))}

## 开发期直接依赖

| Package | Version range |
|---|---|
${tableRows(devDependencies.map(([name, version]) => [`\`${name}\``, `\`${version}\``]))}

## 许可证风险说明

- 当前清单未发现 AGPL / GPL / SSPL / BUSL 等强 copyleft 或商业限制类红线许可证。
- \`NOASSERTION\` 表示 lockfile 中没有提供明确许可证字段，需在合规审计或发布前人工复核。
- 字体、测试工具、构建工具和运行时库均纳入 lockfile 级 SBOM；是否进入生产镜像取决于构建产物和 Dockerfile。

## 重新生成

\`\`\`bash
npm run compliance:sbom
\`\`\`

生成的 SBOM 使用 CycloneDX 1.6 JSON 格式,用于仓库合规审查和发布制品留档。修改 \`package.json\` 或 \`package-lock.json\` 后必须重新生成。
`

mkdirSync(outDir, { recursive: true })
writeFileSync(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`)
writeFileSync(thirdPartyPath, markdown)
console.log(`[frontend-compliance] wrote ${sbomPath}`)
console.log(`[frontend-compliance] wrote ${thirdPartyPath}`)
console.log(`[frontend-compliance] components=${components.length}`)
