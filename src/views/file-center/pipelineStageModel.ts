import type { ConsoleFilePipelineStepResponse } from '@/types/console-api'

type PipelineStagesMap = Readonly<Record<string, readonly string[]>>

export function pipelineStageCodes(
  pipelineType: string | null | undefined,
  steps: ReadonlyArray<Pick<ConsoleFilePipelineStepResponse, 'stageCode'>>,
  stagesByType: PipelineStagesMap,
): string[] {
  const pipelineTypeText = String(pipelineType ?? '')
  const normalizedPipelineType = pipelineTypeText.toUpperCase()
  const canonical = stagesByType[normalizedPipelineType] ?? []
  const actual = steps
    .map((step) => {
      const stageCode = String(step.stageCode ?? '')
      const trimmedStageCode = stageCode.trim()
      return trimmedStageCode.toUpperCase()
    })
    .filter(Boolean)
  return [...new Set([...canonical, ...actual])]
}
