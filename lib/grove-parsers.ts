// ─── /lib/grove-parsers.ts ─────────────────────────────────────────────────
// Parsers for the three RealPage OneSite .xls exports.
// All three are OLE2/CDFV2 — xlsx library handles them via { type: "buffer" }.

import * as XLSX from "xlsx";

// ─── Types ─────────────────────────────────────────────────────────────────
export type RentRollStatus =
  | "Occupied"
  | "Vacant"
  | "Occupied-NTV"
  | "Vacant-Leased"
  | "Unknown";

export interface RentRollUnit {
  unit: string;
  floorplan: string;
  sqft: number;
  status: RentRollStatus;
  residentName: string;
  moveInOut: string; // ISO date or empty
  leaseStart: string;
  leaseEnd: string;
  marketRent: number;
  leaseRent: number;
  totalBilling: number;
  balance: number;
}

export interface AvailabilityUnit {
  section: "VacantNotLeasedNotReady" | "NTVNotLeased" | "VacantLeasedNotReady";
  unit: string;
  floorplan: string;
  sqft: number;
  marketRent: number;
  currLastLeaseRent: number;
  moveOut: string;
  daysVacant: number | null; // null when raw cell was "*"
  daysVacantRaw: string;
  estVacancyCost: number;
  makeReady: string;
  scheduledMoveIn: string;
  leaseSigned: string;
  applicantName: string;
  comments: string;
}

export interface ResidentBalance {
  unit: string;
  residentName: string;
  status: string;
  moveOutOrLeaseEnd: string;
  beginningDelinquent: number;
  leaseCharges: number;
  totalCredits: number;
  endingDelinquent: number;
  endingBalance: number;
  depositsBalanceForward: number;
  endingDepositBalance: number;
}

// ─── Utilities ─────────────────────────────────────────────────────────────
function toNum(v: unknown): number {
  if (v == null || v === "" || v === "*") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[,$()\s]/g, "");
  if (!s) return 0;
  const neg = String(v).includes("(");
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return neg ? -n : n;
}

function toStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function loadFirstSheet(buffer: ArrayBuffer): unknown[][] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: false });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    raw: true,
    defval: "",
  });
}

// ─── Rent Roll Detail ──────────────────────────────────────────────────────
// Multi-row per unit. Unit header row has c0=Unit, c17=Status. Sub-journal
// rows (RESIDENT/HVOUCH/HOUSING) follow and are ignored for headline metrics.
const VALID_STATUSES = new Set<RentRollStatus>([
  "Occupied",
  "Vacant",
  "Occupied-NTV",
  "Vacant-Leased",
]);

function normalizeStatus(raw: string): RentRollStatus {
  const s = raw.replace(/\s+/g, "").toLowerCase();
  if (s === "occupied") return "Occupied";
  if (s === "vacant") return "Vacant";
  if (s === "occupied-ntv" || s === "occupiedntv") return "Occupied-NTV";
  if (s === "vacant-leased" || s === "vacantleased") return "Vacant-Leased";
  return "Unknown";
}

export function parseRentRoll(buffer: ArrayBuffer): RentRollUnit[] {
  const rows = loadFirstSheet(buffer);
  const units: RentRollUnit[] = [];

  for (const raw of rows) {
    const row = raw as unknown[];
    const unit = toStr(row[0]);
    const status = toStr(row[17]);

    // Skip blank, totals, and header rows
    if (!unit || unit === "Totals:" || status === "Unit/Lease Status") continue;

    const norm = normalizeStatus(status);
    if (!VALID_STATUSES.has(norm)) continue; // skip sub-journal rows

    units.push({
      unit,
      floorplan: toStr(row[2]),
      sqft: toNum(row[13]),
      status: norm,
      residentName: toStr(row[19]),
      moveInOut: toStr(row[23]),
      leaseStart: toStr(row[27]),
      leaseEnd: toStr(row[29]),
      marketRent: toNum(row[32]),
      leaseRent: toNum(row[42]),
      totalBilling: toNum(row[50]),
      balance: toNum(row[55]),
    });
  }

  return units;
}

// ─── Availability ──────────────────────────────────────────────────────────
// Section-based. Headers in c0 like "Vacant Not Leased Not Ready (N)".
// Data rows: c2=Unit, etc. "BREAK" in c0 is still a valid data row.
// "no amenities" filler rows — skip.
const SECTION_HEADERS: {
  match: RegExp;
  section: AvailabilityUnit["section"];
}[] = [
  { match: /vacant\s+not\s+leased\s+not\s+ready/i, section: "VacantNotLeasedNotReady" },
  { match: /ntv\s+not\s+leased/i, section: "NTVNotLeased" },
  { match: /vacant\s+leased\s+not\s+ready/i, section: "VacantLeasedNotReady" },
];

