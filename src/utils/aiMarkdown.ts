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

function isRenderEnvWithCopyLabel(env: unknown): env is { copyLabel: string } {
  return (
    typeof env === 'object' &&
    env !== null &&
    'copyLabel' in env &&
    typeof env.copyLabel === 'string'
  )
}

function copyLabelFromRenderEnv(env: unknown): string {
  if (!isRenderEnvWithCopyLabel(env)) {
    throw new TypeError('Markdown render environment must include a string copyLabel')
  }
  return env.copyLabel
}

markdown.renderer.rules.fence = (tokens, index, _options, env) => {
  const token = tokens[index]
  const trimmedInfo = token.info.trim()
  const infoSegments = trimmedInfo.split(/\s+/, 1)
  const language = infoSegments[0] ?? ''
  const code = token.content
  const copyLabel = copyLabelFromRenderEnv(env)
  return codeBlock(code, language, copyLabel)
}

markdown.renderer.rules.code_block = (tokens, index, _options, env) => {
  const code = tokens[index].content
  const copyLabel = copyLabelFromRenderEnv(env)
  return codeBlock(code, '', copyLabel)
}

export function renderAiMarkdown(content: string, copyLabel: string): string {
  return markdown.render(content, { copyLabel })
}
