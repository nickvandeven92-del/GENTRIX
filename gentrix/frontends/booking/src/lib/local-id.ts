/** Ids tied to wall time; kept outside components for react-hooks/purity. */
export function millisPrefixedId(prefix: string): string {
  return `${prefix}-${Date.now()}`;
}
