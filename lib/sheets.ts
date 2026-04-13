export interface SheetRow {
  [key: string]: string;
}

export interface SheetsSummary {
  rentRoll:     Record<string, SheetRow>;
  delinquency:  Record<string, SheetRow>;
  financials:   Record<string, SheetRow>;
  availability: Record<string, SheetRow>;
  work_orders:  Record<string, SheetRow>;
}

function latestPerProperty(rows: SheetRow[]): Record<string, SheetRow> {
  const map: Record<string, SheetRow> = {};
  for (const row of rows) {
    const pid = row['property_id'];
    if (!pid) continue;
    map[pid] = row;
  }
  return map;
}

export async function fetchSheetsSummary(): Promise<SheetsSummary | null> {
  try {
    const res = await fetch('/api/sheets', { cache: 'no-store' });
    if (!res.ok) return null;
    const raw = await res.json();
    return {
      rentRoll:     latestPerProperty(raw.rent_roll    || []),
      delinquency:  latestPerProperty(raw.delinquency  || []),
      financials:   latestPerProperty(raw.financials   || []),
      availability: latestPerProperty(raw.availability || []),
      work_orders:  latestPerProperty(raw.work_orders  || []),
    };
  } catch (e) {
    console.error('Failed to fetch sheets data:', e);
    return null;
  }
}
