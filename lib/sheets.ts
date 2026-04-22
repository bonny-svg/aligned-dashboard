export interface SheetRow {
  [key: string]: string;
}

export interface SheetsSummary {
  snapshot:   Record<string, SheetRow>;  // fill-forward: latest non-empty value per field, per property
  financials: Record<string, SheetRow>;  // latest month per property
  tasks:      SheetRow[];
}

/**
 * Fill-forward merge: for each property, walks rows in chronological order
 * (by received_date) and takes the most recent NON-EMPTY value for each field.
 *
 * Why: a daily AppFolio rent-roll feed has ~12 fields populated; a weekly PM
 * email has ~45 fields populated. Latest-row-wins would overwrite the PM
 * narrative with blanks on the next daily feed. Fill-forward preserves the
 * freshest version of each individual field across all source emails.
 */
function fillForwardPerProperty(rows: SheetRow[]): Record<string, SheetRow> {
  const byProp: Record<string, SheetRow[]> = {};
  for (const row of rows) {
    const pid = row['property_id'];
    if (!pid) continue;
    if (!byProp[pid]) byProp[pid] = [];
    byProp[pid].push(row);
  }

  const merged: Record<string, SheetRow> = {};
  for (const pid of Object.keys(byProp)) {
    // Sort by received_date ascending — older first, newer overwrites
    const sorted = byProp[pid].slice().sort((a, b) => {
      const ta = Date.parse(a.received_date || '') || 0;
      const tb = Date.parse(b.received_date || '') || 0;
      return ta - tb;
    });

    const acc: SheetRow = {};
    for (const row of sorted) {
      for (const key of Object.keys(row)) {
        const v = row[key];
        // Treat '', '0', null-ish as "no signal" for fill-forward — except for keys
        // where 0 is meaningful data (occupancy could legitimately be 0 briefly).
        if (v === '' || v == null) continue;
        acc[key] = v;
      }
    }
    merged[pid] = acc;
  }
  return merged;
}

function latestPerProperty(rows: SheetRow[]): Record<string, SheetRow> {
  // For financials, we want the actual most recent monthly row — not fill-forward.
  // Different months have genuinely different values; we shouldn't mix them.
  const byProp: Record<string, SheetRow> = {};
  const seen: Record<string, number> = {};
  for (const row of rows) {
    const pid = row['property_id'];
    if (!pid) continue;
    const t = Date.parse(row.received_date || '') || 0;
    if (t >= (seen[pid] || 0)) {
      byProp[pid] = row;
      seen[pid] = t;
    }
  }
  return byProp;
}

export async function fetchSheetsSummary(): Promise<SheetsSummary | null> {
  try {
    const res = await fetch('/api/sheets', { cache: 'no-store' });
    if (!res.ok) return null;
    const raw = await res.json();
    return {
      snapshot:   fillForwardPerProperty(raw.snapshots          || []),
      financials: latestPerProperty(raw.financials_monthly       || []),
      tasks:      raw.tasks                                      || [],
    };
  } catch (e) {
    console.error('Failed to fetch sheets data:', e);
    return null;
  }
}
