import { describe, expect, it } from 'vitest'
import type { ConsoleFilePipelineStepResponse } from '@/types/console-api'
import { pipelineStageCodes } from './pipelineStageModel'

function step(stageCode: string): ConsoleFilePipelineStepResponse {
  return { stageCode } as ConsoleFilePipelineStepResponse
}

describe('pipelineStageCodes', () => {
  it('uses the stage order returned by backend metadata', () => {
    expect(
      pipelineStageCodes('IMPORT', [], {
        IMPORT: ['RECEIVE', 'SANITIZE', 'PARSE'],
      }),
    ).toEqual(['RECEIVE', 'SANITIZE', 'PARSE'])
  })

  it('keeps observed stages after metadata stages without duplicates', () => {
    expect(
      pipelineStageCodes('IMPORT', [step('parse'), step('CUSTOM_CHECK')], {
        IMPORT: ['RECEIVE', 'PARSE'],
      }),
    ).toEqual(['RECEIVE', 'PARSE', 'CUSTOM_CHECK'])
  })

  it('falls back to observed stages when metadata is unavailable', () => {
    expect(pipelineStageCodes('CUSTOM', [step('prepare'), step('publish')], {})).toEqual([
      'PREPARE',
      'PUBLISH',
    ])
  })
})
