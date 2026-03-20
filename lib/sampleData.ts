import type {
  AppState,
  DelinquencyRecord,
  RentRollRecord,
  FinancialLineItem,
  WorkOrder,
  CapExItem,
  OccupancyTrend,
  Property,
} from "./types";

// Seeded LCG — same sequence on server and client, no hydration mismatch.
function makePRNG(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    return (s >>> 0) / 0x100000000;
  };
}
const rand = makePRNG(0xdeadbeef);

// ─── Properties ───────────────────────────────────────────────────────────────

export const SAMPLE_PROPERTIES: Property[] = [
  {
    id: "towne-east",
    name: "Towne East Village",
    address: "4800 Towne East Dr",
    city: "Converse",
    state: "TX",
    units: 100,
    occupancyPct: 94.0,
    collectedMTD: 87200,
    delinquencyPct: 3.1,
    status: "Active",
    platform: "RealPage",
    platformAccount: "TX-East",
    lastImport: "2026-03-15T09:22:00Z",
  },
  {
    id: "woodhaven",
    name: "Woodhaven Apartments",
    address: "9201 Wurzbach Pkwy",
    city: "San Antonio",
    state: "TX",
    units: 32,
    occupancyPct: 87.5,
    collectedMTD: 24400,
    delinquencyPct: 5.8,
    status: "Stabilizing",
    platform: "Resman",
    platformAccount: "TX-SA",
    lastImport: "2026-03-15T09:45:00Z",
    noiBudget: 17125,
    occupancyBudget: 94.0,
  },
  {
    id: "north-park",
    name: "North Park Apartments",
    address: "1400 University Blvd",
    city: "Durant",
    state: "OK",
    units: 80,
    occupancyPct: 91.3,
    collectedMTD: 54800,
    delinquencyPct: 4.2,
    status: "Active",
    platform: "AppFolio",
    platformAccount: "G&C",
    lastImport: "2026-03-14T11:00:00Z",
    noiBudget: 26215,
    occupancyBudget: 89.0,
  },
  {
    id: "woodland-terrace",
    name: "Woodland Terrace",
    address: "7200 Woodland Dr",
    city: "Little Rock",
    state: "AR",
    units: 60,
    occupancyPct: 88.3,
    collectedMTD: 37200,
    delinquencyPct: 6.1,
    status: "Active",
    platform: "AppFolio",
    platformAccount: "G&C",
    lastImport: "2026-03-14T11:15:00Z",
    noiBudget: 28873,
    occupancyBudget: 95.0,
  },
  {
    id: "hall-street",
    name: "Hall Street Court",
    address: "4455 SW Hall Blvd",
    city: "Beaverton",
    state: "OR",
    units: 26,
    occupancyPct: 92.3,
    collectedMTD: 26100,
    delinquencyPct: 2.4,
    status: "Active",
    platform: "AppFolio",
    platformAccount: "B",
    lastImport: "2026-03-15T08:30:00Z",
    noiBudget: 28222,
    occupancyBudget: 95.0,
  },
  {
    id: "the-grove",
    name: "The Grove",
    address: "3300 N Laurent St",
    city: "Victoria",
    state: "TX",
    units: 288,
    occupancyPct: 95.5,
    collectedMTD: 314600,
    delinquencyPct: 2.8,
    status: "Active",
    platform: "RealPage",
    platformAccount: "TX-Victoria",
    lastImport: "2026-03-15T10:00:00Z",
  },
];

// ─── Delinquency ─────────────────────────────────────────────────────────────

