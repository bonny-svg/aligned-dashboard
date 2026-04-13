import { NextResponse } from 'next/server';

const SHEET_ID = '1Jt9WIaON5joUPNwduptvgRb3PyjyZmsioGGP6KJudh8';
const CAPEX_GID = '384006253';
const EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${CAPEX_GID}`;

export const revalidate = 300;

const PHASE_ORDER = [
  'Immediate',
  'Unit Renovations',
  'Year 1',
  'As-Needed',
  'Reserves / Ongoing 12+ Months',
];

const PHASE_LABELS: Record<string, string> = {
  'Immediate': '0–60 Days (Immediate)',
  'Unit Renovations': 'Unit Renovations',
  'Year 1': 'Year 1 CapEx',
  'As-Needed': 'As-Needed',
  'Reserves / Ongoing 12+ Months': 'Reserves & Ongoing',
};

const PHASE_COLORS: Record<string, string> = {
  'Immediate': 'red',
  'Unit Renovations': 'blue',
  'Year 1': 'amber',
  'As-Needed': 'purple',
  'Reserves / Ongoing 12+ Months': 'gray',
};

function parseAmount(val: string): number | null {
  if (!val || val.trim() === '' || val.trim() === '-') return null;
  const cleaned = val.replace(/[$,\s]/g, '').replace(/^\$\s*-$/, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export async function GET() {
  try {
    const res = await fetch(EXPORT_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    const csv = await res.text();

    const rows = csv.split('\n').map(row => {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const ch of row) {
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
        else { current += ch; }
      }
      fields.push(current.trim());
      return fields;
    });

    // Col A=0 item, B=1 phase, C=2 proposed, D=3 underwriting, E=4 actual, S=18 notes
    const items: any[] = [];
    const SKIP_LABELS = [
      'renovation / capex item',
      'towne east village',
      'legend:',
      'total capex',
    ];

    for (const row of rows) {
      const item = (row[0] || '').trim();
      const phase = (row[1] || '').trim();
      if (!item) continue;
      // Skip header, title, legend, subtotal rows
      const itemLower = item.toLowerCase();
      if (SKIP_LABELS.some(s => itemLower.includes(s))) continue;
      if (itemLower.includes('subtotal') || itemLower.includes('total')) continue;
      if (!phase) continue; // section header rows have no phase

      const proposed = parseAmount(row[2] || '');
      const underwriting = parseAmount(row[3] || '');
      const actual = parseAmount(row[4] || '');
      const notes = (row[18] || '').trim();

      if (underwriting === null && proposed === null) continue;

      items.push({
        item,
        phase,
        proposed,
        underwriting,
        actual,
        notes,
      });
    }

    // Group by phase
    const grouped: Record<string, any[]> = {};
    for (const item of items) {
      if (!grouped[item.phase]) grouped[item.phase] = [];
      grouped[item.phase].push(item);
    }

    // Build phase summaries
    const phases = PHASE_ORDER
      .filter(p => grouped[p])
      .map(p => {
        const phaseItems = grouped[p];
        const totalUnderwriting = phaseItems.reduce((s: number, i: any) => s + (i.underwriting ?? 0), 0);
        const totalActual = phaseItems.some((i: any) => i.actual !== null)
          ? phaseItems.reduce((s: number, i: any) => s + (i.actual ?? 0), 0)
          : null;
        return {
          phase: p,
          label: PHASE_LABELS[p] || p,
          color: PHASE_COLORS[p] || 'gray',
          totalUnderwriting,
          totalActual,
          items: phaseItems,
        };
      });

    const grandTotalUnderwriting = phases.reduce((s, p) => s + p.totalUnderwriting, 0);
    const grandTotalActual = phases.some(p => p.totalActual !== null)
      ? phases.reduce((s, p) => s + (p.totalActual ?? 0), 0)
      : null;

    return NextResponse.json({
      phases,
      grandTotalUnderwriting,
      grandTotalActual,
      lastFetched: new Date().toISOString(),
    });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
