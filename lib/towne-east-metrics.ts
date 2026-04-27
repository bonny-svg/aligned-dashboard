// ─── /lib/towne-east-metrics.ts ────────────────────────────────────────────
// Computes Towne East Village dashboard metrics from the three OneSite exports.
// Same file format as The Grove; adapted for 100-unit property.

import type { RentRollUnit, AvailabilityUnit, ResidentBalance } from "./grove-parsers";

const TOTAL_UNITS = 100;

function daysBetween(isoOrUSDate: string, ref = new Date()): number | null {
  if (!isoOrUSDate) return null;
  const d = new Date(isoOrUSDate);
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

export interface TowneEastMetrics {
  asOf: string;

  // Occupancy
  unitCount: number;
  occupiedCount: number;
  occupiedNTVCount: number;
  vacantCount: number;
  physicalOccupancyPct: number;
  leasedOccupancyPct: number;

  // Financial
  gpr: number;
  totalLeaseRent: number;
  economicOccupancyPct: number;

  // Collections (from balances)
  totalCharged: number;
  totalCollected: number;
  collectionRatePct: number;
  delinquentBalance: number;
  priorPeriodBalance: number;
  newDelinquencyThisPeriod: number;
  delinquentCount: number;

  // Top delinquents
  topDelinquents: { unit: string; name: string; amount: number }[];

  // Leasing
  moveOutsNTVCount: number;
  monthToMonthCount: number;
  signedLeasesMTD: number;
  expiring30d: number;
  expiring60d: number;
  expiring90d: number;
  leaseExpirationByMonth: { month: string; expiring: number; ntv: number; mtm: number }[];
  moveOutsThisMonth: { unit: string; residentName: string; moveOutDate: string }[];
  leaseStartsThisMonth: { unit: string; residentName: string; leaseStart: string }[];

  // Renovations (from availability)
  vacantTotalCount: number;
  notReadyCount: number;
  rentReadyCount: number;
  inProcessCount: number;
  notStartedCount: number;
}

export function computeTowneEastMetrics(
  rentRoll: RentRollUnit[],
  availability: AvailabilityUnit[],
  balances: ResidentBalance[]
): TowneEastMetrics {
  const occupied     = rentRoll.filter((u) => u.status === "Occupied");
  const occupiedNTV  = rentRoll.filter((u) => u.status === "Occupied-NTV");
  const vacant       = rentRoll.filter((u) => u.status === "Vacant");

  const occCount     = occupied.length;
  const occNTVCount  = occupiedNTV.length;
  const vacCount     = vacant.length;

  const physicalOccupancyPct = ((occCount + occNTVCount) / TOTAL_UNITS) * 100;
  const leasedOccupancyPct   = ((occCount + occNTVCount) / TOTAL_UNITS) * 100; // no Vacant-Leased at TE

  // Economic occupancy
  const gpr = rentRoll.filter(u => u.status !== "Unknown").reduce((s, u) => s + u.marketRent, 0);
  const totalLeaseRent = rentRoll
    .filter((u) => u.status === "Occupied" || u.status === "Occupied-NTV")
    .reduce((s, u) => s + u.leaseRent, 0);
  const economicOccupancyPct = gpr > 0 ? (totalLeaseRent / gpr) * 100 : 0;

  // ── Collections ──────────────────────────────────────────────────────────
  const currentResidents = balances.filter((b) => b.status === "Current resident");
  const totalCharged   = currentResidents.reduce((s, b) => s + b.leaseCharges, 0);
  const totalCollected = balances.reduce((s, b) => s + b.totalCredits, 0);
  const collectionRatePct = totalCharged > 0 ? (totalCollected / totalCharged) * 100 : 0;

  const delinquents = balances.filter((b) => b.endingDelinquent > 0);
  const delinquentBalance        = delinquents.reduce((s, b) => s + b.endingDelinquent, 0);
  const priorPeriodBalance       = delinquents.reduce((s, b) => s + b.beginningDelinquent, 0);
  const newDelinquencyThisPeriod = Math.max(0, delinquentBalance - priorPeriodBalance);
  const delinquentCount          = delinquents.length;

  const topDelinquents = [...delinquents]
    .sort((a, b) => b.endingDelinquent - a.endingDelinquent)
    .slice(0, 8)
    .map((b) => ({ unit: b.unit, name: b.residentName, amount: b.endingDelinquent }));

  // ── Leasing ──────────────────────────────────────────────────────────────
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear  = now.getFullYear();

  const leaseStartsThisMonth = rentRoll
    .filter((u) => {
      if (!u.leaseStart) return false;
      const d = new Date(u.leaseStart);
      return !isNaN(d.getTime()) && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    })
    .map((u) => ({ unit: u.unit, residentName: u.residentName, leaseStart: u.leaseStart }));

  const signedLeasesMTD = leaseStartsThisMonth.length;

  const moveOutsThisMonth = occupiedNTV
    .map((u) => ({ unit: u.unit, residentName: u.residentName, moveOutDate: u.leaseEnd }))
    .sort((a, b) => new Date(a.moveOutDate).getTime() - new Date(b.moveOutDate).getTime());

  const expiring30d = rentRoll.filter((u) => {
    const d = daysBetween(u.leaseEnd);
    return d != null && d >= 0 && d <= 30;
  }).length;
  const expiring60d = rentRoll.filter((u) => {
    const d = daysBetween(u.leaseEnd);
    return d != null && d >= 0 && d <= 60;
  }).length;
  const expiring90d = rentRoll.filter((u) => {
    const d = daysBetween(u.leaseEnd);
    return d != null && d >= 0 && d <= 90;
  }).length;

  const monthToMonthCount = rentRoll.filter((u) => {
    if (u.status !== "Occupied" && u.status !== "Occupied-NTV") return false;
    const d = daysBetween(u.leaseEnd);
    return d != null && d < 0;
  }).length;

  // 6-month lease expiration heatmap
  const leaseExpirationByMonth = Array.from({ length: 6 }, (_, i) => {
    const d    = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const yr   = d.getFullYear();
    const mo   = d.getMonth();
    const month = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    const expiring = rentRoll.filter((u) => {
      const le = u.leaseEnd ? new Date(u.leaseEnd) : null;
      return le && !isNaN(le.getTime()) && le.getFullYear() === yr && le.getMonth() === mo;
    }).length;

    const ntv = occupiedNTV.filter((u) => {
      const le = u.leaseEnd ? new Date(u.leaseEnd) : null;
      return le && !isNaN(le.getTime()) && le.getFullYear() === yr && le.getMonth() === mo;
    }).length;

    // MTM units are only relevant in the current month
    const mtm = i === 0 ? monthToMonthCount : 0;

    return { month, expiring, ntv, mtm };
  });

  // ── Renovations (from availability) ──────────────────────────────────────
  const notReadyUnits = availability.filter(
    (u) => u.section === "VacantNotLeasedNotReady" || u.section === "VacantLeasedNotReady"
  );
  const vacantTotalCount = vacCount;
  const notReadyCount    = notReadyUnits.length;
  const rentReadyCount   = Math.max(0, vacantTotalCount - notReadyCount);
  const inProcessCount   = notReadyUnits.filter((u) => {
    if (!u.makeReady) return false;
    const d = daysBetween(u.makeReady);
    return d != null && d > 0;
  }).length;
  const notStartedCount = notReadyUnits.filter((u) => !u.makeReady).length;

  return {
    asOf: new Date().toISOString(),
    unitCount: rentRoll.filter(u => u.status !== "Unknown").length,
    occupiedCount: occCount,
    occupiedNTVCount: occNTVCount,
    vacantCount,
    physicalOccupancyPct,
    leasedOccupancyPct,
    gpr,
    totalLeaseRent,
    economicOccupancyPct,
    totalCharged,
    totalCollected,
    collectionRatePct,
    delinquentBalance,
    priorPeriodBalance,
    newDelinquencyThisPeriod,
    delinquentCount,
    topDelinquents,
    moveOutsNTVCount: occNTVCount,
    monthToMonthCount,
    signedLeasesMTD,
    expiring30d,
    expiring60d,
    expiring90d,
    leaseExpirationByMonth,
    moveOutsThisMonth,
    leaseStartsThisMonth,
    vacantTotalCount,
    notReadyCount,
    rentReadyCount,
    inProcessCount,
    notStartedCount,
  };
}