const DELINQUENCY: DelinquencyRecord[] = [
  // Towne East
  { propertyId: "towne-east", tenantName: "Maria Gonzalez",   unit: "104", balance: 1250, daysDelinquent: 18, agingBucket: "0-30",  actionStatus: "Notice Sent" },
  { propertyId: "towne-east", tenantName: "James Patton",      unit: "217", balance: 2700, daysDelinquent: 45, agingBucket: "31-60", actionStatus: "Payment Plan" },
  { propertyId: "towne-east", tenantName: "Luz Herrera",       unit: "308", balance: 875,  daysDelinquent: 12, agingBucket: "0-30",  actionStatus: "None" },
  { propertyId: "towne-east", tenantName: "DeShawn Williams",  unit: "412", balance: 3900, daysDelinquent: 78, agingBucket: "61-90", actionStatus: "Eviction Filed" },
  // Woodhaven
  { propertyId: "woodhaven",  tenantName: "Carlos Reyes",      unit: "A3",  balance: 1550, daysDelinquent: 22, agingBucket: "0-30",  actionStatus: "Notice Sent" },
  { propertyId: "woodhaven",  tenantName: "Tanya Brooks",      unit: "B7",  balance: 3200, daysDelinquent: 55, agingBucket: "31-60", actionStatus: "Payment Plan" },
  { propertyId: "woodhaven",  tenantName: "Kevin Larson",      unit: "C2",  balance: 4800, daysDelinquent: 102, agingBucket: "90+", actionStatus: "Eviction Filed" },
  { propertyId: "woodhaven",  tenantName: "Rosa Mendez",       unit: "D5",  balance: 650,  daysDelinquent: 9,  agingBucket: "0-30",  actionStatus: "None" },
  // North Park
  { propertyId: "north-park", tenantName: "Brenda Cole",       unit: "112", balance: 975,  daysDelinquent: 14, agingBucket: "0-30",  actionStatus: "None" },
  { propertyId: "north-park", tenantName: "Marcus Webb",       unit: "204", balance: 2200, daysDelinquent: 38, agingBucket: "31-60", actionStatus: "Notice Sent" },
  { propertyId: "north-park", tenantName: "Patricia Dunn",     unit: "318", balance: 3500, daysDelinquent: 65, agingBucket: "61-90", actionStatus: "Eviction Filed" },
  { propertyId: "north-park", tenantName: "Jorge Salinas",     unit: "105", balance: 800,  daysDelinquent: 8,  agingBucket: "0-30",  actionStatus: "None" },
  // Woodland Terrace
  { propertyId: "woodland-terrace", tenantName: "Sandra Pike", unit: "201", balance: 4400, daysDelinquent: 68, agingBucket: "61-90", actionStatus: "Eviction Filed" },
  { propertyId: "woodland-terrace", tenantName: "Mike Tran",   unit: "115", balance: 1900, daysDelinquent: 40, agingBucket: "31-60", actionStatus: "Payment Plan" },
  { propertyId: "woodland-terrace", tenantName: "Janet Owens", unit: "305", balance: 2600, daysDelinquent: 95, agingBucket: "90+",   actionStatus: "Eviction Filed" },
  { propertyId: "woodland-terrace", tenantName: "Amy Frost",   unit: "208", balance: 800,  daysDelinquent: 15, agingBucket: "0-30",  actionStatus: "Notice Sent" },
  // Hall Street Court
  { propertyId: "hall-street",     tenantName: "Derek Holt",   unit: "B2",  balance: 1100, daysDelinquent: 20, agingBucket: "0-30",  actionStatus: "Notice Sent" },
  // The Grove
  { propertyId: "the-grove",       tenantName: "Ashley Ruiz",  unit: "114", balance: 1650, daysDelinquent: 25, agingBucket: "0-30",  actionStatus: "Notice Sent" },
  { propertyId: "the-grove",       tenantName: "Troy Manning",  unit: "237", balance: 2900, daysDelinquent: 48, agingBucket: "31-60", actionStatus: "Payment Plan" },
  { propertyId: "the-grove",       tenantName: "Linda Xu",      unit: "312", balance: 4200, daysDelinquent: 82, agingBucket: "61-90", actionStatus: "Eviction Filed" },
  { propertyId: "the-grove",       tenantName: "Darren Pope",   unit: "158", balance: 950,  daysDelinquent: 10, agingBucket: "0-30",  actionStatus: "None" },
  { propertyId: "the-grove",       tenantName: "Keisha Grant",  unit: "201", balance: 5800, daysDelinquent: 118, agingBucket: "90+", actionStatus: "Eviction Filed" },
];

