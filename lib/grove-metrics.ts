// ─── /lib/grove-metrics.ts ─────────────────────────────────────────────────
// Pure functions that turn parsed data into dashboard metrics.

import type {
  RentRollUnit,
  AvailabilityUnit,
  ResidentBalance,
} from "./grove-parsers";
import { THRESHOLDS, classifyMakeReady, MakeReadyClass, AGING_BUCKETS, GROVE_META } from "./grove-config";

// ─── Helpers ───────────────────────────────────────────────────────────────
function daysBetween(isoOrUSDate: string, ref = new Date()): number | null {
  if (!isoOrUSDate) return null;
  const d = new Date(isoOrUSDate);
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Complete metrics shape (flat so baseline diff is trivial) ─────────────
export interface GroveMetrics {
  unitCount: number;
  occupiedCount: number;
  occupiedNTVCount: number;
  vacantCount: number;
  vacantLeasedCount: number;

  physicalOccupancyPct: number;
  leasedOccupancyPct: number;
  projected60DayOccupancyPct: number;

  gpr: number;
  totalLeaseRent: number;
  economicOccupancyPct: number;
  lossToLeasePct: number;

  // Leasing
  signedLeasesCount: number;
  signedLeasesMTD: number;
  moveOutsCount: number;
  netLeasingVelocity: number; // signed - moveouts
  netLeasingVelocityScore: number; // 0-100
  pipeline90Day: number;
  expiring90DayCount: number;
  leaseExpirationByMonth: { month: string; count: number }[];
  applicationFunnel: { stage: string; count: number }[];
  monthToMonthRisk: { unit: string; residentName: string; leaseEnd: string }[];
  leaseStartsThisMonth: { unit: string; residentName: string; leaseStart: string }[];
  moveOutsThisMonth: { unit: string; residentName: string; moveOutDate: string }[];

  // Delinquency
  totalDelinquent: number;
  delinquentCount: number;
  delinquencyPctGPR: number;
  delinquencyScore: number; // 0-100; higher better
  delinquencyAging: { label: string; amount: number; count: number; color: string }[];
  topDelinquents: {
    unit: string;
    name: string;
    amount: number;
    monthsBehind: number;
    leaseEndDays: number | null;
    leaseEndingSoon: boolean;
  }[];
  evictionRiskCount: number;
  concentrationPct: number;
  payingDownCount: number;

  // Renovations
  rentReadyCount: number;
  vacantTotalCount: number;
  rentReadyRatio: number;
  avgDaysVacant: number;
  unknownDaysVacantCount: number;
  estMonthlyVacancyLoss: number;
  makeReadyBreakdown: { cls: MakeReadyClass; count: number }[];
  daysVacantDistribution: { bucket: string; count: number; color: string }[];
  sayanUnitsTotal: number;
  sayanUnitsInProgress: number;
  longestVacant: { unit: string; days: number; cost: number }[];

  // Floorplan
  floorplanStats: {
    floorplan: string;
    total: number;
    occupied: number;
    occupiedPct: number;
    avgMarketRent: number;
    avgLeaseRent: number;
  }[];

  // Data hygiene
  dataHygieneWarnings: string[];
  asOf: string;
}

// ─── The one-shot metrics computation ──────────────────────────────────────
export function computeMetrics(
  rentRoll: RentRollUnit[],
  availability: AvailabilityUnit[],
  balances: ResidentBalance[]
): GroveMetrics {
  const unitCount = rentRoll.length;

  const occupied = rentRoll.filter((u) => u.status === "Occupied");
  const occupiedNTV = rentRoll.filter((u) => u.status === "Occupied-NTV");
  const vacant = rentRoll.filter((u) => u.status === "Vacant");
  const vacantLeased = rentRoll.filter((u) => u.status === "Vacant-Leased");

  const occCount = occupied.length;
  const occNTVCount = occupiedNTV.length;
  const vacCount = vacant.length;
  const vacLeasedCount = vacantLeased.length;
  const total = GROVE_META.units; // always 288 for % calcs

  const physicalOccupancyPct = ((occCount + occNTVCount) / total) * 100;
  const leasedOccupancyPct = ((occCount + occNTVCount + vacLeasedCount) / total) * 100;
  const projected60DayOccupancyPct = ((occCount + vacLeasedCount) / total) * 100;

  const gpr = rentRoll.reduce((s, u) => s + u.marketRent, 0);
  const totalLeaseRent = rentRoll
    .filter((u) => u.status === "Occupied" || u.status === "Occupied-NTV")
    .reduce((s, u) => s + u.leaseRent, 0);

  const occupiedMarketRent = rentRoll
    .filter((u) => u.status === "Occupied" || u.status === "Occupied-NTV")
    .reduce((s, u) => s + u.marketRent, 0);
  const economicOccupancyPct = gpr > 0 ? (totalLeaseRent / gpr) * 100 : 0;
  const lossToLeasePct =
    occupiedMarketRent > 0 ? ((occupiedMarketRent - totalLeaseRent) / occupiedMarketRent) * 100 : 0;

  // ─── Leasing pipeline ────────────────────────────────────────────────────
  const signedLeasesCount = availability.filter(
    (u) => u.section === "VacantLeasedNotReady" || !!u.leaseSigned
  ).length;
  // NTV count is the near-term move-out proxy. We deliberately skip the rent-roll
  // move-in/out column (c23): for occupied units it's their lifetime move-in date,
  // not a move-out this period.
  const moveOutsCount = occupiedNTV.length;
  const netLeasingVelocity = signedLeasesCount - moveOutsCount;

  // Normalize to 0-100: map range [-20, +20] → [0, 100], clamp.
  const netLeasingVelocityScore = Math.max(0, Math.min(100, 50 + netLeasingVelocity * 2.5));

  // 90-day pipeline: applied + approved + signed + scheduled MI
  const pipeline90Day = availability.filter(
    (u) => !!u.applicantName || !!u.leaseSigned || !!u.scheduledMoveIn
  ).length;

  // Lease expirations by calendar month (next 6 months)
  const now = new Date();
  const leaseExpirationByMonth: { month: string; count: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthStr = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const count = rentRoll.filter((u) => {
      const d2 = u.leaseEnd ? new Date(u.leaseEnd) : null;
      if (!d2 || isNaN(d2.getTime())) return false;
      return d2.getFullYear() === d.getFullYear() && d2.getMonth() === d.getMonth();
    }).length;
    leaseExpirationByMonth.push({ month: monthStr, count });
  }

  const expiring90DayCount = rentRoll.filter((u) => {
    const days = daysBetween(u.leaseEnd);
    return days != null && days >= 0 && days <= 90;
  }).length;

  // Application funnel from availability report
  const applied = availability.filter((u) => !!u.applicantName && !u.leaseSigned).length;
  const approved = availability.filter((u) => !!u.applicantName && !!u.leaseSigned && !u.scheduledMoveIn).length;
  const leaseSigned = availability.filter((u) => !!u.leaseSigned).length;
  const scheduledMI = availability.filter((u) => !!u.scheduledMoveIn).length;
  const applicationFunnel = [
    { stage: "Applied", count: applied + approved + leaseSigned },
    { stage: "Approved", count: approved + leaseSigned },
    { stage: "Lease Signed", count: leaseSigned },
    { stage: "Scheduled MI", count: scheduledMI },
  ];

  // Month-to-month risk: lease end in past, still Occupied or Occupied-NTV
  const monthToMonthRisk = rentRoll
    .filter((u) => {
      if (u.status !== "Occupied" && u.status !== "Occupied-NTV") return false;
      const days = daysBetween(u.leaseEnd);
      return days != null && days < 0;
    })
    .map((u) => ({ unit: u.unit, residentName: u.residentName, leaseEnd: u.leaseEnd }))
    .slice(0, 50);

  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const leaseStartsThisMonth = rentRoll
    .filter((u) => {
      if (!u.leaseStart) return false;
      const d = new Date(u.leaseStart);
      return !isNaN(d.getTime()) && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    })
    .map((u) => ({ unit: u.unit, residentName: u.residentName, leaseStart: u.leaseStart }));

  // MTD signed leases: pending (availability leaseSigned this month) + already moved in (leaseStart this month)
  const signedThisMonthPending = availability.filter((u) => {
    if (!u.leaseSigned) return false;
    const d = new Date(u.leaseSigned);
    return !isNaN(d.getTime()) && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;
  const signedLeasesMTD = signedThisMonthPending + leaseStartsThisMonth.length;

  // Use NTV units' lease-end date as the expected move-out date (moveInOut on occupied units
  // is the original move-in date, not a future vacate date).
  const moveOutsThisMonth = occupiedNTV
    .map((u) => ({ unit: u.unit, residentName: u.residentName, moveOutDate: u.leaseEnd }))
    .sort((a, b) => new Date(a.moveOutDate).getTime() - new Date(b.moveOutDate).getTime());

  // ─── Delinquency ─────────────────────────────────────────────────────────
  const delinquents = balances.filter((b) => b.endingDelinquent > 0);
  const totalDelinquent = delinquents.reduce((s, b) => s + b.endingDelinquent, 0);
  const delinquentCount = delinquents.length;
  const delinquencyPctGPR = gpr > 0 ? (totalDelinquent / gpr) * 100 : 0;
  const delinquencyScore = Math.max(0, 100 - delinquencyPctGPR * 10);

  // Aging buckets from resident data — use months-behind as proxy
  const delinquencyAging = AGING_BUCKETS.map((b) => {
    const bucketResidents = delinquents.filter((r) => {
      const monthsBehind = r.leaseCharges > 0 ? r.endingDelinquent / r.leaseCharges : 1;
      const daysEstimate = monthsBehind * 30;
      return daysEstimate >= b.min && daysEstimate <= b.max;
    });
    return {
      label: b.label,
      amount: bucketResidents.reduce((s, r) => s + r.endingDelinquent, 0),
      count: bucketResidents.length,
      color: b.color,
    };
  });

  const topDelinquents = [...delinquents]
    .sort((a, b) => b.endingDelinquent - a.endingDelinquent)
    .slice(0, 10)
    .map((r) => {
      const rentRollMatch = rentRoll.find((u) => u.unit === r.unit);
      const leaseEnd = rentRollMatch?.leaseEnd || r.moveOutOrLeaseEnd;
      const leaseEndDays = daysBetween(leaseEnd);
      return {
        unit: r.unit,
        name: r.residentName,
        amount: r.endingDelinquent,
        monthsBehind: r.leaseCharges > 0 ? r.endingDelinquent / r.leaseCharges : 0,
        leaseEndDays,
        leaseEndingSoon: leaseEndDays != null && leaseEndDays <= 30 && leaseEndDays >= 0,
      };
    });

  const evictionRiskCount = delinquents.filter((r) => {
    const rentRollMatch = rentRoll.find((u) => u.unit === r.unit);
    const leaseEnd = rentRollMatch?.leaseEnd || r.moveOutOrLeaseEnd;
    const days = daysBetween(leaseEnd);
    return days != null && days <= 60 && days >= 0;
  }).length;

  const topFiveSum = topDelinquents.slice(0, 5).reduce((s, r) => s + r.amount, 0);
  const concentrationPct = totalDelinquent > 0 ? (topFiveSum / totalDelinquent) * 100 : 0;

  const payingDownCount = balances.filter(
    (b) => b.endingDelinquent < b.beginningDelinquent && b.beginningDelinquent > 0
  ).length;

  // ─── Renovations ─────────────────────────────────────────────────────────
  // Rent-ready = vacant-leased + vacants with make-ready date in past
  const vacantTotalCount = vacCount + vacLeasedCount;
  const rentReadyCount =
    vacLeasedCount +
    availability.filter((u) => {
      if (u.section !== "VacantNotLeasedNotReady") return false;
      if (!u.makeReady) return false;
      const days = daysBetween(u.makeReady);
      return days != null && days <= 0;
    }).length;
  const rentReadyRatio = vacantTotalCount > 0 ? (rentReadyCount / vacantTotalCount) * 100 : 0;

  const validDaysVacant = availability.map((u) => u.daysVacant).filter((d): d is number => d != null);
  const avgDaysVacant =
    validDaysVacant.length > 0 ? validDaysVacant.reduce((s, d) => s + d, 0) / validDaysVacant.length : 0;
  const unknownDaysVacantCount = availability.filter((u) => u.daysVacant == null).length;
  // Monthly vacancy loss ≈ market rent of every currently-vacant unit.
  // (OneSite's estVacancyCost column is cumulative-to-date, not a monthly rate.)
  const estMonthlyVacancyLoss = rentRoll
    .filter((u) => u.status === "Vacant")
    .reduce((s, u) => s + u.marketRent, 0);

  const makeReadyClasses: MakeReadyClass[] = ["easy", "medium", "heavy", "unknown"];
  const makeReadyBreakdown = makeReadyClasses.map((cls) => ({
    cls,
    count: availability.filter(
      (u) => u.section === "VacantNotLeasedNotReady" && classifyMakeReady(u.comments) === cls
    ).length,
  }));

  const daysVacantBuckets = [
    { bucket: "0-30", min: 0, max: 30, color: "#10B981" },
    { bucket: "31-60", min: 31, max: 60, color: "#F59E0B" },
    { bucket: "61-90", min: 61, max: 90, color: "#F97316" },
    { bucket: "91-180", min: 91, max: 180, color: "#EF4444" },
    { bucket: "180+", min: 181, max: Infinity, color: "#991B1B" },
  ];
  const daysVacantDistribution = [
    ...daysVacantBuckets.map((b) => ({
      bucket: b.bucket,
      count: availability.filter((u) => u.daysVacant != null && u.daysVacant >= b.min && u.daysVacant <= b.max).length,
      color: b.color,
    })),
    { bucket: "Unknown", count: unknownDaysVacantCount, color: "#8B9299" },
  ];

  const sayanUnits = availability.filter((u) => /sayan/i.test(u.comments));
  const sayanUnitsTotal = sayanUnits.length;
  const sayanUnitsInProgress = sayanUnits.filter((u) => u.section === "VacantNotLeasedNotReady").length;

  const longestVacant = [...availability]
    .filter((u) => u.daysVacant != null)
    .sort((a, b) => (b.daysVacant ?? 0) - (a.daysVacant ?? 0))
    .slice(0, 3)
    .map((u) => ({
      unit: u.unit,
      days: u.daysVacant ?? 0,
      cost: (u.daysVacant ?? 0) * u.estVacancyCost,
    }));

  // ─── Floorplan breakdown ─────────────────────────────────────────────────
  const floorplans = Array.from(new Set(rentRoll.map((u) => u.floorplan).filter(Boolean)));
  const floorplanStats = floorplans.map((fp) => {
    const fpUnits = rentRoll.filter((u) => u.floorplan === fp);
    const fpOccupied = fpUnits.filter((u) => u.status === "Occupied" || u.status === "Occupied-NTV").length;
    const avgMarket = fpUnits.reduce((s, u) => s + u.marketRent, 0) / (fpUnits.length || 1);
    const occupiedForLease = fpUnits.filter((u) => u.status === "Occupied" || u.status === "Occupied-NTV");
    const avgLease =
      occupiedForLease.length > 0
        ? occupiedForLease.reduce((s, u) => s + u.leaseRent, 0) / occupiedForLease.length
        : 0;
    return {
      floorplan: fp,
      total: fpUnits.length,
      occupied: fpOccupied,
      occupiedPct: fpUnits.length > 0 ? (fpOccupied / fpUnits.length) * 100 : 0,
      avgMarketRent: avgMarket,
      avgLeaseRent: avgLease,
    };
  });

  // ─── Data hygiene ────────────────────────────────────────────────────────
  const dataHygieneWarnings: string[] = [];
  if (unitCount !== 288) {
    dataHygieneWarnings.push(`Rent roll shows ${unitCount} units; expected 288. Check export.`);
  }
  if (unknownDaysVacantCount > 0) {
    dataHygieneWarnings.push(
      `${unknownDaysVacantCount} vacant units have unknown days-vacant (marked "*"). Update move-out dates in OneSite.`
    );
  }
  const missingComments = availability.filter(
    (u) => u.section === "VacantNotLeasedNotReady" && classifyMakeReady(u.comments) === "unknown"
  ).length;
  if (missingComments > 0) {
    dataHygieneWarnings.push(
      `${missingComments} vacant units lack a make-ready classification in comments. PM input needed.`
    );
  }

  return {
    unitCount,
    occupiedCount: occCount,
    occupiedNTVCount: occNTVCount,
    vacantCount: vacCount,
    vacantLeasedCount: vacLeasedCount,
    physicalOccupancyPct,
    leasedOccupancyPct,
    projected60DayOccupancyPct,
    gpr,
    totalLeaseRent,
    economicOccupancyPct,
    lossToLeasePct,
    signedLeasesCount,
    signedLeasesMTD,
    moveOutsCount,
    netLeasingVelocity,
    netLeasingVelocityScore,
    pipeline90Day,
    expiring90DayCount,
    leaseExpirationByMonth,
    applicationFunnel,
    monthToMonthRisk,
    leaseStartsThisMonth,
    moveOutsThisMonth,
    totalDelinquent,
    delinquentCount,
    delinquencyPctGPR,
    delinquencyScore,
    delinquencyAging,
    topDelinquents,
    evictionRiskCount,
    concentrationPct,
    payingDownCount,
    rentReadyCount,
    vacantTotalCount,
    rentReadyRatio,
    avgDaysVacant,
    unknownDaysVacantCount,
    estMonthlyVacancyLoss,
    makeReadyBreakdown,
    daysVacantDistribution,
    sayanUnitsTotal,
    sayanUnitsInProgress,
    longestVacant,
    floorplanStats,
    dataHygieneWarnings,
    asOf: new Date().toISOString(),
  };
}

// ─── Empty state skeleton for first render (no files uploaded) ─────────────
export function emptyMetrics(): GroveMetrics {
  return {
    unitCount: 0,
    occupiedCount: 0,
    occupiedNTVCount: 0,
    vacantCount: 0,
    vacantLeasedCount: 0,
    physicalOccupancyPct: 0,
    leasedOccupancyPct: 0,
    projected60DayOccupancyPct: 0,
    gpr: 0,
    totalLeaseRent: 0,
    economicOccupancyPct: 0,
    lossToLeasePct: 0,
    signedLeasesCount: 0,
    signedLeasesMTD: 0,
    moveOutsCount: 0,
    netLeasingVelocity: 0,
    netLeasingVelocityScore: 0,
    pipeline90Day: 0,
    expiring90DayCount: 0,
    leaseExpirationByMonth: [],
    applicationFunnel: [],
    monthToMonthRisk: [],
    leaseStartsThisMonth: [],
    moveOutsThisMonth: [],
    totalDelinquent: 0,
    delinquentCount: 0,
    delinquencyPctGPR: 0,
    delinquencyScore: 100,
    delinquencyAging: [],
    topDelinquents: [],
    evictionRiskCount: 0,
    concentrationPct: 0,
    payingDownCount: 0,
    rentReadyCount: 0,
    vacantTotalCount: 0,
    rentReadyRatio: 0,
    avgDaysVacant: 0,
    unknownDaysVacantCount: 0,
    estMonthlyVacancyLoss: 0,
    makeReadyBreakdown: [],
    daysVacantDistribution: [],
    sayanUnitsTotal: 0,
    sayanUnitsInProgress: 0,
    longestVacant: [],
    floorplanStats: [],
    dataHygieneWarnings: [],
    asOf: new Date().toISOString(),
  };
}

// ─── Baseline delta helper ─────────────────────────────────────────────────
export function delta(current: number, baseline: number | null | undefined): number | null {
  if (baseline == null || baseline === 0) return null;
  return ((current - baseline) / baseline) * 100;
}
