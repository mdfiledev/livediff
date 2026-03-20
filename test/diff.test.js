const test = require('node:test');
const assert = require('node:assert/strict');

const { buildDecorations } = require('../out/diff.js');

test('returns no decorations when either side is empty or whitespace only', () => {
  assert.deepStrictEqual(buildDecorations('', 'value'), {
    left: { lines: [], inline: [] },
    right: { lines: [], inline: [] }
  });

  assert.deepStrictEqual(buildDecorations('   \n', 'value'), {
    left: { lines: [], inline: [] },
    right: { lines: [], inline: [] }
  });
});

test('marks inserted lines on the right side', () => {
  const decorations = buildDecorations('alpha', 'alpha\nbeta');

  assert.deepStrictEqual(decorations.left.lines, []);
  assert.deepStrictEqual(decorations.right.lines, [
    { startLine: 2, endLine: 2, kind: 'insert' }
  ]);
});

test('marks deleted lines on the left side', () => {
  const decorations = buildDecorations('alpha\nbeta', 'alpha');

  assert.deepStrictEqual(decorations.left.lines, [
    { startLine: 2, endLine: 2, kind: 'delete' }
  ]);
  assert.deepStrictEqual(decorations.right.lines, []);
});

test('marks modified lines on both sides and includes intraline highlights by default', () => {
  const decorations = buildDecorations('hello world', 'hello there');

  assert.deepStrictEqual(decorations.left.lines, [
    { startLine: 1, endLine: 1, kind: 'modify' }
  ]);
  assert.deepStrictEqual(decorations.right.lines, [
    { startLine: 1, endLine: 1, kind: 'modify' }
  ]);

  assert.deepStrictEqual(decorations.left.inline, [
    {
      startLine: 1,
      endLine: 1,
      startColumn: 7,
      endColumn: 9,
      kind: 'modify'
    },
    {
      startLine: 1,
      endLine: 1,
      startColumn: 10,
      endColumn: 12,
      kind: 'modify'
    }
  ]);
  assert.deepStrictEqual(decorations.right.inline, [
    {
      startLine: 1,
      endLine: 1,
      startColumn: 7,
      endColumn: 10,
      kind: 'modify'
    },
    {
      startLine: 1,
      endLine: 1,
      startColumn: 11,
      endColumn: 12,
      kind: 'modify'
    }
  ]);
});

test('uses character-level intraline highlights for appended text', () => {
  const decorations = buildDecorations('aaa bbb', 'aaa bbbeee');

  assert.deepStrictEqual(decorations.left.inline, []);
  assert.deepStrictEqual(decorations.right.inline, [
    {
      startLine: 1,
      endLine: 1,
      startColumn: 8,
      endColumn: 11,
      kind: 'modify'
    }
  ]);
});

test('collapses consecutive unmatched lines into a single line-range decoration', () => {
  const decorations = buildDecorations('keep\nremove-a\nremove-b\nstay', 'keep\nstay');

  assert.deepStrictEqual(decorations.left.lines, [
    { startLine: 2, endLine: 3, kind: 'delete' }
  ]);
  assert.deepStrictEqual(decorations.right.lines, []);
});

test('handles larger inputs without throwing and still reports differences', () => {
  const left = Array.from({ length: 220 }, (_, index) => `left-${index}`).join('\n');
  const right = Array.from({ length: 220 }, (_, index) =>
    index === 150 ? `right-${index}` : `left-${index}`
  ).join('\n');

  const decorations = buildDecorations(left, right);

  assert.ok(decorations.left.lines.length > 0);
  assert.ok(decorations.right.lines.length > 0);
});
