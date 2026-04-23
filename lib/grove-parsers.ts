// ─── /lib/grove-parsers.ts ─────────────────────────────────────────────────
// Parsers for the three OneSite exports that feed the Grove dashboard.
// Column positions are header-driven so both legacy wide layouts and current
// compact layouts parse cleanly.

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
  moveInOut: string;
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
  daysVacant: number | null;
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

/** Find the first row that contains all of the `musts` strings (case-insensitive,
 *  whitespace-collapsed) somewhere in its cells. Returns both the row index and a
 *  map from normalized cell text → column index, so callers can look up columns
 *  without hard-coded offsets. */
function findHeaderRow(
  rows: unknown[][],
  musts: string[]
): { index: number; map: Map<string, number> } | null {
  const want = musts.map((s) => s.toLowerCase().replace(/\s+/g, " ").trim());
  for (let i = 0; i < rows.length; i++) {
    const cells = (rows[i] || []).map((c) =>
      toStr(c).toLowerCase().replace(/\s+/g, " ").trim()
    );
    const hasAll = want.every((w) =>
      cells.some((cell) => cell === w || cell.startsWith(w))
    );
    if (hasAll) {
      const map = new Map<string, number>();
      cells.forEach((c, idx) => {
        if (c && !map.has(c)) map.set(c, idx);
      });
      return { index: i, map };
    }
  }
  return null;
}

/** Look up the column index for any of the given header synonyms. */
function col(map: Map<string, number>, ...synonyms: string[]): number {
  const entries = Array.from(map.entries());
  for (const s of synonyms) {
    const key = s.toLowerCase().replace(/\s+/g, " ").trim();
    const hit = map.get(key);
    if (hit != null) return hit;
    // Also try prefix match (Excel headers sometimes have trailing annotations)
    for (const [k, v] of entries) {
      if (k.startsWith(key)) return v;
    }
  }
  return -1;
}

// ─── Rent Roll Detail ──────────────────────────────────────────────────────
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
  // OneSite rent roll header row contains "Unit" + "Unit/Lease Status".
  const hdr = findHeaderRow(rows, ["unit", "unit/lease status"])
           || findHeaderRow(rows, ["unit", "status"]);
  if (!hdr) return [];

  const cUnit     = col(hdr.map, "unit");
  const cFloor    = col(hdr.map, "floorplan", "floor plan");
  const cSqft     = col(hdr.map, "sqft", "sq ft", "square feet");
  const cStatus   = col(hdr.map, "unit/lease status", "status");
  const cName     = col(hdr.map, "name", "resident name", "tenant");
  const cMoveIn   = col(hdr.map, "move-in", "move in");
  const cLStart   = col(hdr.map, "lease start", "lease from");
  const cLEnd     = col(hdr.map, "lease end", "lease to");
  const cMarket   = col(hdr.map, "market + addl.", "market + addl", "market rent", "market");
  const cLRent    = col(hdr.map, "lease rent", "rent amount", "rent");
  const cTotalBill= col(hdr.map, "total billing", "total");
  const cBalance  = col(hdr.map, "balance", "past due");

  const units: RentRollUnit[] = [];

  for (let r = hdr.index + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const unit = toStr(row[cUnit]);
    const statusRaw = toStr(row[cStatus]);

    if (!unit || /^totals?:?$/i.test(unit)) continue;
    // Skip any row where the unit field is a sub-journal marker rather than a unit number
    if (/^(resident|hvouch|housing|reserve)$/i.test(unit)) continue;

    const status = normalizeStatus(statusRaw);
    if (!VALID_STATUSES.has(status)) continue;

    units.push({
      unit,
      floorplan: cFloor     >= 0 ? toStr(row[cFloor])     : "",
      sqft:      cSqft      >= 0 ? toNum(row[cSqft])      : 0,
      status,
      residentName: cName   >= 0 ? toStr(row[cName])      : "",
      moveInOut:  cMoveIn   >= 0 ? toStr(row[cMoveIn])    : "",
      leaseStart: cLStart   >= 0 ? toStr(row[cLStart])    : "",
      leaseEnd:   cLEnd     >= 0 ? toStr(row[cLEnd])      : "",
      marketRent: cMarket   >= 0 ? toNum(row[cMarket])    : 0,
      leaseRent:  cLRent    >= 0 ? toNum(row[cLRent])     : 0,
      totalBilling: cTotalBill >= 0 ? toNum(row[cTotalBill]) : 0,
      balance:    cBalance  >= 0 ? toNum(row[cBalance])   : 0,
    });
  }

  return units;
}

