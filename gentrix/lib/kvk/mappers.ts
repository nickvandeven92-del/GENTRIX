import type {
  KvkAdres,
  KvkBasisprofiel,
  KvkZoekenResultaatItem,
  KvkVestigingenListResponse,
} from "@/lib/kvk/types";
import type {
  KvkSearchResultItem,
  KvkMappedProfile,
  KvkProfileAddress,
  KvkProfileSbi,
  KvkProfileVestigingSummary,
} from "@/lib/leads/kvk-enrichment-types";

function pickPlaatsFromZoekItem(item: KvkZoekenResultaatItem): string | null {
  const b = item.adres?.binnenlandsAdres;
  const plaats = b?.plaats?.trim();
  return plaats || null;
}

function pickStraatFromZoekItem(item: KvkZoekenResultaatItem): string | null {
  const b = item.adres?.binnenlandsAdres;
  if (!b?.straatnaam) return null;
  const parts = [b.straatnaam, b.huisnummer != null ? String(b.huisnummer) : "", b.huisletter ?? ""].filter(Boolean);
  const s = parts.join(" ").trim();
  return s || null;
}

/** Compacte zoekresultaten voor de UI / API. */
export function mapZoekenItem(item: KvkZoekenResultaatItem, index: number): KvkSearchResultItem {
  const kvkNummer = item.kvkNummer?.trim() ?? "";
  const naam = item.naam?.trim() ?? "";
  const handelsnaam = naam || item.vervallenNaam?.trim() || null;
  return {
    kvkNummer,
    naam,
    handelsnaam,
    plaats: pickPlaatsFromZoekItem(item),
    straat: pickStraatFromZoekItem(item),
    type: item.type?.trim() ?? null,
    links: Array.isArray(item.links)
      ? item.links
          .map((l) => ({
            rel: l.rel ?? null,
            href: l.href ?? null,
          }))
          .filter((l) => l.href)
      : [],
    rawScore: typeof index === "number" ? Math.max(0, 1000 - index) : undefined,
  };
}

function mapAdres(a: KvkAdres): KvkProfileAddress {
  return {
    type: a.type ?? null,
    plaats: a.plaats?.trim() ?? null,
    straatnaam: a.straatnaam?.trim() ?? null,
    huisnummer: a.huisnummer ?? null,
    postcode: a.postcode?.trim() ?? null,
    volledigAdres: a.volledigAdres?.trim() ?? null,
    land: a.land?.trim() ?? null,
  };
}

function collectWebsitesFromProfile(bp: KvkBasisprofiel): string[] {
  const out = new Set<string>();
  const hv = bp._embedded?.hoofdvestiging;
  const eg = bp._embedded?.eigenaar;
  for (const w of hv?.websites ?? []) {
    const t = w?.trim();
    if (t) out.add(t);
  }
  for (const w of eg?.websites ?? []) {
    const t = w?.trim();
    if (t) out.add(t);
  }
  return [...out];
}

function mapSbi(list: KvkBasisprofiel["sbiActiviteiten"]): KvkProfileSbi[] {
  if (!list?.length) return [];
  return list.map((s) => ({
    code: s.sbiCode?.trim() ?? "",
    omschrijving: s.sbiOmschrijving?.trim() ?? null,
    hoofdactiviteit: s.indHoofdactiviteit?.trim() ?? null,
  }));
}

function mapHoofdvestiging(bp: KvkBasisprofiel): KvkMappedProfile["hoofdvestiging"] {
  const hv = bp._embedded?.hoofdvestiging;
  if (!hv) return null;
  return {
    vestigingsnummer: hv.vestigingsnummer?.trim() ?? null,
    eersteHandelsnaam: hv.eersteHandelsnaam?.trim() ?? null,
    statutaireNaam: hv.statutaireNaam?.trim() ?? null,
    indHoofdvestiging: hv.indHoofdvestiging?.trim() ?? null,
    adressen: (hv.adressen ?? []).map(mapAdres),
    websites: [...(hv.websites ?? [])].map((w) => w.trim()).filter(Boolean),
    sbiActiviteiten: mapSbi(hv.sbiActiviteiten),
  };
}

function mapVestigingenList(resp: KvkVestigingenListResponse | null): KvkProfileVestigingSummary[] {
  if (!resp?.vestigingen?.length) return [];
  return resp.vestigingen.map((v) => ({
    vestigingsnummer: v.vestigingsnummer?.trim() ?? "",
    eersteHandelsnaam: v.eersteHandelsnaam?.trim() ?? null,
    indHoofdvestiging: v.indHoofdvestiging?.trim() ?? null,
    volledigAdres: v.volledigAdres?.trim() ?? null,
  }));
}

/** Één samenhangend profiel voor enrichment (Basisprofiel + vestigingenlijst). */
export function mapBasisprofielToProfile(
  bp: KvkBasisprofiel,
  vestigingenResponse: KvkVestigingenListResponse | null,
): KvkMappedProfile {
  const kvkNummer = bp.kvkNummer?.trim() ?? "";
  const naam = bp.naam?.trim() ?? bp.statutaireNaam?.trim() ?? "";
  const rechtsvorm =
    bp._embedded?.eigenaar?.rechtsvorm?.trim() ??
    bp._embedded?.eigenaar?.uitgebreideRechtsvorm?.trim() ??
    null;

  const adresHoofd = bp._embedded?.hoofdvestiging?.adressen?.[0];
  const plaats =
    adresHoofd?.plaats?.trim() ??
    bp._embedded?.eigenaar?.adressen?.[0]?.plaats?.trim() ??
    null;

  return {
    kvkNummer,
    naam,
    statutaireNaam: bp.statutaireNaam?.trim() ?? null,
    rechtsvorm,
    plaats,
    hoofdvestiging: mapHoofdvestiging(bp),
    adressen: [
      ...(bp._embedded?.hoofdvestiging?.adressen ?? []).map(mapAdres),
      ...(bp._embedded?.eigenaar?.adressen ?? []).map(mapAdres),
    ],
    websites: collectWebsitesFromProfile(bp),
    sbiActiviteiten: mapSbi(bp.sbiActiviteiten),
    vestigingen: mapVestigingenList(vestigingenResponse),
  };
}
