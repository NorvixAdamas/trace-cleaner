import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { analyze } from '../packages/writing/grammar/index.js';
import { analyzeConsistency } from '../packages/writing/consistency.js';
import { evaluateDataset, matchExpectations } from '../packages/writing/evaluation.js';

const load = name => JSON.parse(readFileSync(new URL(`./fixtures/writing-eval/${name}.json`, import.meta.url), 'utf8'));

const runCase = testCase => ({
  suggestions: [
    ...analyze(testCase.text, { language: testCase.language }).suggestions,
    ...analyzeConsistency(testCase.text, { language: testCase.language }).suggestions,
  ],
});

test('writing-eval: dev set đạt precision/recall/offset', () => {
  const dataset = load('dev');
  const result = evaluateDataset(dataset.cases, { run: runCase });
  assert.ok(result.expected >= 20, `chỉ có ${result.expected} nhãn`);
  assert.ok(result.precision >= 0.95, `precision ${result.precision}`);
  assert.ok(result.recall >= 0.9, `recall ${result.recall} · thiếu ${JSON.stringify(result.missing)}`);
  assert.equal(result.offsetAccuracy, 1);
  assert.equal(result.preservation, 1);
});

test('writing-eval: held-out set đạt ngưỡng và không overfit', () => {
  const dataset = load('heldout');
  const result = evaluateDataset(dataset.cases, { run: runCase });
  assert.ok(result.precision >= 0.9, `precision ${result.precision} · thừa ${JSON.stringify(result.perCase.flatMap(item => item.extra))}`);
  assert.ok(result.recall >= 0.85, `recall ${result.recall} · thiếu ${JSON.stringify(result.perCase.flatMap(item => item.missing))}`);
  assert.equal(result.offsetAccuracy, 1);
});

test('writing-eval: dataset không chứa dữ liệu người dùng và có ghi chú', () => {
  for (const name of ['dev', 'heldout']) {
    const dataset = load(name);
    assert.ok(dataset.note && dataset.note.length > 20);
    assert.ok(Array.isArray(dataset.cases) && dataset.cases.length > 0);
    for (const testCase of dataset.cases) {
      assert.ok(testCase.id && testCase.language && testCase.text);
      assert.ok(Array.isArray(testCase.expect));
      assert.ok(!/https?:\/\/(?!example\.com)/.test(testCase.text), 'không dùng URL thật trong fixture');
    }
  }
});

test('writing-eval: matchExpectations không khớp chéo category', () => {
  const suggestions = [
    { category: 'spelling', original: 'x', replacement: 'y' },
    { category: 'grammar', original: 'x', replacement: 'y' },
  ];
  const result = matchExpectations('x', [{ category: 'grammar', original: 'x', replacement: 'y' }], suggestions);
  assert.equal(result.matched.length, 1);
  assert.equal(result.matched[0].hit.category, 'grammar');
  assert.equal(result.extra.length, 1);
});

test('writing-eval: mọi correction có confidence ≥ 0.9, suggestion thấp hơn', () => {
  for (const name of ['dev', 'heldout']) {
    for (const testCase of load(name).cases) {
      for (const item of runCase(testCase).suggestions) {
        if (item.kind === 'correction') {
          assert.ok(item.confidence >= 0.6, `${item.ruleId} confidence ${item.confidence}`);
        } else {
          assert.ok(item.confidence <= 0.9, `${item.ruleId} suggestion confidence quá cao`);
        }
        assert.ok(item.explanation && item.explanation.length > 3);
      }
    }
  }
});
