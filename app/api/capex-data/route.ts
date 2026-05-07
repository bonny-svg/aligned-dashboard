import { NextResponse } from 'next/server';

const SHEET_ID = '1Jt9WIaON5joUPNwduptvgRb3PyjyZmsioGGP6KJudh8';
const CAPEX_GID = '384006253';
const EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${CAPEX_GID}`;

export const revalidate = 300;

// Column layout (0-indexed):
//   A=0  Renovation / CapEx Item
//   B=1  Phase
//   C=2  Underwriting
//   D=3  Status
//   E=4  Actual
//   F=5  Notes
//   G=6+ Monthly spend columns (Mar, Apr, May, …)

const MONTH_ABBREVS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const PHASE_ORDER = [
  'Immediate',
  'Unit Renovations',
  'Year 1',
  'As-Needed',
  'Reserves / Ongoing 12+ Months',
];

const PHASE_LABELS: Record<string, string> = {
  'Immediate': '0–90 Days (Immediate)',
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

    // Find the header row to discover month columns (G onwards)
    let monthCols: { name: string; idx: number }[] = [];
    for (const row of rows) {
      const cellA = (row[0] || '').trim().toLowerCase();
      if (cellA === 'renovation / capex item') {
        for (let i = 6; i < row.length; i++) {
          const h = (row[i] || '').trim();
          if (MONTH_ABBREVS.includes(h)) {
            monthCols.push({ name: h, idx: i });
          }
        }
        break;
      }
    }

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
      const itemLower = item.toLowerCase();
      if (SKIP_LABELS.some(s => itemLower.includes(s))) continue;
      if (itemLower.includes('subtotal') || itemLower.includes('total')) continue;
      if (!phase) continue;

      const underwriting = parseAmount(row[2] || '');
      const status       = (row[3] || '').trim();
      const actual       = parseAmount(row[4] || '');
      const notes        = (row[5] || '').trim();

      if (underwriting === null) continue;

      // Monthly spend breakdown
      const monthlySpend: Record<string, number> = {};
      for (const { name, idx } of monthCols) {
        const v = parseAmount(row[idx] || '');
        if (v !== null && v > 0) monthlySpend[name] = v;
      }

      items.push({ item, phase, underwriting, status, actual, notes, monthlySpend });
    }

    // Group by phase
    const grouped: Record<string, any[]> = {};
    for (const item of items) {
      if (!grouped[item.phase]) grouped[item.phase] = [];
      grouped[item.phase].push(item);
    }

    // Aggregate monthly spend totals across all items
    const monthlyTotals: Record<string, number> = {};
    for (const item of items) {
      for (const [month, amt] of Object.entries(item.monthlySpend as Record<string, number>)) {
        monthlyTotals[month] = (monthlyTotals[month] ?? 0) + amt;
      }
    }
    // Return months in calendar order
    const monthlySpendSeries = MONTH_ABBREVS
      .filter(m => monthlyTotals[m] !== undefined)
      .map(m => ({ month: m, amount: monthlyTotals[m] }));

    // Build phase summaries
    const phases = PHASE_ORDER
      .filter(p => grouped[p])
      .map(p => {
        const phaseItems = grouped[p];
        const totalUnderwriting = phaseItems.reduce((s: number, i: any) => s + (i.underwriting ?? 0), 0);
        const totalActual = phaseItems.some((i: any) => i.actual !== null)
          ? phaseItems.reduce((s: number, i: any) => s + (i.actual ?? 0), 0)
          : null;

        // Phase-level monthly totals
        const phaseMonthly: Record<string, number> = {};
        for (const pi of phaseItems) {
          for (const [month, amt] of Object.entries(pi.monthlySpend as Record<string, number>)) {
            phaseMonthly[month] = (phaseMonthly[month] ?? 0) + amt;
          }
        }

        return {
          phase: p,
          label: PHASE_LABELS[p] || p,
          color: PHASE_COLORS[p] || 'gray',
          totalUnderwriting,
          totalActual,
          items: phaseItems,
          monthlySpend: phaseMonthly,
        };
      });

    const grandTotalUnderwriting = phases.reduce((s, p) => s + p.totalUnderwriting, 0);
    const grandTotalActual = phases.some(p => p.totalActual !== null)
      ? phases.reduce((s, p) => s + (p.totalActual ?? 0), 0)
      : null;
    const grandTotalMonthlySpend = monthlySpendSeries.reduce((s, m) => s + m.amount, 0);

    return NextResponse.json({
      phases,
      grandTotalUnderwriting,
      grandTotalActual,
      grandTotalMonthlySpend,
      monthlySpendSeries,
      monthCols: monthCols.map(m => m.name),
      lastFetched: new Date().toISOString(),
    });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
