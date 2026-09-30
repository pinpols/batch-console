import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({ html: false, linkify: false, breaks: true })
markdown.disable('image')

markdown.renderer.rules.link_open = (tokens, index, options, _env, renderer) => {
  const token = tokens[index]
  token.attrSet('target', '_blank')
  token.attrSet('rel', 'noopener noreferrer nofollow')
  return renderer.renderToken(tokens, index, options)
}

function codeBlock(code: string, language: string, copyLabel: string): string {
  const escapedCode = markdown.utils.escapeHtml(code)
  const escapedLanguage = markdown.utils.escapeHtml(language)
  const escapedLabel = markdown.utils.escapeHtml(copyLabel)
  return `<div class="ai-markdown__code"><div class="ai-markdown__code-head"><span>${escapedLanguage}</span><button type="button" data-ai-copy-code aria-label="${escapedLabel}" title="${escapedLabel}">${escapedLabel}</button></div><pre><code>${escapedCode}</code></pre></div>`
}

markdown.renderer.rules.fence = (tokens, index, _options, env) => {
  const token = tokens[index]
  const language = token.info.trim().split(/\s+/, 1)[0] ?? ''
  return codeBlock(token.content, language, env.copyLabel)
}

markdown.renderer.rules.code_block = (tokens, index, _options, env) =>
  codeBlock(tokens[index].content, '', env.copyLabel)

export function renderAiMarkdown(content: string, copyLabel: string): string {
  return markdown.render(content, { copyLabel })
}
