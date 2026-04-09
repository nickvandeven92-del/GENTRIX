/**
 * Minimale typings voor KVK JSON-responses (Zoeken v2 / Basisprofiel v1).
 * Velden zijn optioneel waar de API ze kan weglaten.
 */

export type KvkLink = {
  rel?: string;
  href?: string;
};

export type KvkBinnenlandsAdres = {
  type?: string;
  straatnaam?: string;
  huisnummer?: number;
  huisletter?: string;
  postbusnummer?: number;
  postcode?: string;
  plaats?: string;
};

export type KvkAdresWrapper = {
  binnenlandsAdres?: KvkBinnenlandsAdres;
  buitenlandsAdres?: Record<string, unknown>;
};

export type KvkZoekenResultaatItem = {
  kvkNummer?: string;
  rsin?: string;
  vestigingsnummer?: string;
  naam?: string;
  adres?: KvkAdresWrapper;
  type?: string;
  actief?: string;
  vervallenNaam?: string;
  links?: KvkLink[];
};

export type KvkZoekenResponse = {
  pagina?: number;
  resultatenPerPagina?: number;
  totaal?: number;
  vorige?: string;
  volgende?: string;
  resultaten?: KvkZoekenResultaatItem[];
  links?: KvkLink[];
};

export type KvkFoutItem = {
  code?: string;
  omschrijving?: string;
};

export type KvkErrorResponse = {
  fout?: KvkFoutItem[];
};

export type KvkHandelsnaam = {
  naam?: string;
  volgorde?: number;
};

export type KvkSbiActiviteit = {
  sbiCode?: string;
  sbiOmschrijving?: string;
  indHoofdactiviteit?: string;
};

export type KvkAdres = {
  type?: string;
  plaats?: string;
  straatnaam?: string;
  huisnummer?: number;
  postcode?: string;
  volledigAdres?: string;
  straatHuisnummer?: string;
  postcodeWoonplaats?: string;
  land?: string;
};

export type KvkVestiging = {
  vestigingsnummer?: string;
  kvkNummer?: string;
  eersteHandelsnaam?: string;
  statutaireNaam?: string;
  indHoofdvestiging?: string;
  handelsnamen?: KvkHandelsnaam[];
  adressen?: KvkAdres[];
  websites?: string[];
  sbiActiviteiten?: KvkSbiActiviteit[];
  links?: KvkLink[];
};

export type KvkEigenaar = {
  rsin?: string;
  rechtsvorm?: string;
  uitgebreideRechtsvorm?: string;
  adressen?: KvkAdres[];
  websites?: string[];
  links?: KvkLink[];
};

export type KvkEmbedded = {
  hoofdvestiging?: KvkVestiging;
  eigenaar?: KvkEigenaar;
};

export type KvkBasisprofiel = {
  kvkNummer?: string;
  naam?: string;
  statutaireNaam?: string;
  formeleRegistratiedatum?: string;
  totaalWerkzamePersonen?: number;
  handelsnamen?: KvkHandelsnaam[];
  sbiActiviteiten?: KvkSbiActiviteit[];
  links?: KvkLink[];
  _embedded?: KvkEmbedded;
};

export type KvkVestigingBasis = {
  vestigingsnummer?: string;
  kvkNummer?: string;
  eersteHandelsnaam?: string;
  indHoofdvestiging?: string;
  volledigAdres?: string;
  links?: KvkLink[];
};

export type KvkVestigingenListResponse = {
  kvkNummer?: string;
  vestigingen?: KvkVestigingBasis[];
  totaalAantalVestigingen?: number;
  links?: KvkLink[];
};