// ─── Rent Roll ────────────────────────────────────────────────────────────────

const TENANTS = [
  "Alice Morgan","Ben Carter","Carol Davis","David Evans","Eva Foster",
  "Frank Green","Grace Hall","Henry Irwin","Iris James","Jack King",
  "Karen Lee","Liam Moore","Mia Nelson","Noah Owens","Olivia Parker",
  "Paul Quinn","Quinn Roberts","Rachel Scott","Sam Turner","Tina Underhill",
  "Uma Vance","Victor White","Wendy Xiao","Xander Young","Yara Zimmerman",
  "Zoe Adams","Aaron Baker","Bella Clark","Cameron Diaz","Diana Ellis",
  "Ethan Fox","Fiona Gray","George Hunt","Hannah Ingram","Ivan Jackson",
  "Julia Kim","Ken Lopez","Laura Mills","Matt Nguyen","Nina Ortiz",
];

function buildRentRoll(propertyId: string, unitPrefix: string, count: number, baseRent: number): RentRollRecord[] {
  const records: RentRollRecord[] = [];
  let tenantIdx = 0;
  for (let i = 1; i <= count; i++) {
    const unit = `${unitPrefix}${i.toString().padStart(2, "0")}`;
    const isVacant = rand() < 0.07;
    const isNotice = !isVacant && rand() < 0.05;
    const leaseStart = `2025-${String(Math.ceil(rand() * 9) + 1).padStart(2, "0")}-01`;
    const leaseEndMonth = rand() < 0.2 ? "2026-04" : rand() < 0.3 ? "2026-05" : "2026-10";
    const leaseEnd = `${leaseEndMonth}-${rand() < 0.5 ? "15" : "30"}`;
    const variance = Math.round((rand() - 0.15) * 80);
    records.push({
      propertyId,
      unit,
      tenant: isVacant ? "VACANT" : TENANTS[tenantIdx++ % TENANTS.length],
      leaseStart: isVacant ? "" : leaseStart,
      leaseEnd: isVacant ? "" : leaseEnd,
      marketRent: baseRent,
      actualRent: isVacant ? 0 : baseRent + variance,
      pastDue: 0,
      status: isVacant ? "Vacant" : isNotice ? "Notice" : "Occupied",
    });
  }
  return records;
}

const RENT_ROLL: RentRollRecord[] = [
  ...buildRentRoll("towne-east",       "",    100, 925),
  ...buildRentRoll("woodhaven",        "WH-",  32, 875),
  ...buildRentRoll("north-park",       "NP-",  80, 750),
  ...buildRentRoll("woodland-terrace", "WT-",  60, 700),
  ...buildRentRoll("hall-street",      "HS-",  26, 1100),
  ...buildRentRoll("the-grove",        "GV-", 288, 1150),
];

// ─── Financials ───────────────────────────────────────────────────────────────

