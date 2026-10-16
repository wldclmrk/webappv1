/**
 * Customer part numbers ("cross-references"). Some trade customers have their own codes for our
 * items, held in a free-text custom field on the NetSuite item record. When one of their users is
 * signed in, the site shows their code in place of the Weldclass part number.
 *
 * To add another customer: add a line to CROSSREFS with the item field and how to recognise that
 * customer's accounts (by company name, or by NetSuite customer ID in `ids`).
 */
import { suiteql } from '../netsuite';

type Crossref = { field: string; label: string; name?: RegExp; ids?: number[] };

const CROSSREFS: Crossref[] = [
  // Item field 6360, "Blackwoods - Weldclass Ranged/Listed Item". Every Blackwoods branch account.
  { field: 'custitem_wc_crossref_blackwoods_ranged', label: 'Blackwoods', name: /^blackwoods\b/i },
];

export function crossrefFor(account: { id: number; name: string }): Crossref | null {
  return CROSSREFS.find((c) => c.ids?.includes(account.id) || (c.name && c.name.test(account.name.trim()))) ?? null;
}

/** All of a customer's part numbers: Weldclass part number (upper case) -> their code. Cached for 10 minutes per field. */
const cache = new Map<string, { at: number; map: Promise<Map<string, string>> }>();

export function partNumberMap(c: Crossref): Promise<Map<string, string>> {
  if (!/^custitem[a-z0-9_]+$/.test(c.field)) throw new Error('Bad cross-reference field');
  const hit = cache.get(c.field);
  if (hit && Date.now() - hit.at < 600_000) return hit.map;
  const map = (async () => {
    const rows = await suiteql<{ itemid: string; cpn: string }>(
      'SELECT itemid, ' + c.field + " AS cpn FROM item WHERE isinactive = 'F' AND " + c.field + ' IS NOT NULL',
      10000,
    );
    const m = new Map<string, string>();
    for (const r of rows) {
      const v = String(r.cpn ?? '').trim();
      if (v) m.set(String(r.itemid).trim().toUpperCase(), v);
    }
    return m;
  })();
  map.catch(() => cache.delete(c.field));
  cache.set(c.field, { at: Date.now(), map });
  return map;
}
