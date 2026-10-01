const MAX_FILE_BYTES = 8 * 1024
export const MAX_AI_PROMPT_CHARS = 4000

export type AiTextAttachment = { name: string; text: string }

export class AiTextAttachmentError extends Error {
  constructor(readonly reason: 'type' | 'size' | 'encoding' | 'empty') {
    super(reason)
  }
}

export async function readAiTextAttachment(file: File): Promise<AiTextAttachment> {
  if (!/\.(txt|md|log)$/i.test(file.name)) throw new AiTextAttachmentError('type')
  if (file.size > MAX_FILE_BYTES) throw new AiTextAttachmentError('size')
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).trim()
  } catch {
    throw new AiTextAttachmentError('encoding')
  }
  if (!text) throw new AiTextAttachmentError('empty')
  return { name: file.name, text }
}

export function aiPromptWithAttachment(
  question: string,
  attachment: AiTextAttachment | null,
): string {
  if (!attachment) return question.trim()
  const combined = `${question.trim()}\n\n[Reference file: ${attachment.name}]\n${attachment.text}\n[/Reference file]`
  if (combined.length > MAX_AI_PROMPT_CHARS) throw new AiTextAttachmentError('size')
  return combined
}