function buildFinancials(propertyId: string, gpri: number, noi: number): FinancialLineItem[] {
  const months = ["2026-01", "2026-02", "2026-03"];
  const items: FinancialLineItem[] = [];
  for (const month of months) {
    const variance = 0.97 + rand() * 0.06;
    const expenseBase = gpri * 0.52;
    items.push(
      { propertyId, month, category: "Income",   lineItem: "Gross Potential Rent",   underwriting: gpri,             budget: gpri,             actual: Math.round(gpri * variance)                            },
      { propertyId, month, category: "Income",   lineItem: "Vacancy Loss",            underwriting: -gpri * 0.06,     budget: -gpri * 0.06,     actual: Math.round(-gpri * (0.04 + rand() * 0.04))             },
      { propertyId, month, category: "Income",   lineItem: "Other Income",            underwriting: gpri * 0.04,      budget: gpri * 0.04,      actual: Math.round(gpri * (0.03 + rand() * 0.02))              },
      { propertyId, month, category: "Expenses", lineItem: "Management Fee",          underwriting: gpri * 0.08,      budget: gpri * 0.08,      actual: Math.round(gpri * 0.08)                                },
      { propertyId, month, category: "Expenses", lineItem: "Repairs & Maintenance",   underwriting: expenseBase * 0.18, budget: expenseBase * 0.18, actual: Math.round(expenseBase * (0.14 + rand() * 0.08))  },
      { propertyId, month, category: "Expenses", lineItem: "Utilities",               underwriting: expenseBase * 0.12, budget: expenseBase * 0.12, actual: Math.round(expenseBase * (0.10 + rand() * 0.04))  },
      { propertyId, month, category: "Expenses", lineItem: "Insurance",               underwriting: expenseBase * 0.08, budget: expenseBase * 0.08, actual: Math.round(expenseBase * 0.08)                    },
      { propertyId, month, category: "Expenses", lineItem: "Property Tax",            underwriting: expenseBase * 0.14, budget: expenseBase * 0.14, actual: Math.round(expenseBase * 0.14)                    },
      { propertyId, month, category: "Expenses", lineItem: "Admin & Legal",           underwriting: expenseBase * 0.05, budget: expenseBase * 0.05, actual: Math.round(expenseBase * (0.04 + rand() * 0.03)) },
      { propertyId, month, category: "NOI",      lineItem: "Net Operating Income",    underwriting: noi,              budget: noi,              actual: Math.round(noi * (0.93 + rand() * 0.10)),             isNOI: true  },
    );
  }
  return items;
}

// ─── Explicit 2026 budget financials ─────────────────────────────────────────

const rand2 = makePRNG(0xcafe1234); // Woodland Terrace & Hall Street Court
const rand3 = makePRNG(0xdecafbad); // Woodhaven & North Park

function budgetItems(
  pid: string,
  month: string,
  gpr: number,
  vacLoss: number,
  otherIncome: number,
  mgmtFee: number,
  rm: number,
  util: number,
  ins: number,
  propTax: number,
  admin: number,
  noi: number,
  hasActuals: boolean,
  rng = rand2,
): FinancialLineItem[] {
  const v  = hasActuals ? 0.97 + rng() * 0.06 : 1;
  const ve = hasActuals ? 0.97 + rng() * 0.06 : 1;
  const bo = !hasActuals;
  return [
    { propertyId: pid, month, category: "Income",   lineItem: "Gross Potential Rent",  underwriting: gpr,         budget: gpr,         actual: hasActuals ? Math.round(gpr * v)  : 0, budgetOnly: bo },
    { propertyId: pid, month, category: "Income",   lineItem: "Vacancy Loss",           underwriting: vacLoss,     budget: vacLoss,     actual: hasActuals ? Math.round(vacLoss * (0.97 + rng() * 0.06)) : 0, budgetOnly: bo },
    { propertyId: pid, month, category: "Income",   lineItem: "Other Income",           underwriting: otherIncome, budget: otherIncome, actual: hasActuals ? Math.round(otherIncome * (0.97 + rng() * 0.06)) : 0, budgetOnly: bo },
    { propertyId: pid, month, category: "Expenses", lineItem: "Management Fee",         underwriting: mgmtFee,     budget: mgmtFee,     actual: hasActuals ? Math.round(mgmtFee * ve) : 0, budgetOnly: bo },
    { propertyId: pid, month, category: "Expenses", lineItem: "Repairs & Maintenance",  underwriting: rm,          budget: rm,          actual: hasActuals ? Math.round(rm * (0.97 + rng() * 0.06)) : 0, budgetOnly: bo },
    { propertyId: pid, month, category: "Expenses", lineItem: "Utilities",              underwriting: util,        budget: util,        actual: hasActuals ? Math.round(util * (0.97 + rng() * 0.06)) : 0, budgetOnly: bo },
    { propertyId: pid, month, category: "Expenses", lineItem: "Insurance",              underwriting: ins,         budget: ins,         actual: hasActuals ? Math.round(ins * 1.0) : 0, budgetOnly: bo },
    { propertyId: pid, month, category: "Expenses", lineItem: "Property Tax",           underwriting: propTax,     budget: propTax,     actual: hasActuals ? Math.round(propTax * 1.0) : 0, budgetOnly: bo },
    { propertyId: pid, month, category: "Expenses", lineItem: "Admin & Legal",          underwriting: admin,       budget: admin,       actual: hasActuals ? Math.round(admin * (0.97 + rng() * 0.06)) : 0, budgetOnly: bo },
    { propertyId: pid, month, category: "NOI",      lineItem: "Net Operating Income",   underwriting: noi,         budget: noi,         actual: hasActuals ? Math.round(noi * (0.93 + rng() * 0.10)) : 0, isNOI: true, budgetOnly: bo },
  ];
}