// ─── Availability ──────────────────────────────────────────────────────────
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
  // The header row on availability reports has Bldg/Unit, Floor Plan, SQFT, etc.
  // Headers often include newlines ("Bldg/\nUnit" → normalized "bldg/ unit").
  const hdr = findHeaderRow(rows, ["sqft"]) ||
              findHeaderRow(rows, ["market + addl.", "sqft"]);

  // Column lookups (with fallbacks for when the header has line breaks)
  const cUnit   = hdr ? col(hdr.map, "bldg/ unit", "bldg/unit", "unit")          : 2;
  const cFloor  = hdr ? col(hdr.map, "floor plan", "floor/ plan", "floorplan")   : 8;
  const cSqft   = hdr ? col(hdr.map, "sqft")                                     : 12;
  const cMarket = hdr ? col(hdr.map, "market + addl.", "market + addl", "market rent") : 13;
  const cLast   = hdr ? col(hdr.map, "curr/last lease rent", "curr/last", "last lease rent") : 16;
  const cMOut   = hdr ? col(hdr.map, "move- out", "move-out", "move out")        : 19;
  const cDays   = hdr ? col(hdr.map, "days vacant")                              : 21;
  const cEstCost= hdr ? col(hdr.map, "estimated vacancy cost", "estimated vacancy", "estimated") : 23;
  const cMR     = hdr ? col(hdr.map, "make ready", "make/ ready")                : 24;
  const cSchedIn= hdr ? col(hdr.map, "scheduled move-in", "scheduled/ move-in")  : 32;
  const cLSign  = hdr ? col(hdr.map, "lease signed", "lease/ signed")            : 41;
  const cAppNm  = hdr ? col(hdr.map, "name", "applicant name")                   : 44;
  const cCmts   = hdr ? col(hdr.map, "comments")                                 : 49;

  const units: AvailabilityUnit[] = [];
  let currentSection: AvailabilityUnit["section"] | null = null;

  // Availability has section markers ("Vacant Not Leased Not Ready (N)") in c0.
  // We scan every row; headers are identified by position, not by leading col.
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const c0 = toStr(row[0]);

    if (/breaks?\s*-\s*excerpted/i.test(c0)) break;

    const match = SECTION_HEADERS.find((s) => s.match.test(c0));
    if (match) { currentSection = match.section; continue; }
    if (!currentSection) continue;

    const unit = toStr(row[cUnit >= 0 ? cUnit : 2]);
    if (!unit) continue;
    if (/no\s+amenities/i.test(unit) || /^(unit|bldg)/i.test(unit)) continue;

    const daysVacantRaw = toStr(row[cDays >= 0 ? cDays : 21]);
    const daysVacant = daysVacantRaw === "*" || daysVacantRaw === "" ? null : toNum(row[cDays >= 0 ? cDays : 21]);

    units.push({
      section: currentSection,
      unit,
      floorplan: cFloor >= 0 ? toStr(row[cFloor]) : "",
      sqft:      cSqft  >= 0 ? toNum(row[cSqft])  : 0,
      marketRent: cMarket >= 0 ? toNum(row[cMarket]) : 0,
      currLastLeaseRent: cLast >= 0 ? toNum(row[cLast]) : 0,
      moveOut:   cMOut  >= 0 ? toStr(row[cMOut])  : "",
      daysVacant,
      daysVacantRaw,
      estVacancyCost: cEstCost >= 0 ? toNum(row[cEstCost]) : 0,
      makeReady: cMR    >= 0 ? toStr(row[cMR])    : "",
      scheduledMoveIn: cSchedIn >= 0 ? toStr(row[cSchedIn]) : "",
      leaseSigned: cLSign >= 0 ? toStr(row[cLSign]) : "",
      applicantName: cAppNm >= 0 ? toStr(row[cAppNm]) : "",
      comments: cCmts >= 0 ? toStr(row[cCmts]) : "",
    });
  }

  return units;
}

