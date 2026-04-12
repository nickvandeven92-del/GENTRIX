/**
 * RDAP “object exists?” — geen garantie voor alle TLD’s; .nl / .com / .net zijn gangbaar.
 */
export type RdapAvailabilityHint = "available" | "taken" | "unknown";

function normalizeFqdn(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]?.split(":")[0]?.trim();
  if (!s || s.length > 253) return null;
  if (!/^[a-z0-9.-]+$/.test(s)) return null;
  const labels = s.split(".");
  if (labels.length < 2) return null;
  return s;
}

function rdapUrlForDomain(domain: string): string | null {
  const parts = domain.split(".");
  const tld = parts[parts.length - 1];
  if (tld === "nl") {
    return `https://rdap.sidn.nl/domain/${encodeURIComponent(domain.toUpperCase())}`;
  }
  if (tld === "com") {
    return `https://rdap.verisign.com/com/v1/domain/${encodeURIComponent(domain.toUpperCase())}`;
  }
  if (tld === "net") {
    return `https://rdap.verisign.com/net/v1/domain/${encodeURIComponent(domain.toUpperCase())}`;
  }
  return null;
}

export async function checkDomainAvailabilityHint(domain: string): Promise<{
  domain: string;
  hint: RdapAvailabilityHint;
  detail: string;
}> {
  const fqdn = normalizeFqdn(domain);
  if (!fqdn) {
    return { domain, hint: "unknown", detail: "Ongeldige domeinnaam." };
  }

  const url = rdapUrlForDomain(fqdn);
  if (!url) {
    return {
      domain: fqdn,
      hint: "unknown",
      detail: "Automatische check is alleen ingesteld voor .nl, .com en .net. Vraag je studio om andere extensies.",
    };
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 9000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/rdap+json, application/json" },
      signal: ac.signal,
      cache: "no-store",
    });
    if (res.status === 404) {
      return { domain: fqdn, hint: "available", detail: "RDAP: geen registratie gevonden (vaak vrij)." };
    }
    if (res.ok) {
      return { domain: fqdn, hint: "taken", detail: "RDAP: domein bestaat in het register." };
    }
    return { domain: fqdn, hint: "unknown", detail: `RDAP antwoord ${res.status}; probeer later opnieuw.` };
  } catch {
    return { domain: fqdn, hint: "unknown", detail: "RDAP-bereikbaarheid onbekend (timeout of netwerk)." };
  } finally {
    clearTimeout(timer);
  }
}
