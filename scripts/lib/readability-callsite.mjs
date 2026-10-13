import ts from 'typescript'

const CALL_DEPTH_LIMIT = 3

function isFunctionBoundary(node) {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node)
}

function nestedArgumentCallDepth(node) {
  if (isFunctionBoundary(node)) return 0

  if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
    const childDepth = (node.arguments ?? []).reduce(
      (maximum, argument) => Math.max(maximum, nestedArgumentCallDepth(argument)),
      0,
    )
    return 1 + childDepth
  }

  let maximum = 0
  ts.forEachChild(node, (child) => {
    maximum = Math.max(maximum, nestedArgumentCallDepth(child))
  })
  return maximum
}

function lineNumber(sourceFile, position, lineOffset) {
  return sourceFile.getLineAndCharacterOfPosition(position).line + lineOffset + 1
}

function collectFromScript(scriptText, fileName, lineOffset, changedLines, findings) {
  const sourceFile = ts.createSourceFile(fileName, scriptText, ts.ScriptTarget.Latest, true)

  function addFinding(expression, kind) {
    const startLine = lineNumber(sourceFile, expression.getStart(sourceFile), lineOffset)
    const endLine = lineNumber(sourceFile, expression.getEnd(), lineOffset)
    if (!changedLines.some(([start, end]) => start <= endLine && end >= startLine)) return

    findings.push({
      file: fileName,
      kind,
      line: startLine,
      depth: nestedArgumentCallDepth(expression),
    })
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      for (const argument of node.arguments) {
        if (nestedArgumentCallDepth(argument) >= CALL_DEPTH_LIMIT) {
          addFinding(argument, '方法实参')
        }
      }
    } else if (ts.isNewExpression(node)) {
      for (const argument of node.arguments ?? []) {
        if (nestedArgumentCallDepth(argument) >= CALL_DEPTH_LIMIT) {
          addFinding(argument, '构造实参')
        }
      }
    } else if (ts.isReturnStatement(node) && node.expression) {
      if (nestedArgumentCallDepth(node.expression) >= CALL_DEPTH_LIMIT) {
        addFinding(node.expression, 'return 表达式')
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

export function parseAddedLineRanges(diffText) {
  const files = new Map()
  let currentFile

  for (const line of diffText.split('\n')) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice('+++ b/'.length)
      if (!files.has(currentFile)) files.set(currentFile, [])
      continue
    }

    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (!hunk || !currentFile) continue
    const start = Number(hunk[1])
    const count = hunk[2] === undefined ? 1 : Number(hunk[2])
    if (count > 0) files.get(currentFile).push([start, start + count - 1])
  }

  return files
}

export function findChangedCallsiteCandidates(source, fileName, changedLines) {
  const findings = []

  if (fileName.endsWith('.vue')) {
    const scriptTag = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi
    for (const match of source.matchAll(scriptTag)) {
      const contentStart = match.index + match[0].indexOf('>') + 1
      const lineOffset = source.slice(0, contentStart).split('\n').length - 1
      collectFromScript(match[1], fileName, lineOffset, changedLines, findings)
    }
  } else {
    collectFromScript(source, fileName, 0, changedLines, findings)
  }

  return findings
}

export const callDepthLimit = CALL_DEPTH_LIMIT