function buildWoodhavenFinancials(): FinancialLineItem[] {
  const pid = "woodhaven";
  // Jan–Mar: EGI=28,200, Expenses=11,075, NOI=17,125
  const jm = { gpr: 28776, vac: -1727, oi: 1151, mf: 2302, rm: 3000, ut: 1800, ins: 1200, pt: 1500, ad: 1273, noi: 17125 };
  // Apr–Dec: EGI=28,920, Expenses=11,136, NOI=17,784
  const ad = { gpr: 29510, vac: -1771, oi: 1180, mf: 2361, rm: 3000, ut: 1800, ins: 1200, pt: 1500, ad: 1275, noi: 17784 };
  return [
    ...["2026-01","2026-02","2026-03"].flatMap((m) =>
      budgetItems(pid, m, jm.gpr, jm.vac, jm.oi, jm.mf, jm.rm, jm.ut, jm.ins, jm.pt, jm.ad, jm.noi, true, rand3)
    ),
    ...["2026-04","2026-05","2026-06","2026-07","2026-08","2026-09","2026-10","2026-11","2026-12"].flatMap((m) =>
      budgetItems(pid, m, ad.gpr, ad.vac, ad.oi, ad.mf, ad.rm, ad.ut, ad.ins, ad.pt, ad.ad, ad.noi, false, rand3)
    ),
  ];
}

function buildNorthParkFinancials(): FinancialLineItem[] {
  const pid = "north-park";
  // Jan–Jul: EGI=61,800, Expenses=35,585, NOI=26,215
  const jj = { gpr: 63061, vac: -3784, oi: 2522, mf: 5045, rm: 9000, ut: 7000, ins: 5000, pt: 7500, ad: 2040, noi: 26215 };
  // Aug–Dec: EGI=65,200, Expenses=34,284, NOI=30,916
  const ad = { gpr: 66531, vac: -3992, oi: 2661, mf: 5322, rm: 9200, ut: 7200, ins: 4500, pt: 6500, ad: 1562, noi: 30916 };
  return [
    ...["2026-01","2026-02","2026-03"].flatMap((m) =>
      budgetItems(pid, m, jj.gpr, jj.vac, jj.oi, jj.mf, jj.rm, jj.ut, jj.ins, jj.pt, jj.ad, jj.noi, true, rand3)
    ),
    ...["2026-04","2026-05","2026-06","2026-07"].flatMap((m) =>
      budgetItems(pid, m, jj.gpr, jj.vac, jj.oi, jj.mf, jj.rm, jj.ut, jj.ins, jj.pt, jj.ad, jj.noi, false, rand3)
    ),
    ...["2026-08","2026-09","2026-10","2026-11","2026-12"].flatMap((m) =>
      budgetItems(pid, m, ad.gpr, ad.vac, ad.oi, ad.mf, ad.rm, ad.ut, ad.ins, ad.pt, ad.ad, ad.noi, false, rand3)
    ),
  ];
}

