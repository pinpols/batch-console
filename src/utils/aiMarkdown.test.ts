import { describe, expect, it } from 'vitest'
import { renderAiMarkdown } from './aiMarkdown'

describe('renderAiMarkdown', () => {
  it('renders ordinary Markdown and a copyable escaped code block', () => {
    const html = renderAiMarkdown('**诊断**\n\n```sh\necho "<job>"\n```', '复制代码')
    expect(html).toContain('<strong>诊断</strong>')
    expect(html).toContain('data-ai-copy-code')
    expect(html).toContain('aria-label="复制代码"')
    expect(html).toContain('echo &quot;&lt;job&gt;&quot;')
    expect(html).not.toContain('<job>')
  })

  it('does not render raw HTML, remote images, or script links', () => {
    const html = renderAiMarkdown(
      '<script>alert(1)</script>\n\n![remote](https://example.com/tracker.png)\n\n[open](javascript:alert(1))',
      'Copy code',
    )
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('href="javascript:')
  })

  it('secures allowed links opened in a new tab', () => {
    const html = renderAiMarkdown('[details](/monitor/job-instances)', 'Copy code')
    expect(html).toContain('href="/monitor/job-instances"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer nofollow"')
  })
})
