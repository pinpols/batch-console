import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createMarkdownRenderer } from 'vitepress'

// 页面由构建输入生成；业务语义、图形与边界始终以原文为准。
export const diagramTopics = [
  {
    slug: 'modules',
    title: '模块结构',
    path: 'architecture/project-structure.md',
    note: '运行链路和数据访问均为简化视图；具体协议、访问条件和模块职责见原文。',
  },
  {
    slug: 'model',
    title: '领域模型与状态',
    path: 'architecture/core-model.md',
    note: '状态图仅展示各对象的典型路径，并非完整迁移表；状态语义与已记录的实现差异见原文。',
  },
  {
    slug: 'flows',
    title: '整体流程',
    path: 'architecture/system-flow-overview.md',
    note: '流程、观测、扩缩容与可靠性均受配置和环境条件约束；请结合原文阅读。',
  },
  {
    slug: 'security',
    title: '安全边界',
    path: 'architecture/security-model.md',
    note: '图示为逻辑信任边界；认证、授权、租户隔离和各 Worker 的实际访问受部署配置约束。',
  },
  {
    slug: 'recovery',
    title: '故障恢复',
    path: 'runbook/troubleshooting-decision-tree.md',
    note: '恢复路径应结合原文中的结果未知、租约、外部副作用及人工确认条件，不代表故障演练已通过。',
  },
  {
    slug: 'deployment',
    title: '本地部署',
    path: 'runbook/docker-deployment.md',
    note: '这是本地 Compose 配置示意，不表示当前机器已启动全部服务，也不是生产部署拓扑。',
  },
  {
    slug: 'roadmap',
    title: '部署演进规划',
    path: 'runbook/compose-cd-roadmap.md',
    note: '本文包含当前推荐方案及目标规划，具体状态以原文各章节为准，不代表现场已部署。',
  },
]

const label = (s) =>
  s
    .replace(/[\[\]\\]/g, '\\$&')
    .replace(/\s+/g, ' ')
    .trim()

export function renderDiagramIndex(topics = diagramTopics) {
  return (
    '---\neditLink: false\n---\n\n# 架构图导览\n\n图形从后端权威 Markdown 在构建时提取；更新源文后需重新构建文档站。每张图均链接原文，请结合上下文和适用条件阅读。\n\n' +
    topics.map((topic) => `- [${topic.title}](./${topic.slug}.md)：${topic.note}`).join('\n') +
    '\n'
  )
}

export async function renderDiagramPage(topic, source) {
  const markdown = await createMarkdownRenderer(process.cwd())
  const tokens = markdown.parse(source, { relativePath: topic.path })
  const diagrams = []
  let heading = { title: topic.title, id: '' }
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type === 'heading_open') {
      heading = { title: tokens[i + 1]?.content || topic.title, id: token.attrGet('id') || '' }
    }
    if (token.type === 'fence' && token.info.trim().split(/\s+/)[0] === 'mermaid') {
      const preceding = tokens[i - 2]
      const caption =
        tokens[i - 1]?.type === 'paragraph_close' && preceding?.type === 'inline'
          ? /^\*\*(.+?)\*\*$/.exec(preceding.content.trim())?.[1]
          : null
      diagrams.push({ ...heading, title: caption || heading.title, source: token.content })
    }
  }
  if (!diagrams.length) throw new Error(`${topic.path} 没有 Mermaid 图`)
  const sourceUrl = `../backend/${topic.path}`
  const tabs = diagramTopics.map((entry) => `[${entry.title}](./${entry.slug}.md)`).join(' · ')
  const sections = diagrams.map((diagram, i) => {
    const anchor = diagram.id ? `#${encodeURIComponent(diagram.id)}` : ''
    return `## 图 ${i + 1} · ${label(diagram.title)}\n\n[查看原文与上下文](${sourceUrl}${anchor})\n\n\`\`\`mermaid\n${diagram.source}\`\`\`\n`
  })
  // 使用站点同一 Markdown 渲染器生成锚点，避免目录链接与实际标题漂移。
  const sectionHeadings = markdown
    .parse(sections.join('\n'), { relativePath: `${topic.slug || 'diagrams'}.md` })
    .filter((token) => token.type === 'heading_open' && token.tag === 'h2')
  const contents = diagrams
    .map(
      (diagram, i) =>
        `- [图 ${i + 1} · ${label(diagram.title)}](#${encodeURIComponent(sectionHeadings[i].attrGet('id'))})`,
    )
    .join('\n')
  return `---\neditLink: false\n---\n\n# ${topic.title}\n\n[架构图导览](./README.md) · ${tabs}\n\n> ${topic.note || '请结合原文阅读。'}\n\n**本页图目录**\n\n${contents}\n\n${sections.join('\n')}`
}

export async function writeDiagramPages(backendDir, outputDir, topics = diagramTopics) {
  const pages = []
  for (const topic of topics) {
    const source = await readFile(join(backendDir, topic.path), 'utf8')
    pages.push([`${topic.slug}.md`, await renderDiagramPage(topic, source)])
  }
  await mkdir(outputDir, { recursive: true })
  await writeFile(join(outputDir, 'README.md'), renderDiagramIndex(topics))
  for (const [name, page] of pages) await writeFile(join(outputDir, name), page)
}
