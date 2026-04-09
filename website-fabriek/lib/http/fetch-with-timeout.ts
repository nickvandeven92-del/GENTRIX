/**
 * fetch met AbortSignal-timeout; gebruikt voor KVK en externe website-probes.
 */
export class FetchTimeoutError extends Error {
  readonly name = "FetchTimeoutError";
  constructor(message = "Request timeout") {
    super(message);
  }
}

export type FetchWithTimeoutOptions = RequestInit & {
  timeoutMs?: number;
};

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const { timeoutMs = 15_000, signal: outerSignal, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new FetchTimeoutError()), timeoutMs);

  if (outerSignal) {
    if (outerSignal.aborted) {
      clearTimeout(timer);
      throw outerSignal.reason ?? new DOMException("Aborted", "AbortError");
    }
    outerSignal.addEventListener(
      "abort",
      () => {
        controller.abort(outerSignal.reason);
      },
      { once: true },
    );
  }

  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new FetchTimeoutError();
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
