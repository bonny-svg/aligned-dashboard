import { NextResponse } from 'next/server';

const SHEET_ID = '1Jt9WIaON5joUPNwduptvgRb3PyjyZmsioGGP6KJudh8';
const EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&sheet=Sheet1`;

export const revalidate = 300;

const FLOORPLAN_LABELS: Record<string, string> = {
  A1: '1 BD / 1 BA (A1)', A2: '1 BD / 1 BA (A2)', A3: '1 BD / 1 BA (A3)',
  B1: '2 BD / 1 BA', B2: '2 BD / 2 BA',
};

const FLOORPLAN_BUDGETS: Record<string, number> = {
  A1: 5000, A2: 5000, A3: 5000, B1: 5000, B2: 10000,
};

function parseAmount(val: string): number {
  if (!val) return 0;
  const num = parseFloat(val.replace(/[$,\s]/g, ''));
  return isNaN(num) ? 0 : num;
}

function formatDate(val: string): string {
  if (!val) return '';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return val; }
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

    const units: any[] = [];
    let currentStatus: string = 'Not Started';

    for (const row of rows) {
      const colC = (row[2] || '').trim();
      const colB = (row[1] || '').trim();

      if (colC === 'Completed') { currentStatus = 'Complete'; continue; }
      if (colC === 'Work in Progress') { currentStatus = 'In Progress'; continue; }
      if (colC === 'Upcoming') { currentStatus = 'Planned'; continue; }
      if (!colB || colB === 'Unit' || colC === 'Town East Village San Antonio') continue;
      if (!/^\d+/.test(colB)) continue;

      const floorplan = colC;
      const budget = FLOORPLAN_BUDGETS[floorplan] ?? parseAmount(row[3] || '');
      const startDate = (row[6] || '').trim();
      const walkDate = (row[5] || '').trim();

      let status = currentStatus;
      if (currentStatus === 'Planned') {
        if (startDate) status = 'In Progress';
        else if (walkDate || (row[4] || '').trim()) status = 'Planned';
        else status = 'Not Started';
      }

      units.push({
        unit: colB,
        floorplan,
        budget,
        moveOutDate: formatDate(row[4] || ''),
        walkDate: formatDate(walkDate),
        startDate: formatDate(startDate),
        promiseDate: formatDate(row[7] || ''),
        actualCompletionDate: formatDate(row[8] || ''),
        contractor: (row[10] || '').trim(),
        actualFinalSpend: parseAmount(row[11] || ''),
        completionPct: (row[12] || '').trim(),
        notes: (row[13] || '').trim(),
        status,
      });
    }

    const TOTAL_UNITS = 100;
    const TOTAL_BUDGET = 620000;

    const unitsComplete = units.filter(u => u.status === 'Complete').length;
    const unitsInProgress = units.filter(u => u.status === 'In Progress').length;
    const unitsPlanned = units.filter(u => u.status === 'Planned').length;
    const totalUnitsInPlan = units.length;
    const unitsNotStarted = TOTAL_UNITS - totalUnitsInPlan;
    const totalSpent = units.reduce((sum, u) => sum + u.actualFinalSpend, 0);

    const floorplanMap: Record<string, { actuals: number[]; complete: number; total: number }> = {};
    for (const u of units) {
      if (!u.floorplan) continue;
      if (!floorplanMap[u.floorplan]) floorplanMap[u.floorplan] = { actuals: [], complete: 0, total: 0 };
      floorplanMap[u.floorplan].total++;
      if (u.actualFinalSpend > 0) floorplanMap[u.floorplan].actuals.push(u.actualFinalSpend);
      if (u.status === 'Complete') floorplanMap[u.floorplan].complete++;
    }

    const byUnitType = Object.entries(floorplanMap).map(([fp, data]) => ({
      type: FLOORPLAN_LABELS[fp] || fp,
      budgetPerUnit: FLOORPLAN_BUDGETS[fp] ?? 0,
      avgActualPerUnit: data.actuals.length
        ? Math.round(data.actuals.reduce((a, b) => a + b, 0) / data.actuals.length)
        : 0,
      unitsComplete: data.complete,
      totalUnits: data.total,
    }));

    return NextResponse.json({
      units,
      summary: {
        totalBudget: TOTAL_BUDGET,
        totalSpent,
        unitsComplete,
        unitsInProgress,
        unitsPlanned,
        unitsNotStarted,
        totalUnitsInPlan,
        totalUnits: TOTAL_UNITS,
        byUnitType,
      },
      lastFetched: new Date().toISOString(),
    });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
