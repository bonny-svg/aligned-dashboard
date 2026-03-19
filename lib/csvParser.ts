import type {
  Platform,
  ColumnMapping,
  RentRollRecord,
  DelinquencyRecord,
  FinancialLineItem,
  Property,
} from "./types";

// ─── Number helpers ───────────────────────────────────────────────────────────

/** Strip currency formatting and parse as float. Parentheses = negative (accounting format). */
export function parseNumber(raw: string | undefined): number {
  if (!raw) return 0;
  const trimmed = raw.trim();
  // Accounting negative: (1,234.56) or ($1,234.56)
  const isNeg = trimmed.startsWith("(") && trimmed.endsWith(")");
  const cleaned = trimmed.replace(/[$,\s()]/g, "");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return 0;
  return isNeg ? -Math.abs(n) : n;
}

// ─── Status mapping ───────────────────────────────────────────────────────────

const APPFOLIO_STATUS: Record<string, RentRollRecord["status"]> = {
  "current":           "Occupied",
  "notice-unrented":   "Notice",
  "notice-rented":     "Notice",
  "notice to vacate":  "Notice",
  "vacant-unrented":   "Vacant",
  "vacant-rented":     "Vacant",
  "vacant":            "Vacant",
  "eviction":          "Eviction",
  "model":             "Model",
  "admin":             "Model",
};

const REALPAGE_STATUS: Record<string, RentRollRecord["status"]> = {
  "occupied":          "Occupied",
  "occupied nr":       "Occupied",
  "notice":            "Notice",
  "ntv":               "Notice",
  "vacant":            "Vacant",
  "model":             "Model",
  "down":              "Model",
  "eviction":          "Eviction",
};

const RESMAN_STATUS: Record<string, RentRollRecord["status"]> = {
  "occupied":          "Occupied",
  "notice":            "Notice",
  "vacant":            "Vacant",
  "model":             "Model",
  "eviction":          "Eviction",
};

const STATUS_MAPS: Record<Platform, Record<string, RentRollRecord["status"]>> = {
  AppFolio: APPFOLIO_STATUS,
  RealPage:  REALPAGE_STATUS,
  Resman:    RESMAN_STATUS,
};

export function mapUnitStatus(
  raw: string,
  platform: Platform
): RentRollRecord["status"] {
  const key = raw.trim().toLowerCase();
  return STATUS_MAPS[platform][key] ?? "Occupied";
}

// ─── Aging bucket ─────────────────────────────────────────────────────────────

