import { diffArrays, diffChars } from 'diff';

export type PaneSide = 'left' | 'right';

export type LineDecorationKind = 'insert' | 'delete' | 'modify';

export interface RangeDecoration {
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  kind: LineDecorationKind;
}

export interface PaneDecorations {
  lines: RangeDecoration[];
  inline: RangeDecoration[];
}

export interface DiffDecorationSet {
  left: PaneDecorations;
  right: PaneDecorations;
}

export function buildDecorations(leftText: string, rightText: string): DiffDecorationSet {
  if (!leftText.trim() || !rightText.trim()) {
    return emptyDecorations();
  }

  const decorations = emptyDecorations();
  const lineChanges = diffArrays(splitLines(leftText), splitLines(rightText));

  let leftLineNumber = 1;
  let rightLineNumber = 1;

  for (let index = 0; index < lineChanges.length; ) {
    const change = lineChanges[index];

    if (!change.added && !change.removed) {
      leftLineNumber += change.value.length;
      rightLineNumber += change.value.length;
      index += 1;
      continue;
    }

    const deleted: string[] = [];
    const inserted: string[] = [];

    while (index < lineChanges.length) {
      const candidate = lineChanges[index];
      if (!candidate.added && !candidate.removed) {
        break;
      }

      if (candidate.removed) {
        deleted.push(...candidate.value);
      }

      if (candidate.added) {
        inserted.push(...candidate.value);
      }

      index += 1;
    }

    const pairedCount = Math.min(deleted.length, inserted.length);
    for (let pairIndex = 0; pairIndex < pairedCount; pairIndex += 1) {
      pushLineDecoration(decorations.left.lines, leftLineNumber, leftLineNumber, 'modify');
      pushLineDecoration(decorations.right.lines, rightLineNumber, rightLineNumber, 'modify');

      const inlineRanges = buildInlineDiff(deleted[pairIndex], inserted[pairIndex]);
      decorations.left.inline.push(
        ...inlineRanges.left.map((range) => ({
          ...range,
          startLine: leftLineNumber,
          endLine: leftLineNumber,
          kind: 'modify' as const
        }))
      );
      decorations.right.inline.push(
        ...inlineRanges.right.map((range) => ({
          ...range,
          startLine: rightLineNumber,
          endLine: rightLineNumber,
          kind: 'modify' as const
        }))
      );

      leftLineNumber += 1;
      rightLineNumber += 1;
    }

    if (deleted.length > pairedCount) {
      const remainingDeletes = deleted.length - pairedCount;
      pushLineDecoration(
        decorations.left.lines,
        leftLineNumber,
        leftLineNumber + remainingDeletes - 1,
        'delete'
      );
      leftLineNumber += remainingDeletes;
    }

    if (inserted.length > pairedCount) {
      const remainingInserts = inserted.length - pairedCount;
      pushLineDecoration(
        decorations.right.lines,
        rightLineNumber,
        rightLineNumber + remainingInserts - 1,
        'insert'
      );
      rightLineNumber += remainingInserts;
    }
  }

  return decorations;
}

function emptyDecorations(): DiffDecorationSet {
  return {
    left: { lines: [], inline: [] },
    right: { lines: [], inline: [] }
  };
}

function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

function pushLineDecoration(
  target: RangeDecoration[],
  startLine: number,
  endLine: number,
  kind: LineDecorationKind
): void {
  target.push({
    startLine,
    endLine,
    kind
  });
}

function buildInlineDiff(
  leftLine: string,
  rightLine: string
): {
  left: Array<Pick<RangeDecoration, 'startColumn' | 'endColumn'>>;
  right: Array<Pick<RangeDecoration, 'startColumn' | 'endColumn'>>;
} {
  const changes = diffChars(leftLine, rightLine);
  const leftRanges: Array<Pick<RangeDecoration, 'startColumn' | 'endColumn'>> = [];
  const rightRanges: Array<Pick<RangeDecoration, 'startColumn' | 'endColumn'>> = [];

  let leftColumn = 0;
  let rightColumn = 0;

  let leftPendingStart: number | undefined;
  let leftPendingEnd: number | undefined;
  let rightPendingStart: number | undefined;
  let rightPendingEnd: number | undefined;

  const flushLeft = () => {
    if (leftPendingStart !== undefined && leftPendingEnd !== undefined && leftPendingStart !== leftPendingEnd) {
      leftRanges.push({
        startColumn: leftPendingStart + 1,
        endColumn: leftPendingEnd + 1
      });
    }
    leftPendingStart = undefined;
    leftPendingEnd = undefined;
  };

  const flushRight = () => {
    if (rightPendingStart !== undefined && rightPendingEnd !== undefined && rightPendingStart !== rightPendingEnd) {
      rightRanges.push({
        startColumn: rightPendingStart + 1,
        endColumn: rightPendingEnd + 1
      });
    }
    rightPendingStart = undefined;
    rightPendingEnd = undefined;
  };

  for (const change of changes) {
    if (change.removed) {
      leftPendingStart = leftPendingStart ?? leftColumn;
      leftColumn += change.value.length;
      leftPendingEnd = leftColumn;
      continue;
    }

    if (change.added) {
      rightPendingStart = rightPendingStart ?? rightColumn;
      rightColumn += change.value.length;
      rightPendingEnd = rightColumn;
      continue;
    }

    flushLeft();
    flushRight();
    leftColumn += change.value.length;
    rightColumn += change.value.length;
  }

  flushLeft();
  flushRight();

  return {
    left: leftRanges,
    right: rightRanges
  };
}