function buildWoodlandTerraceFinancials(): FinancialLineItem[] {
  const pid = "woodland-terrace";
  // Jan–Jul: EGI=61,639, Expenses=32,766, NOI=28,873
  const jj = { gpr: 62897, vac: -3774, oi: 2516, mf: 5032, rm: 8073, ut: 5000, ins: 3200, pt: 7000, ad: 4461, noi: 28873 };
  // Aug–Dec: EGI=63,488, Expenses=33,417, NOI=30,071
  const ad = { gpr: 64784, vac: -3887, oi: 2591, mf: 5183, rm: 8243, ut: 5100, ins: 3267, pt: 7141, ad: 4483, noi: 30071 };
  return [
    // Jan–Mar: budgets + PRNG actuals
    ...["2026-01","2026-02","2026-03"].flatMap((m) =>
      budgetItems(pid, m, jj.gpr, jj.vac, jj.oi, jj.mf, jj.rm, jj.ut, jj.ins, jj.pt, jj.ad, jj.noi, true)
    ),
    // Apr–Jul: budget only
    ...["2026-04","2026-05","2026-06","2026-07"].flatMap((m) =>
      budgetItems(pid, m, jj.gpr, jj.vac, jj.oi, jj.mf, jj.rm, jj.ut, jj.ins, jj.pt, jj.ad, jj.noi, false)
    ),
    // Aug–Dec: budget only
    ...["2026-08","2026-09","2026-10","2026-11","2026-12"].flatMap((m) =>
      budgetItems(pid, m, ad.gpr, ad.vac, ad.oi, ad.mf, ad.rm, ad.ut, ad.ins, ad.pt, ad.ad, ad.noi, false)
    ),
  ];
}

function buildHallStreetFinancials(): FinancialLineItem[] {
  const pid = "hall-street";
  // All months: EGI=40,724, Expenses=12,502, NOI=28,222
  const b = { gpr: 41555, vac: -2493, oi: 1662, mf: 3324, rm: 2500, ut: 1800, ins: 1200, pt: 2500, ad: 1178, noi: 28222 };
  return [
    // Jan–Mar: budgets + PRNG actuals
    ...["2026-01","2026-02","2026-03"].flatMap((m) =>
      budgetItems(pid, m, b.gpr, b.vac, b.oi, b.mf, b.rm, b.ut, b.ins, b.pt, b.ad, b.noi, true)
    ),
    // Apr–Dec: budget only
    ...["2026-04","2026-05","2026-06","2026-07","2026-08","2026-09","2026-10","2026-11","2026-12"].flatMap((m) =>
      budgetItems(pid, m, b.gpr, b.vac, b.oi, b.mf, b.rm, b.ut, b.ins, b.pt, b.ad, b.noi, false)
    ),
  ];
}

const FINANCIALS: FinancialLineItem[] = [
  ...buildFinancials("towne-east",  92500,  38000),
  ...buildWoodhavenFinancials(),
  ...buildNorthParkFinancials(),
  ...buildWoodlandTerraceFinancials(),
  ...buildHallStreetFinancials(),
  ...buildFinancials("the-grove",  345600, 148000),
];

// ─── Work Orders ──────────────────────────────────────────────────────────────

