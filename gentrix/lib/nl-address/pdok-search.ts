/** PDOK BAG Locatieserver (publiek, geen key). Alleen server-side aanroepen. */

export type PdokResolvedAddress = {
  street: string;
  city: string;
  postalCode: string;
  houseNumber: number;
  houseLetter: string | null;
  houseNumberAddition: string | null;
  displayLine: string;
};

type PdokDoc = {
  straatnaam?: string;
  woonplaatsnaam?: string;
  postcode?: string;
  huisnummer?: number;
  huisletter?: string | null;
  huisnummertoevoeging?: string | null;
  weergavenaam?: string;
};

function normalizePostcode(raw: string): string {
  const s = raw.replace(/\s+/g, "").toUpperCase();
  return /^[1-9][0-9]{3}[A-Z]{2}$/.test(s) ? s : "";
}

function normalizeHouseNumber(raw: string): number | null {
  const m = raw.trim().match(/^(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function docToResolved(d: PdokDoc): PdokResolvedAddress | null {
  const street = String(d.straatnaam ?? "").trim();
  const city = String(d.woonplaatsnaam ?? "").trim();
  const postalCode = String(d.postcode ?? "").trim().toUpperCase();
  const houseNumber = typeof d.huisnummer === "number" ? d.huisnummer : null;
  if (!street || !city || !postalCode || houseNumber == null) return null;
  const houseLetter = d.huisletter != null && String(d.huisletter).trim() ? String(d.huisletter).trim().toUpperCase() : null;
  const houseNumberAddition =
    d.huisnummertoevoeging != null && String(d.huisnummertoevoeging).trim()
      ? String(d.huisnummertoevoeging).trim()
      : null;
  const displayLine = String(d.weergavenaam ?? "").trim() || `${street} ${houseNumber}, ${postalCode} ${city}`;
  return {
    street,
    city,
    postalCode,
    houseNumber,
    houseLetter,
    houseNumberAddition,
    displayLine,
  };
}

function parseSuffix(raw: string): { letter: string | null; addition: string | null } {
  const rest = raw.trim();
  if (!rest) return { letter: null, addition: null };
  if (/^[a-zA-Z]$/.test(rest)) return { letter: rest.toUpperCase(), addition: null };
  return { letter: null, addition: rest };
}

async function fetchPdokDocs(postcode: string, houseNumber: number, suffix?: string): Promise<PdokDoc[]> {
  const params = new URLSearchParams();
  params.set("rows", "25");
  params.set("wt", "json");
  params.set("fq", "type:adres");
  params.set("fq", `postcode:${postcode}`);
  params.set("fq", `huisnummer:${houseNumber}`);
  const parsed = suffix ? parseSuffix(suffix) : { letter: null as string | null, addition: null as string | null };
  if (parsed.letter) params.set("fq", `huisletter:${parsed.letter}`);
  if (parsed.addition) params.set("fq", `huisnummertoevoeging:${parsed.addition}`);

  const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?${params.toString()}`;
  const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" }, next: { revalidate: 0 } });
  if (!res.ok) throw new Error("pdok_http");
  const json = (await res.json()) as { response?: { docs?: PdokDoc[] } };
  return json.response?.docs ?? [];
}

/**
 * Zoek BAG-adres op postcode + huisnummer (+ optionele toevoeging / letter).
 */
export async function pdokLookupNlAddress(input: {
  postcode: string;
  houseNumberInput: string;
  suffix?: string;
}): Promise<{ ok: true; address: PdokResolvedAddress } | { ok: false; error: string }> {
  const postcode = normalizePostcode(input.postcode);
  const houseNumber = normalizeHouseNumber(input.houseNumberInput);
  if (!postcode) return { ok: false, error: "Ongeldige postcode (gebruik 1234 AB)." };
  if (houseNumber == null) return { ok: false, error: "Vul een geldig huisnummer in." };

  const suffix = (input.suffix ?? "").trim();

  let docs: PdokDoc[];
  try {
    docs = await fetchPdokDocs(postcode, houseNumber, suffix);
  } catch {
    return { ok: false, error: "Adresservice tijdelijk niet bereikbaar." };
  }

  if (!docs.length) return { ok: false, error: "Geen adres gevonden voor deze combinatie." };

  const resolvedList = docs.map(docToResolved).filter(Boolean) as PdokResolvedAddress[];
  if (!resolvedList.length) return { ok: false, error: "Geen adres gevonden." };

  if (resolvedList.length === 1) return { ok: true, address: resolvedList[0] };

  if (!suffix) {
    return {
      ok: false,
      error: "Meerdere adressen op dit huisnummer — vul huisletter of toevoeging (bijv. A of bis) in.",
    };
  }

  const parsed = parseSuffix(suffix);
  const narrowed = resolvedList.filter((a) => {
    const letterOk = parsed.letter ? a.houseLetter === parsed.letter : true;
    const addOk = parsed.addition
      ? (a.houseNumberAddition ?? "").toLowerCase() === parsed.addition.toLowerCase()
      : true;
    return letterOk && addOk;
  });

  if (narrowed.length === 1) return { ok: true, address: narrowed[0] };
  if (narrowed.length === 0) {
    return { ok: false, error: "Geen exacte match — controleer huisletter of toevoeging." };
  }
  return { ok: false, error: "Meerdere adressen — verfijn huisletter of toevoeging." };
}