export function parseAvailability(buffer: ArrayBuffer): AvailabilityUnit[] {
  const rows = loadFirstSheet(buffer);
  const units: AvailabilityUnit[] = [];
  let currentSection: AvailabilityUnit["section"] | null = null;

  for (const raw of rows) {
    const row = raw as unknown[];
    const c0 = toStr(row[0]);
    const c2 = toStr(row[2]);

    // Stop at the BREAKS excerpt section — those units are already counted in the
    // main detail section above (they carry "BREAK" in c0 within the main section).
    if (/breaks?\s*-\s*excerpted/i.test(c0)) break;

    // Section header detection
    const match = SECTION_HEADERS.find((s) => s.match.test(c0));
    if (match) {
      currentSection = match.section;
      continue;
    }

    if (!currentSection) continue;
    // BREAK rows still carry unit data from c2 onward
    // Skip "no amenities" fillers
    if (!c2 || /no\s+amenities/i.test(c0) || /no\s+amenities/i.test(c2)) continue;
    // Skip header-ish rows
    if (/^unit\b/i.test(c2)) continue;

    const daysVacantRaw = toStr(row[21]);
    const daysVacant = daysVacantRaw === "*" || daysVacantRaw === "" ? null : toNum(row[21]);

    units.push({
      section: currentSection,
      unit: c2,
      floorplan: toStr(row[8]),
      sqft: toNum(row[12]),
      marketRent: toNum(row[13]),
      currLastLeaseRent: toNum(row[16]),
      moveOut: toStr(row[19]),
      daysVacant,
      daysVacantRaw,
      estVacancyCost: toNum(row[23]),
      makeReady: toStr(row[24]),
      scheduledMoveIn: toStr(row[32]),
      leaseSigned: toStr(row[41]),
      applicantName: toStr(row[45]),
      comments: toStr(row[49]),
    });
  }

  return units;
}

// ─── Resident Balances by Fiscal Period ────────────────────────────────────
// Block-per-unit.
// Unit header:   c1=Unit (3-4 digit), c3=ResidentName, c8=Status, c44=MoveOut/LeaseEnd
// Sub-journal:   c3="       RESIDENT" / "       HVOUCH" / "       HOUSING" (indented)
// Sub Totals:    c8="Sub Totals:" with aggregate values across sub-journals
//                c17=BeginningDelinquent  c24=LeaseCharges   c28=TotalCredits
//                c32=EndingDelinquent     c36=EndingBalance  c39=DepositsBalanceForward
//                c41=EndingDepositBalance
export function parseResidentBalances(buffer: ArrayBuffer): ResidentBalance[] {
  const rows = loadFirstSheet(buffer);
  const results: ResidentBalance[] = [];

  let current: Partial<ResidentBalance> | null = null;

  for (const raw of rows) {
    const row = raw as unknown[];
    const c1 = toStr(row[1]);
    const c3 = toStr(row[3]);
    const c8 = toStr(row[8]);

    // Sub Totals row (c8 === "Sub Totals:") closes the current unit block.
    if (/^sub\s+totals?:/i.test(c8)) {
      if (current && current.unit) {
        results.push({
          unit: current.unit,
          residentName: current.residentName ?? "",
          status: current.status ?? "",
          moveOutOrLeaseEnd: current.moveOutOrLeaseEnd ?? "",
          beginningDelinquent: toNum(row[17]),
          leaseCharges: toNum(row[24]),
          totalCredits: toNum(row[28]),
          endingDelinquent: toNum(row[32]),
          endingBalance: toNum(row[36]),
          depositsBalanceForward: toNum(row[39]),
          endingDepositBalance: toNum(row[41]),
        });
      }
      current = null;
      continue;
    }

    // Unit header: c1 is a 3-4 digit unit number and c3 is a resident name.
    // Sub-journal rows have a whitespace-indented marker in c3 — reject those.
    const isSubJournalMarker = /^(resident|hvouch|housing|reserve)\s*$/i.test(c3.trim());
    if (isSubJournalMarker) continue;

    if (/^\d{3,4}$/.test(c1) && c3) {
      current = {
        unit: c1,
        residentName: c3,
        status: c8,
        moveOutOrLeaseEnd: toStr(row[44]),
      };
    }
  }

  return results;
}

// ─── File type detection by filename ───────────────────────────────────────
export type GroveFileType = "rentRoll" | "availability" | "residentBalances" | "unknown";

export function detectFileType(filename: string): GroveFileType {
  const f = filename.toLowerCase();
  if (/resident[\s_-]?balance/i.test(filename) || /balances?/i.test(f)) return "residentBalances";
  if (/avail/i.test(f)) return "availability";
  if (/rent[\s_-]?roll/i.test(f)) return "rentRoll";
  return "unknown";
}