const WORK_ORDERS: WorkOrder[] = [
  { propertyId: "towne-east",       woNumber: "WO-1041", unit: "215",    category: "HVAC",             description: "AC not cooling — compressor issue",        vendor: "CoolAir Services",  estimatedCost: 1800, status: "In Progress" },
  { propertyId: "towne-east",       woNumber: "WO-1042", unit: "107",    category: "Plumbing",         description: "Leaking water heater",                     vendor: "SA Plumbing Co",    estimatedCost: 950,  status: "Open" },
  { propertyId: "towne-east",       woNumber: "WO-1043", unit: "Common", category: "Exterior",         description: "Pool pump replacement",                    vendor: "AquaTech",          estimatedCost: 3200, status: "Open" },
  { propertyId: "woodhaven",        woNumber: "WO-2011", unit: "B4",     category: "Plumbing",         description: "Sewer line blockage",                      vendor: "Roto-Rooter",       estimatedCost: 2200, status: "In Progress" },
  { propertyId: "woodhaven",        woNumber: "WO-2012", unit: "A1",     category: "Flooring",         description: "Replace vinyl plank — water damage",       vendor: "Floor Pros",        estimatedCost: 1400, status: "Open" },
  { propertyId: "north-park",       woNumber: "WO-3010", unit: "205",    category: "HVAC",             description: "Fan coil unit replacement",                vendor: "OKC HVAC Supply",   estimatedCost: 2100, status: "Open" },
  { propertyId: "north-park",       woNumber: "WO-3011", unit: "Common", category: "Exterior",         description: "Parking lot light repair — 4 fixtures",    vendor: "Bright Electric",   estimatedCost: 850,  status: "In Progress" },
  { propertyId: "woodland-terrace", woNumber: "WO-4010", unit: "301",    category: "Roofing",          description: "Roof leak above Unit 301",                 vendor: "AR Roof & Seal",    estimatedCost: 3800, status: "In Progress" },
  { propertyId: "woodland-terrace", woNumber: "WO-4011", unit: "110",    category: "Mold Remediation", description: "Bathroom mold — shower caulk failure",     vendor: "EnviroClean AR",    estimatedCost: 1200, status: "Open" },
  { propertyId: "hall-street",      woNumber: "WO-5001", unit: "A3",     category: "Plumbing",         description: "Slow drain — main stack partial blockage", vendor: "Oregon Drain Pros", estimatedCost: 950,  status: "Open" },
  { propertyId: "hall-street",      woNumber: "WO-5002", unit: "Common", category: "Exterior",         description: "Gate motor replacement",                   vendor: "Access Control NW", estimatedCost: 1800, status: "Completed" },
  { propertyId: "the-grove",        woNumber: "WO-6041", unit: "142",    category: "HVAC",             description: "Package unit compressor failure",          vendor: "Victoria HVAC",     estimatedCost: 4200, status: "In Progress" },
  { propertyId: "the-grove",        woNumber: "WO-6042", unit: "Common", category: "Pool",             description: "Pool heater replacement",                  vendor: "AquaTech TX",       estimatedCost: 6800, status: "Open" },
  { propertyId: "the-grove",        woNumber: "WO-6043", unit: "256",    category: "Electrical",       description: "Breaker panel upgrade",                    vendor: "Volt Electric TX",  estimatedCost: 2400, status: "On Hold" },
];

// ─── CapEx ────────────────────────────────────────────────────────────────────

