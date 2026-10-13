import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const [bumpType, requestedVersion] = process.argv.slice(2)
const allowedBumps = new Set(['patch', 'minor', 'major'])
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

function fail(message) {
  console.error(`[platform-release] ${message}`)
  process.exit(1)
}

if (!allowedBumps.has(bumpType)) {
  fail('bump type must be patch, minor, or major')
}

const root = process.cwd()
const packagePath = resolve(root, 'package.json')
const lockPath = resolve(root, 'package-lock.json')
const manifestPath = resolve(root, '.platform-release-manifest.json')
const changelogPath = resolve(root, 'CHANGELOG.md')
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
const lockJson = JSON.parse(await readFile(lockPath, 'utf8'))
const manifestJson = JSON.parse(await readFile(manifestPath, 'utf8'))

const sourceVersions = [
  packageJson.version,
  lockJson.version,
  lockJson.packages?.['']?.version,
  manifestJson['.'],
]
if (sourceVersions.some((version) => version !== sourceVersions[0])) {
  fail(`frontend version sources disagree: ${sourceVersions.join(', ')}`)
}

const sourceVersion = sourceVersions[0]
const match = versionPattern.exec(sourceVersion)
if (!match) {
  fail(`current version must be stable SemVer X.Y.Z: ${sourceVersion}`)
}

const [majorValue, minorValue, patchValue] = match.slice(1).map(Number)
const nextVersion = {
  major: `${majorValue + 1}.0.0`,
  minor: `${majorValue}.${minorValue + 1}.0`,
  patch: `${majorValue}.${minorValue}.${patchValue + 1}`,
}[bumpType]
if (requestedVersion !== nextVersion) {
  fail(`requested version ${requestedVersion} does not match ${bumpType} increment ${nextVersion}`)
}

const changelog = await readFile(changelogPath, 'utf8')
const unreleasedHeader = '## [Unreleased]'
const unreleasedStart = changelog.indexOf(unreleasedHeader)
if (unreleasedStart < 0) {
  fail('CHANGELOG.md has no [Unreleased] section')
}
const followingHeading = changelog.indexOf('\n## [', unreleasedStart + unreleasedHeader.length)
if (followingHeading < 0) {
  fail('CHANGELOG.md has no versioned section after [Unreleased]')
}
if (changelog.includes(`## [${requestedVersion}] -`)) {
  fail(`CHANGELOG.md already contains ${requestedVersion}`)
}

const unreleasedBodyStart = unreleasedStart + unreleasedHeader.length
const unreleasedBody = changelog.slice(unreleasedBodyStart, followingHeading).trim()
const releaseNotes = unreleasedBody || '- 前后端联合发布版本对齐。'
const releaseDate = process.env.RELEASE_DATE
if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate ?? '')) {
  fail('RELEASE_DATE must be provided in YYYY-MM-DD format')
}

const updatedChangelog = [
  changelog.slice(0, unreleasedStart).trimEnd(),
  unreleasedHeader,
  '',
  `## [${requestedVersion}] - ${releaseDate}`,
  '',
  releaseNotes,
  '',
  changelog.slice(followingHeading + 1).trimStart(),
].join('\n')

packageJson.version = requestedVersion
lockJson.version = requestedVersion
lockJson.packages[''].version = requestedVersion
manifestJson['.'] = requestedVersion

await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)
await writeFile(lockPath, `${JSON.stringify(lockJson, null, 2)}\n`)
await writeFile(manifestPath, `${JSON.stringify(manifestJson, null, 2)}\n`)
await writeFile(changelogPath, updatedChangelog)
console.log(`[platform-release] prepared ${sourceVersion} -> ${requestedVersion}`)