export function agingBucket(
  days: number
): DelinquencyRecord["agingBucket"] {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

// Internal alias used by parseDelinquencyCSV to avoid shadowing
const agingBucketFn = agingBucket;

// ─── Rent Roll parser ─────────────────────────────────────────────────────────

export interface ParsedRentRoll {
  rentRoll: RentRollRecord[];
  delinquency: DelinquencyRecord[];
}

export function parseRentRollCSV(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  propertyId: string,
  platform: Platform
): ParsedRentRoll {
  const rentRoll: RentRollRecord[] = [];
  const delinquency: DelinquencyRecord[] = [];

  for (const row of rows) {
    const unit       = (row[mapping.unit ?? ""] ?? "").trim();
    const tenant     = (row[mapping.tenantName ?? ""] ?? "").trim();
    const statusRaw  = (row[mapping.unitStatus ?? ""] ?? "").trim();
    const leaseStart = (row[mapping.leaseStart ?? ""] ?? "").trim();
    const leaseEnd   = (row[mapping.leaseEnd ?? ""] ?? "").trim();
    const marketRent = parseNumber(row[mapping.marketRent ?? ""]);
    const actualRent = parseNumber(row[mapping.actualRent ?? ""]);
    const pastDue    = parseNumber(row[mapping.balance ?? ""]);

    if (!unit) continue; // skip blank rows

    const status = statusRaw
      ? mapUnitStatus(statusRaw, platform)
      : tenant ? "Occupied" : "Vacant";

    rentRoll.push({
      propertyId,
      unit,
      tenant: tenant || "VACANT",
      leaseStart,
      leaseEnd,
      marketRent,
      actualRent,
      pastDue,
      status,
    });

    // Build delinquency record for any unit with a past-due balance
    if (pastDue > 0 && tenant) {
      delinquency.push({
        propertyId,
        tenantName: tenant,
        unit,
        balance: pastDue,
        daysDelinquent: 0, // not available from rent roll; upload delinquency report for aging
        agingBucket: "0-30",
        actionStatus: status === "Eviction" ? "Eviction Filed" : "None",
      });
    }
  }

  return { rentRoll, delinquency };
}

// ─── Delinquency parser ───────────────────────────────────────────────────────

export interface ParsedDelinquency {
  delinquency: DelinquencyRecord[];
}

/** "Smith, John" → "John Smith"; already-forward names pass through unchanged. */
function formatTenantName(raw: string): string {
  const m = raw.match(/^([^,]+),\s*(.+)$/);
  return m ? `${m[2].trim()} ${m[1].trim()}` : raw.trim();
}

export function parseDelinquencyCSV(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  propertyId: string,
  platform: Platform
): ParsedDelinquency {
  const delinquency: DelinquencyRecord[] = [];

  for (const row of rows) {
    const unit      = (row[mapping.unit ?? ""] ?? "").trim();
    const nameRaw   = (row[mapping.tenantName ?? ""] ?? "").trim();

    // Skip blank rows and AppFolio subtotal rows (name starts with "->")
    if (!unit && !nameRaw) continue;
    if (nameRaw.startsWith("->")) continue;
    if (!unit) continue;

    const tenantName  = platform === "AppFolio" ? formatTenantName(nameRaw) : nameRaw;
    const balance     = parseNumber(row[mapping.balance ?? ""]);
    if (balance <= 0) continue; // no delinquency

    const daysRaw     = parseNumber(row[mapping.daysDelinquent ?? ""]);
    const aging0_30   = parseNumber(row[mapping.aging0_30 ?? ""]);
    const aging30plus = parseNumber(row[mapping.aging30plus ?? ""]);
    const lateCount   = parseNumber(row[mapping.lateCount ?? ""]);
    const nsfCount    = parseNumber(row[mapping.nsfCount ?? ""]);
    const lastPayment = (row[mapping.lastPayment ?? ""] ?? "").trim() || undefined;
    const paymentAmount = parseNumber(row[mapping.paymentAmount ?? ""]);
    const notes       = (row[mapping.notes ?? ""] ?? "").trim() || undefined;

    // Determine aging bucket
    let agingBucket: DelinquencyRecord["agingBucket"] = "0-30";
    if (daysRaw > 0) {
      agingBucket = agingBucketFn(daysRaw);
    } else if (aging30plus > 0) {
      agingBucket = "31-60";
    }

    delinquency.push({
      propertyId,
      tenantName,
      unit,
      balance,
      daysDelinquent: daysRaw,
      agingBucket,
      actionStatus: "None",
      aging0_30: aging0_30 || undefined,
      aging30plus: aging30plus || undefined,
      lastPayment,
      paymentAmount: paymentAmount || undefined,
      lateCount: lateCount || undefined,
      nsfCount: nsfCount || undefined,
      notes,
    });
  }

  return { delinquency };
}

// ─── Income Statement parser ──────────────────────────────────────────────────

export interface ParsedIncomeStatement {
  financials: FinancialLineItem[];
}

const MONTH_RE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i;
const MONTH_NAMES = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

function toYearMonth(col: string): string {
  const parts = col.trim().split(/\s+/);
  const mon = parts[0].toLowerCase();
  const yr  = parts[1] ?? "";
  const m   = MONTH_NAMES.indexOf(mon) + 1;
  return `${yr}-${String(m).padStart(2, "0")}`;
}

function categoryFromAccount(acct: string): string | null {
  const digits = acct.replace(/\D/g, "");
  if (digits.startsWith("4"))    return "Income";
  if (digits.startsWith("5"))    return "Expenses";
  if (digits.startsWith("6"))    return "Debt Service";
  if (digits.startsWith("1100")) return "CapEx";
  if (digits.startsWith("1200")) return "Professional Fees";
  return null; // balance sheet / unrecognized — skip
}

export function parseIncomeStatementCSV(
  rows: Record<string, string>[],
  propertyId: string
): ParsedIncomeStatement {
  if (rows.length === 0) return { financials: [] };

  const headers = Object.keys(rows[0]);

  // Detect month columns
  const monthCols = headers.filter((h) => MONTH_RE.test(h.trim()));
  if (monthCols.length === 0) return { financials: [] };

  // Detect account number and name columns
  const accountNumCol =
    headers.find((h) => /account\s*(number|#|num)/i.test(h) || /acct\s*(#|num)/i.test(h)) ??
    headers[0];
  const accountNameCol =
    headers.find((h) => /account\s*name/i.test(h) || /^description$/i.test(h)) ??
    headers.find((h) => h !== accountNumCol && !MONTH_RE.test(h)) ??
    headers[1];

  const financials: FinancialLineItem[] = [];
  const incomeByMonth:  Record<string, number> = {};
  const expensesByMonth: Record<string, number> = {};
  const debtByMonth:    Record<string, number> = {};

  for (const row of rows) {
    const acct = (row[accountNumCol] ?? "").trim();
    if (!acct) continue; // section header row

    // Skip summary/total rows (name contains "total" and no real account number digit prefix)
    const name = (row[accountNameCol ?? ""] ?? "").trim() || acct;
    if (!acct.match(/\d/) ) continue;

    const category = categoryFromAccount(acct);
    if (!category) continue;

    for (const col of monthCols) {
      const val = parseNumber(row[col]);
      if (val === 0) continue; // zero = future month or no activity

      const month = toYearMonth(col);

      financials.push({
        propertyId,
        month,
        category,
        lineItem: name,
        accountNumber: acct,
        underwriting: 0,
        budget: 0,
        actual: val,
        isNOI: false,
      });

      if (category === "Income") {
        incomeByMonth[month] = (incomeByMonth[month] ?? 0) + val;
      } else if (category === "Expenses") {
        expensesByMonth[month] = (expensesByMonth[month] ?? 0) + val;
      } else if (category === "Debt Service") {
        debtByMonth[month] = (debtByMonth[month] ?? 0) + val;
      }
    }
  }

  // Emit NOI per month
  const allMonths = Array.from(new Set([...Object.keys(incomeByMonth), ...Object.keys(expensesByMonth)]));
  for (const month of allMonths) {
    const noi = (incomeByMonth[month] ?? 0) - (expensesByMonth[month] ?? 0);
    financials.push({
      propertyId,
      month,
      category: "NOI",
      lineItem: "Net Operating Income",
      underwriting: 0,
      budget: 0,
      actual: noi,
      isNOI: true,
    });
  }

  return { financials };
}

// ─── Resman Rent Roll parser ──────────────────────────────────────────────────

function resmanStatusCode(raw: string): RentRollRecord["status"] {
  switch (raw.trim().toUpperCase()) {
    case "C":  return "Occupied";
    case "P":  return "Notice";
    case "PR": return "Vacant";
    default:   return mapUnitStatus(raw, "Resman");
  }
}

/**
 * Resman rent roll — fixed column positions via synthetic headers.
 * Each unit spans multiple charge rows; we group by unit and extract
 * the row where Description = "Rent" for actual rent.
 */
export function parseResmanRentRollCSV(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  propertyId: string
): ParsedRentRoll {
  const rentRoll: RentRollRecord[] = [];
  const delinquency: DelinquencyRecord[] = [];

  // Column name resolution (mapping overrides, fall back to synthetic header names)
  const unitCol    = mapping.unit       ?? "Unit";
  const nameCol    = mapping.tenantName ?? "Resident";
  const statusCol  = mapping.unitStatus ?? "Status";
  const mktCol     = mapping.marketRent ?? "Market Rent";
  const lsCol      = mapping.leaseStart ?? "Lease Start";
  const leCol      = mapping.leaseEnd   ?? "Lease End";
  const balCol     = mapping.balance    ?? "Balance";

  // Group rows by unit — Resman sometimes omits unit on continuation rows
  const unitGroups = new Map<string, Record<string, string>[]>();
  let currentUnit = "";

  for (const row of rows) {
    const rawUnit = (row[unitCol] ?? "").trim();
    if (rawUnit && !/^total/i.test(rawUnit)) currentUnit = rawUnit;
    if (!currentUnit || /^total/i.test(currentUnit)) continue;

    if (!unitGroups.has(currentUnit)) unitGroups.set(currentUnit, []);
    unitGroups.get(currentUnit)!.push(row);
  }

  for (const [unit, unitRows] of Array.from(unitGroups)) {
    const first = unitRows[0];

    const tenant     = (first[nameCol]   ?? "").trim() || "VACANT";
    const statusRaw  = (first[statusCol] ?? "").trim();
    const marketRent = parseNumber(first[mktCol]);
    const leaseStart = (first[lsCol]     ?? "").trim();
    const leaseEnd   = (first[leCol]     ?? "").trim();

    // Actual rent = amount from the "Rent" charge row
    const rentRow  = unitRows.find((r) =>
      (r["Description"] ?? "").trim().toLowerCase() === "rent"
    );
    const actualRent = rentRow ? parseNumber(rentRow["Amount"]) : 0;

    // Balance from first row that has a non-zero value
    const balRow = unitRows.find((r) => (r[balCol] ?? "").trim() !== "");
    const pastDue = parseNumber(balRow?.[balCol]);

    const status = resmanStatusCode(statusRaw);

    rentRoll.push({
      propertyId, unit, tenant, leaseStart, leaseEnd,
      marketRent, actualRent, pastDue: Math.max(0, pastDue), status,
    });

    if (pastDue > 0 && tenant !== "VACANT") {
      delinquency.push({
        propertyId, tenantName: tenant, unit,
        balance: pastDue, daysDelinquent: 0, agingBucket: "0-30",
        actionStatus: status === "Eviction" ? "Eviction Filed" : "None",
      });
    }
  }

  return { rentRoll, delinquency };
}

// ─── Resman Delinquency parser ────────────────────────────────────────────────

/**
 * Resman delinquency report.
 * Tracks HAP vs. Lease sections for subsidy tagging.
 * Section header rows (e.g. "3 HAP Account(s)") are detected and skipped.
 */
export function parseResmanDelinquencyCSV(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  propertyId: string
): ParsedDelinquency {
  const delinquency: DelinquencyRecord[] = [];

  const unitCol  = mapping.unit       ?? "Unit";
  const nameCol  = mapping.tenantName ?? "Residents";
  const balCol   = mapping.balance    ?? "Total";
  const lateCol  = mapping.lateCount  ?? "Times Late";
  const notesCol = mapping.notes      ?? "Notes";

  let isHAP = false;

  for (const row of rows) {
    const unit    = (row[unitCol]  ?? "").trim();
    const nameRaw = (row[nameCol]  ?? "").trim();
    const rowText = Object.values(row).join(" ");

    // Detect section header rows (no unit, contains section label)
    if (!unit) {
      if (/HAP\s+Account/i.test(rowText))                  isHAP = true;
      else if (/Lease\(s\)/i.test(rowText))                isHAP = false;
      else if (/\d+\s+Account\(s\)/i.test(rowText) &&
               !/HAP/i.test(rowText))                      isHAP = false;
      continue;
    }

    // Skip subtotal rows
    if (/^total/i.test(unit)) continue;

    const balance = parseNumber(row[balCol]);
    if (balance <= 0) continue;

    const lateCount = Math.round(parseNumber(row[lateCol]));
    const notes     = (row[notesCol] ?? "").trim() || undefined;

    delinquency.push({
      propertyId,
      tenantName: formatTenantName(nameRaw),
      unit,
      balance,
      daysDelinquent: 0,
      agingBucket: "0-30",
      actionStatus: "None",
      lateCount: lateCount || undefined,
      notes,
      isSubsidy: isHAP || undefined,
    });
  }

  return { delinquency };
}

// ─── Resman Trailing P&L parser ───────────────────────────────────────────────

const RESMAN_MONTH_RE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+Actual$/i;

function resmanCategoryFromAccount(acct: string): string | null {
  // acct e.g. "5005 Gross Potential Rent" — extract leading digits
  const digits = acct.replace(/\D/g, "");
  if (digits.startsWith("5"))                       return "Income";
  if (digits.startsWith("6") || digits.startsWith("7")) return "Expenses";
  if (digits.startsWith("8"))                       return "CapEx";
  return null;
}

/**
 * Resman trailing 12-month P&L.
 * Reads NOI and Net Income directly from labeled rows rather than computing.
 * Month columns are "Apr 2025 Actual" format; variance is stored on each item.
 */
export function parseResmanPL(
  rows: Record<string, string>[],
  propertyId: string
): ParsedIncomeStatement {
  if (rows.length === 0) return { financials: [] };

  const headers = Object.keys(rows[0]);

  const monthCols = headers.filter((h) => RESMAN_MONTH_RE.test(h.trim()));
  if (monthCols.length === 0) return { financials: [] };

  const accountCol = headers[0]; // "Account" is always first
  const varCol     = headers.find((h) => /^variance$/i.test(h.trim()));

  const financials: FinancialLineItem[] = [];

  for (const row of rows) {
    const rawAcct = (row[accountCol] ?? "").trim();
    if (!rawAcct) continue;

    // Strip leading commas (Resman hierarchy depth markers)
    const acct = rawAcct.replace(/^,+/, "").trim();
    if (!acct) continue;

    // ── Labeled summary rows ────────────────────────────────────────
    if (/NET OPERATING INCOME/i.test(acct)) {
      for (const col of monthCols) {
        const val = parseNumber(row[col]);
        if (val === 0) continue;
        financials.push({
          propertyId, month: toYearMonth(col),
          category: "NOI", lineItem: "Net Operating Income",
          underwriting: 0, budget: 0, actual: val, isNOI: true,
        });
      }
      continue;
    }

    if (/^NET INCOME/i.test(acct)) {
      for (const col of monthCols) {
        const val = parseNumber(row[col]);
        if (val === 0) continue;
        financials.push({
          propertyId, month: toYearMonth(col),
          category: "Net Income", lineItem: "Net Income",
          underwriting: 0, budget: 0, actual: val, isNetCashFlow: true,
        });
      }
      continue;
    }

    // Skip Total/section-header rows
    if (/^(TOTAL|Total)\s/i.test(acct) || /^NON-OPERATING/i.test(acct)) continue;

    // ── Regular line items ──────────────────────────────────────────
    const firstWord = acct.split(/\s+/)[0];
    const category  = resmanCategoryFromAccount(firstWord);
    if (!category) continue;

    const variance = varCol ? parseNumber(row[varCol]) || undefined : undefined;

    for (const col of monthCols) {
      const val = parseNumber(row[col]);
      if (val === 0) continue;
      financials.push({
        propertyId, month: toYearMonth(col),
        category, lineItem: acct,
        accountNumber: firstWord,
        underwriting: 0, budget: 0, actual: val,
        variance,
      });
    }
  }

  return { financials };
}

// ─── Property stats recalculation ─────────────────────────────────────────────

/**
 * Recompute occupancyPct, collectedMTD, and delinquencyPct for a property
 * from its updated rent roll and delinquency records.
 */
export function recalcPropertyStats(
  property: Property,
  rentRoll: RentRollRecord[],
  delinquency: DelinquencyRecord[]
): Pick<Property, "occupancyPct" | "collectedMTD" | "delinquencyPct"> {
  const total = rentRoll.length;
  if (total === 0) {
    return { occupancyPct: 0, collectedMTD: 0, delinquencyPct: 0 };
  }

  const occupiedCount = rentRoll.filter(
    (r) => r.status === "Occupied" || r.status === "Notice" || r.status === "Eviction"
  ).length;

  const collectedMTD = rentRoll
    .filter((r) => r.status === "Occupied")
    .reduce((s, r) => s + r.actualRent, 0);

  const totalPastDue = delinquency.reduce((s, d) => s + d.balance, 0);
  const delinquencyPct = collectedMTD > 0
    ? (totalPastDue / collectedMTD) * 100
    : 0;

  return {
    occupancyPct: (occupiedCount / total) * 100,
    collectedMTD: Math.round(collectedMTD),
    delinquencyPct: Math.round(delinquencyPct * 10) / 10,
  };
}