// ─── Resident Balances by Fiscal Period ────────────────────────────────────
// The newer compact export is one row per resident with all balance columns on
// the same row, rather than a block-per-unit layout with a "Sub Totals" row.
// We detect by finding the header row, then iterate.
export function parseResidentBalances(buffer: ArrayBuffer): ResidentBalance[] {
  const rows = loadFirstSheet(buffer);

  const hdr = findHeaderRow(rows, ["bldg/unit", "resident name"]) ||
              findHeaderRow(rows, ["unit", "resident name"]);
  if (!hdr) return [];

  const cUnit   = col(hdr.map, "bldg/unit", "unit");
  const cName   = col(hdr.map, "resident name", "name");
  const cStatus = col(hdr.map, "status");
  const cBegDeq = col(hdr.map, "beginning delinquent balance", "beginning delinquent");
  const cCharges= col(hdr.map, "total lease charges", "lease charges");
  const cCredits= col(hdr.map, "total credits", "credits");
  const cEndDeq = col(hdr.map, "ending delinquent balance", "ending delinquent");
  const cEndBal = col(hdr.map, "ending balance");
  const cDepFwd = col(hdr.map, "deposits balance forward", "deposits");
  const cDepEnd = col(hdr.map, "ending deposit balance", "ending deposit");
  const cMoveOut= col(hdr.map, "move-out", "move out", "lease end");

  const results: ResidentBalance[] = [];

  for (let r = hdr.index + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const unit = toStr(row[cUnit]);
    const name = cName >= 0 ? toStr(row[cName]) : "";

    if (!unit || /^totals?:?$/i.test(unit)) continue;
    // Skip rows that are sub-journal markers rather than units
    if (!/^\d{3,5}$/.test(unit.replace(/\s+/g, ""))) continue;
    // Skip rows with no resident name (shouldn't happen in compact format)
    if (!name) continue;

    results.push({
      unit,
      residentName: name,
      status: cStatus >= 0 ? toStr(row[cStatus]) : "",
      moveOutOrLeaseEnd: cMoveOut >= 0 ? toStr(row[cMoveOut]) : "",
      beginningDelinquent: cBegDeq >= 0 ? toNum(row[cBegDeq]) : 0,
      leaseCharges:        cCharges >= 0 ? toNum(row[cCharges]) : 0,
      totalCredits:        cCredits >= 0 ? toNum(row[cCredits]) : 0,
      endingDelinquent:    cEndDeq >= 0 ? toNum(row[cEndDeq]) : 0,
      endingBalance:       cEndBal >= 0 ? toNum(row[cEndBal]) : 0,
      depositsBalanceForward: cDepFwd >= 0 ? toNum(row[cDepFwd]) : 0,
      endingDepositBalance:   cDepEnd >= 0 ? toNum(row[cDepEnd]) : 0,
    });
  }

  return results;
}

// ─── File type detection by filename ───────────────────────────────────────
export type GroveFileType = "rentRoll" | "availability" | "residentBalances" | "unknown";

export function detectFileType(filename: string): GroveFileType {
  const f = filename.toLowerCase();
  if (/resident[\s_+-]?balance/i.test(filename) || /balances?/i.test(f)) return "residentBalances";
  if (/avail/i.test(f)) return "availability";
  if (/rent[\s_+-]?roll/i.test(f)) return "rentRoll";
  return "unknown";
}
