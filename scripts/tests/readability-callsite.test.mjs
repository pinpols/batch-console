import assert from 'node:assert/strict'
import test from 'node:test'
import { findChangedCallsiteCandidates, parseAddedLineRanges } from '../lib/readability-callsite.mjs'

test('深层方法实参会命中，短嵌套调用不会命中', () => {
  const source = `submit(read(normalize(parse(input))))\nsubmit(read(parse(input)))`
  const findings = findChangedCallsiteCandidates(source, 'src/example.ts', [[1, 1], [2, 2]])

  assert.equal(findings.length, 1)
  assert.equal(findings[0].kind, '方法实参')
  assert.equal(findings[0].line, 1)
  assert.deepEqual(findChangedCallsiteCandidates(source, 'src/example.ts', [[2, 2]]), [])
})

test('短 fluent 链和回调函数体不因调用数量命中', () => {
  const source = `submit(rows.map((row) => normalize(parse(row.value))).filter(Boolean).join(','))`
  const findings = findChangedCallsiteCandidates(source, 'src/example.ts', [[1, 1]])

  assert.deepEqual(findings, [])
})

test('return 与 Vue script 中的深层调用按物理行定位', () => {
  const source = `const value = 1\nreturn toResult(parse(normalize(value)))`
  const tsFindings = findChangedCallsiteCandidates(source, 'src/example.ts', [[2, 2]])
  const vue = `<template><div /></template>\n<script setup lang="ts">\nsubmit(read(normalize(parse(input))))\n</script>`
  const vueFindings = findChangedCallsiteCandidates(vue, 'src/Example.vue', [[3, 3]])

  assert.equal(tsFindings[0]?.line, 2)
  assert.equal(tsFindings[0]?.kind, 'return 表达式')
  assert.equal(vueFindings[0]?.line, 3)
})

test('diff 解析只记录新增行区间', () => {
  const diff = [
    '+++ b/src/example.ts',
    '@@ -10,2 +10,4 @@',
    '+++ b/src/other.ts',
    '@@ -1 +1,0 @@',
  ].join('\n')

  assert.deepEqual([...parseAddedLineRanges(diff)], [['src/example.ts', [[10, 13]]], ['src/other.ts', []]])
})
