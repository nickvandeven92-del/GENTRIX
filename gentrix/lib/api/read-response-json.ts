/**
 * Leest JSON uit een fetch-response zonder te crashen op lege body of HTML-foutpagina’s (bij 500).
 */
export async function readResponseJson<T>(res: Response): Promise<{ ok: boolean; status: number; data: T | null }> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: res.ok, status: res.status, data: null };
  }
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(trimmed) as T };
  } catch {
    return { ok: res.ok, status: res.status, data: null };
  }
}
