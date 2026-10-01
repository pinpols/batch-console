import { describe, expect, it } from 'vitest'
import {
  AiTextAttachmentError,
  aiPromptWithAttachment,
  readAiTextAttachment,
} from './aiTextAttachment'

describe('readAiTextAttachment', () => {
  it('reads a small UTF-8 text file', async () => {
    const file = new File(['job failed'], 'incident.log')
    expect(await readAiTextAttachment(file)).toEqual({ name: 'incident.log', text: 'job failed' })
  })

  it('rejects unsupported, oversized, and invalid UTF-8 files', async () => {
    await expect(readAiTextAttachment(new File(['a'], 'image.png'))).rejects.toMatchObject({
      reason: 'type',
    })
    await expect(
      readAiTextAttachment(new File(['x'.repeat(8193)], 'large.txt')),
    ).rejects.toMatchObject({ reason: 'size' })
    await expect(
      readAiTextAttachment(new File([new Uint8Array([0xff])], 'bad.md')),
    ).rejects.toMatchObject({ reason: 'encoding' })
  })
})

describe('aiPromptWithAttachment', () => {
  it('keeps the question first and bounds the combined prompt', () => {
    expect(aiPromptWithAttachment('Why?', { name: 'trace.log', text: 'ERROR' })).toContain(
      'Why?\n\n[Reference file: trace.log]\nERROR',
    )
    expect(() =>
      aiPromptWithAttachment('Why?', { name: 'long.log', text: 'x'.repeat(4000) }),
    ).toThrow(AiTextAttachmentError)
  })
})
