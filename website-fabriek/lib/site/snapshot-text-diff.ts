/**
 * Eenvoudige regel-diff op canonieke JSON-strings (geen externe diff-lib).
 */
export type SnapshotLineChange = {
  leftLine: number;
  rightLine: number;
  leftText: string;
  rightText: string;
};

export function diffCanonicalJsonLines(
  left: string,
  right: string,
  options?: { maxHunks?: number },
): {
  identical: boolean;
  leftLineCount: number;
  rightLineCount: number;
  changes: SnapshotLineChange[];
} {
  const maxHunks = options?.maxHunks ?? 80;
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  const n = Math.max(leftLines.length, rightLines.length);
  const changes: SnapshotLineChange[] = [];
  for (let i = 0; i < n && changes.length < maxHunks; i++) {
    const l = leftLines[i] ?? "";
    const r = rightLines[i] ?? "";
    if (l !== r) {
      changes.push({
        leftLine: i + 1,
        rightLine: i + 1,
        leftText: l.slice(0, 400),
        rightText: r.slice(0, 400),
      });
    }
  }
  return {
    identical: changes.length === 0 && leftLines.length === rightLines.length,
    leftLineCount: leftLines.length,
    rightLineCount: rightLines.length,
    changes,
  };
}
