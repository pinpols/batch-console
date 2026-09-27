import type { ConsoleFilePipelineStepResponse } from '@/types/console-api'

type PipelineStagesMap = Readonly<Record<string, readonly string[]>>

export function pipelineStageCodes(
  pipelineType: string | null | undefined,
  steps: ConsoleFilePipelineStepResponse[],
  stagesByType: PipelineStagesMap,
): string[] {
  const canonical = stagesByType[String(pipelineType ?? '').toUpperCase()] ?? []
  const actual = steps
    .map((step) =>
      String(step.stageCode ?? '')
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean)
  return [...new Set([...canonical, ...actual])]
}
