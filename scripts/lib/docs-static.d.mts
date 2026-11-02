import type { IncomingMessage, ServerResponse } from 'node:http'

export function docsStaticMiddleware(
  directory: string,
): (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
) => Promise<void | ServerResponse | NodeJS.ReadableStream>
