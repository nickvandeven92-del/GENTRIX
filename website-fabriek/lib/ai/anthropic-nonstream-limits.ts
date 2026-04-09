/**
 * Anthropic TypeScript SDK: non-streaming `messages.create` berekent een verwachte maximale
 * duur; als die boven ~10 minuten uitkomt, gooit de client vóór de request met een fout
 * (“Streaming is required…”). Zie upstream:
 * https://github.com/anthropics/anthropic-sdk-typescript#long-requests
 *
 * Formule in de SDK: expectedTime = (60 * 60 * 1000 * max_tokens) / 128_000;
 * moet ≤ 10 * 60 * 1000 → max_tokens ≤ 128_000 / 6 ≈ 21_333.
 *
 * Voor langere outputs: streaming gebruiken (andere codepath), niet alleen timeout verhogen.
 */
export const ANTHROPIC_NONSTREAMING_MAX_TOKENS_SAFE = 21_333;

/**
 * Moet gelijk lopen met `MODEL_NONSTREAMING_TOKENS` in @anthropic-ai/sdk (non-streaming only).
 * Als jouw ANTHROPIC_MODEL hierin staat maar max_tokens hoger is → SDK gooit vóór de request.
 */
export const ANTHROPIC_NONSTREAMING_MODEL_CAP: Record<string, number> = {
  "claude-opus-4-20250514": 8192,
  "claude-opus-4-0": 8192,
  "claude-4-opus-20250514": 8192,
  "anthropic.claude-opus-4-20250514-v1:0": 8192,
  "claude-opus-4@20250514": 8192,
  "claude-opus-4-1-20250805": 8192,
  "anthropic.claude-opus-4-1-20250805-v1:0": 8192,
  "claude-opus-4-1@20250805": 8192,
};

export function clampMaxTokensNonStreaming(model: string, requested: number): number {
  const modelCap = ANTHROPIC_NONSTREAMING_MODEL_CAP[model];
  const cap = modelCap != null ? Math.min(modelCap, ANTHROPIC_NONSTREAMING_MAX_TOKENS_SAFE) : ANTHROPIC_NONSTREAMING_MAX_TOKENS_SAFE;
  return Math.min(Math.max(1024, Math.floor(requested)), cap);
}