const CAPEX_ITEMS: CapExItem[] = [
  { propertyId: "towne-east",       item: "Pool Renovation",               budget: 28000,  spent: 18400, pctComplete: 65 },
  { propertyId: "towne-east",       item: "Exterior Paint — Bldg A & B",   budget: 14000,  spent: 14000, pctComplete: 100 },
  { propertyId: "towne-east",       item: "Clubhouse Refresh",              budget: 9500,   spent: 2200,  pctComplete: 23 },
  { propertyId: "woodhaven",        item: "Sewer Line Replacement",         budget: 35000,  spent: 12000, pctComplete: 34 },
  { propertyId: "woodhaven",        item: "Landscaping Overhaul",           budget: 8000,   spent: 5500,  pctComplete: 69 },
  { propertyId: "north-park",       item: "Unit Rehab — Phase 1 (20 units)",budget: 60000,  spent: 38000, pctComplete: 63 },
  { propertyId: "north-park",       item: "Signage Replacement",            budget: 4500,   spent: 4500,  pctComplete: 100 },
  { propertyId: "woodland-terrace", item: "Roof Replacement — Phase 1",    budget: 45000,  spent: 18000, pctComplete: 40 },
  { propertyId: "woodland-terrace", item: "Parking Lot Reseal",             budget: 12000,  spent: 0,     pctComplete: 0 },
  { propertyId: "hall-street",      item: "Exterior Paint & Siding",        budget: 22000,  spent: 9500,  pctComplete: 43 },
  { propertyId: "hall-street",      item: "Common Area Refresh",            budget: 6500,   spent: 6500,  pctComplete: 100 },
  { propertyId: "the-grove",        item: "Amenity Center Expansion",       budget: 185000, spent: 62000, pctComplete: 34 },
  { propertyId: "the-grove",        item: "Unit Interior Upgrade — 48 Units", budget: 192000, spent: 141000, pctComplete: 73 },
  { propertyId: "the-grove",        item: "Perimeter Fence Replacement",    budget: 38000,  spent: 0,     pctComplete: 0 },
];

// ─── Occupancy Trend ──────────────────────────────────────────────────────────

function buildTrend(propertyId: string, current: number): OccupancyTrend[] {
  const months = ["2025-09","2025-10","2025-11","2025-12","2026-01","2026-02","2026-03"];
  return months.map((month, i) => ({
    propertyId,
    month,
    occupancyPct: Math.min(100, Math.max(70, current - (months.length - 1 - i) * (rand() * 1.5))),
  }));
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const SAMPLE_STATE: AppState = {
  properties: SAMPLE_PROPERTIES,
  delinquency: DELINQUENCY,
  rentRoll: RENT_ROLL,
  financials: FINANCIALS,
  workOrders: WORK_ORDERS,
  capEx: CAPEX_ITEMS,
  occupancyTrend: [
    ...buildTrend("towne-east",       94.0),
    ...buildTrend("woodhaven",        87.5),
    ...buildTrend("north-park",       91.3),
    ...buildTrend("woodland-terrace", 88.3),
    ...buildTrend("hall-street",      92.3),
    ...buildTrend("the-grove",        95.5),
  ],
  importLog: [
    { account: "TX-East",     platform: "RealPage", fileType: "Rent Roll",         fileName: "towneeast_rentroll_Mar2026.csv",      importedAt: "2026-03-15T09:22:00Z" },
    { account: "TX-East",     platform: "RealPage", fileType: "Delinquency Report", fileName: "towneeast_delinq_Mar2026.csv",        importedAt: "2026-03-15T09:22:00Z" },
    { account: "TX-SA",       platform: "Resman",   fileType: "Rent Roll",         fileName: "woodhaven_rentroll_Mar2026.csv",      importedAt: "2026-03-15T09:45:00Z" },
    { account: "G&C",         platform: "AppFolio", fileType: "Rent Roll",         fileName: "northpark_rentroll_Mar2026.csv",      importedAt: "2026-03-14T11:00:00Z" },
    { account: "G&C",         platform: "AppFolio", fileType: "Rent Roll",         fileName: "woodlandterrace_rentroll_Mar2026.csv", importedAt: "2026-03-14T11:15:00Z" },
    { account: "B",           platform: "AppFolio", fileType: "Rent Roll",         fileName: "hallstreet_rentroll_Mar2026.csv",     importedAt: "2026-03-15T08:30:00Z" },
    { account: "TX-Victoria", platform: "RealPage", fileType: "Rent Roll",         fileName: "thegrove_rentroll_Mar2026.csv",       importedAt: "2026-03-15T10:00:00Z" },
  ],
};
