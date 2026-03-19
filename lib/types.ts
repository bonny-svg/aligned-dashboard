export type PropertyStatus =
  | "Active"
  | "Under Contract"
  | "Remediation"
  | "Stabilizing";

export type Platform = "AppFolio" | "RealPage" | "Resman";

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  units: number;
  occupancyPct: number;
  collectedMTD: number;
  delinquencyPct: number;
  status: PropertyStatus;
  platform: Platform;
  platformAccount: string; // e.g. "G&C", "B", "TX-East"
  lastImport?: string;
  noiBudget?: number;          // monthly NOI budget for KPI comparison
  occupancyBudget?: number;    // occupancy % budget target
  delinquencyBudget?: number;  // delinquency % of GPR budget target
}

// ─── Column mapping (CSV import) ─────────────────────────────────────────────

export type StandardField =
  | "tenantName"
  | "unit"
  | "balance"
  | "daysDelinquent"
  | "leaseStart"
  | "leaseEnd"
  | "marketRent"
  | "actualRent"
  | "unitStatus"
  | "aging0_30"
  | "aging30plus"
  | "lastPayment"
  | "paymentAmount"
  | "nsfCount"
  | "lateCount"
  | "notes";

export const STANDARD_FIELD_LABELS: Record<StandardField, string> = {
  tenantName: "Tenant Name",
  unit: "Unit #",
  balance: "Balance Owed",
  daysDelinquent: "Days Delinquent",
  leaseStart: "Lease Start",
  leaseEnd: "Lease End",
  marketRent: "Market Rent",
  actualRent: "Actual Rent",
  unitStatus: "Unit Status",
  aging0_30: "0–30 Days",
  aging30plus: "30+ Days",
  lastPayment: "Last Payment Date",
  paymentAmount: "Last Payment Amount",
  nsfCount: "NSF Count",
  lateCount: "Late Count",
  notes: "Notes",
};

export type ColumnMapping = Partial<Record<StandardField, string>>;

// Default column header names per platform per file type
export const PLATFORM_COLUMN_DEFAULTS: Record<
  Platform,
  Record<string, ColumnMapping>
> = {
  AppFolio: {
    "Rent Roll": {
      tenantName: "Tenant",
      unit: "Unit",
      leaseStart: "Lease From",
      leaseEnd: "Lease To",
      marketRent: "Market Rent",
      actualRent: "Rent",
      unitStatus: "Status",
      balance: "Past Due",
      nsfCount: "NSF Count",
      lateCount: "Late Count",
    },
    "Delinquency Report": {
      tenantName: "Tenant",
      unit: "Unit",
      balance: "Balance",
      daysDelinquent: "Days Delinquent",
      aging0_30: "0-30 Days",
      aging30plus: "30+ Days",
      lastPayment: "Last Payment Date",
      paymentAmount: "Last Payment Amount",
      lateCount: "Late Count",
      notes: "Notes",
    },
  },
  RealPage: {
    "Rent Roll": {
      tenantName: "Resident Name",
      unit: "Unit",
      leaseStart: "Lease Start",
      leaseEnd: "Lease End",
      marketRent: "Market Rent",
      actualRent: "Rent Amount",
      unitStatus: "Unit Status",
    },
    "Delinquency Report": {
      tenantName: "Resident Name",
      unit: "Unit",
      balance: "Balance Due",
      daysDelinquent: "Days Past Due",
    },
  },
  Resman: {
    "Rent Roll": {
      // Column names match RESMAN_RENT_ROLL_COLS synthetic headers in import/page.tsx
      unit: "Unit",
      tenantName: "Resident",
      unitStatus: "Status",
      marketRent: "Market Rent",
      leaseStart: "Lease Start",
      leaseEnd: "Lease End",
      balance: "Balance",
      // actualRent is derived from Description="Rent" rows — not a direct mapping
    },
    "Delinquency Report": {
      unit: "Unit",
      tenantName: "Residents",
      balance: "Total",
      lateCount: "Times Late",
      notes: "Notes",
    },
  },
};

export interface DelinquencyRecord {
  propertyId: string;
  tenantName: string;
  unit: string;
  balance: number;
  daysDelinquent: number;
  agingBucket: "0-30" | "31-60" | "61-90" | "90+";
  actionStatus: "None" | "Notice Sent" | "Payment Plan" | "Eviction Filed";
  aging0_30?: number;
  aging30plus?: number;
  lastPayment?: string;
  paymentAmount?: number;
  lateCount?: number;
  nsfCount?: number;
  notes?: string;
  isSubsidy?: boolean;
}

export interface RentRollRecord {
  propertyId: string;
  unit: string;
  tenant: string;
  leaseStart: string;
  leaseEnd: string;
  marketRent: number;
  actualRent: number;
  pastDue: number;
  status: "Occupied" | "Vacant" | "Notice" | "Eviction" | "Model";
  nsfCount?: number;
  lateCount?: number;
}

export interface FinancialLineItem {
  propertyId: string;
  month: string; // "YYYY-MM"
  category: string;
  lineItem: string;
  underwriting: number;
  budget: number;
  actual: number;
  isNOI?: boolean;
  isNetCashFlow?: boolean;
  accountNumber?: string;
  variance?: number;
  budgetOnly?: boolean; // true = no actuals yet, show "—" for actual/variance
}

export interface WorkOrder {
  propertyId: string;
  woNumber: string;
  unit: string;
  category: string;
  description: string;
  vendor: string;
  estimatedCost: number;
  status: "Open" | "In Progress" | "Completed" | "On Hold";
}

export interface CapExItem {
  propertyId: string;
  item: string;
  budget: number;
  spent: number;
  pctComplete: number;
}

export interface OccupancyTrend {
  propertyId: string;
  month: string;
  occupancyPct: number;
  /** true = entry was written from a real rent roll import; false/absent = sample/placeholder data */
  fromImport?: boolean;
}

export interface AppState {
  properties: Property[];
  delinquency: DelinquencyRecord[];
  rentRoll: RentRollRecord[];
  financials: FinancialLineItem[];
  workOrders: WorkOrder[];
  capEx: CapExItem[];
  occupancyTrend: OccupancyTrend[];
  importLog: ImportLogEntry[];
}

export interface ImportLogEntry {
  account: string;
  platform: Platform;
  fileType: string;
  fileName: string;
  importedAt: string;
}

export interface PendingImport {
  id: string;
  fileName: string;
  platform: Platform;
  account: string;
  fileType: string;
  headers: string[];
  rows: Record<string, string>[];
  mapping: ColumnMapping;
}
