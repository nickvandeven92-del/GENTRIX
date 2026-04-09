import { fetchWithTimeout, FetchTimeoutError } from "@/lib/http/fetch-with-timeout";
import type {
  KvkBasisprofiel,
  KvkErrorResponse,
  KvkVestigingenListResponse,
  KvkZoekenResponse,
} from "@/lib/kvk/types";

const DEFAULT_ORIGIN = "https://api.kvk.nl";
const ZOEKEN_PATH = "/api/v2/zoeken";
const BASIS_PREFIX = "/api/v1/basisprofielen";

export type KvkClientConfig = {
  apiKey: string;
  /** bv. https://api.kvk.nl — zonder trailing slash */
  origin: string;
  /** Timeout per upstream-call */
  timeoutMs: number;
};

export class KvkApiError extends Error {
  readonly name = "KvkApiError";
  constructor(
    message: string,
    readonly status: number,
    readonly kvkError?: KvkErrorResponse,
  ) {
    super(message);
  }
}

function getConfig(): KvkClientConfig {
  const apiKey = process.env.KVK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("KVK_API_KEY ontbreekt in de omgeving.");
  }
  const origin = (process.env.KVK_API_BASE_URL?.trim() || DEFAULT_ORIGIN).replace(/\/$/, "");
  const timeoutMs = Math.min(
    60_000,
    Math.max(3_000, Number.parseInt(process.env.KVK_API_TIMEOUT_MS ?? "20000", 10) || 20_000),
  );
  return { apiKey, origin, timeoutMs };
}

function formatKvkErrors(body: KvkErrorResponse | null): string {
  const fout = body?.fout;
  if (!fout?.length) return "";
  return fout.map((f) => `${f.code ?? "?"}: ${f.omschrijving ?? ""}`).join("; ");
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { _parseError: true, raw: text.slice(0, 500) };
  }
}

async function kvkFetch(pathWithQuery: string, init?: RequestInit): Promise<Response> {
  const cfg = getConfig();
  const url = `${cfg.origin}${pathWithQuery}`;
  return fetchWithTimeout(url, {
    ...init,
    timeoutMs: cfg.timeoutMs,
    headers: {
      Accept: "application/json",
      apikey: cfg.apiKey,
      ...init?.headers,
    },
  });
}

export type SearchCompaniesOptions = {
  plaats?: string;
  /** KVK filter: hoofdvestiging | nevenvestiging | rechtspersoon */
  type?: string[];
  pagina?: number;
  resultatenPerPagina?: number;
};

/**
 * Zoek bedrijven op naam (en optioneel plaats / type).
 * @see https://developers.kvk.nl/apis/zoeken
 */
export async function searchCompanies(query: string, options?: SearchCompaniesOptions): Promise<KvkZoekenResponse> {
  const cfg = getConfig();
  const params = new URLSearchParams();
  const q = query.trim();
  if (q) params.set("naam", q);
  if (options?.plaats?.trim()) params.set("plaats", options.plaats.trim());
  if (options?.pagina != null) params.set("pagina", String(options.pagina));
  if (options?.resultatenPerPagina != null) {
    params.set("resultatenPerPagina", String(Math.min(100, Math.max(1, options.resultatenPerPagina))));
  }
  for (const t of options?.type ?? []) {
    if (t?.trim()) params.append("type", t.trim());
  }

  const qs = params.toString();
  const path = `${ZOEKEN_PATH}${qs ? `?${qs}` : ""}`;

  let res: Response;
  try {
    res = await kvkFetch(path, { method: "GET" });
  } catch (e) {
    if (e instanceof FetchTimeoutError) {
      throw new KvkApiError("KVK Zoeken timeout", 504);
    }
    throw new KvkApiError(e instanceof Error ? e.message : "KVK-netwerkfout", 502);
  }

  const body = (await parseJsonSafe(res)) as KvkZoekenResponse & KvkErrorResponse;

  if (!res.ok) {
    const msg = formatKvkErrors(body) || res.statusText || "KVK-fout";
    throw new KvkApiError(msg, res.status, body);
  }

  return body;
}

function assertKvkNummer(kvkNummer: string): string {
  const d = kvkNummer.replace(/\s/g, "");
  if (!/^[0-9]{8}$/.test(d)) {
    throw new KvkApiError("Ongeldig KVK-nummer (8 cijfers vereist).", 400);
  }
  return d;
}

/**
 * Basisprofiel voor één KVK-nummer (inclusief embedded hoofdvestiging/eigenaar).
 */
export async function getBasisprofiel(kvkNummer: string): Promise<KvkBasisprofiel> {
  const kvk = assertKvkNummer(kvkNummer);
  const path = `${BASIS_PREFIX}/${encodeURIComponent(kvk)}?geoData=false`;

  let res: Response;
  try {
    res = await kvkFetch(path, { method: "GET" });
  } catch (e) {
    if (e instanceof FetchTimeoutError) {
      throw new KvkApiError("KVK Basisprofiel timeout", 504);
    }
    throw new KvkApiError(e instanceof Error ? e.message : "KVK-netwerkfout", 502);
  }

  const body = (await parseJsonSafe(res)) as KvkBasisprofiel & KvkErrorResponse;

  if (!res.ok) {
    const msg = formatKvkErrors(body) || res.statusText || "KVK-fout";
    throw new KvkApiError(msg, res.status, body);
  }

  return body;
}

/**
 * Lijst vestigingen (aanvulling op basisprofiel).
 */
export async function getVestigingenList(kvkNummer: string): Promise<KvkVestigingenListResponse | null> {
  const kvk = assertKvkNummer(kvkNummer);
  const path = `${BASIS_PREFIX}/${encodeURIComponent(kvk)}/vestigingen`;

  let res: Response;
  try {
    res = await kvkFetch(path, { method: "GET" });
  } catch {
    return null;
  }

  if (!res.ok) return null;
  const body = (await parseJsonSafe(res)) as KvkVestigingenListResponse | null;
  return body && typeof body === "object" ? body : null;
}
