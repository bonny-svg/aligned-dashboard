"use client";

import { useState, useCallback } from "react";
import Papa from "papaparse";
import { useAppState } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  X,
  ArrowRight,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type {
  Platform,
  PendingImport,
  ColumnMapping,
  StandardField,
  Property,
} from "@/lib/types";
import {
  PLATFORM_COLUMN_DEFAULTS,
  STANDARD_FIELD_LABELS,
} from "@/lib/types";
import {
  parseRentRollCSV,
  parseDelinquencyCSV,
  parseIncomeStatementCSV,
  parseResmanRentRollCSV,
  parseResmanDelinquencyCSV,
  parseResmanPL,
  recalcPropertyStats,
} from "@/lib/csvParser";

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS: Platform[] = ["AppFolio", "RealPage", "Resman"];

// Synthetic column headers for Resman rent roll (fixed column positions A–AK)
const RESMAN_RENT_ROLL_COLS: string[] = [
  "_A", "Unit", "Unit Type", "_D", "Sq Feet", "Resident",
  "_G", "_H", "_I", "_J", "Status", "_L", "Market Rent",
  "_N", "_O", "_P", "_Q", "_R", "Description",
  "_T", "_U", "Amount", "_W", "_X", "_Y",
  "Move In", "Lease Start", "Lease End",
  "_AC", "_AD", "_AE", "_AF", "Move Out",
  "_AH", "_AI", "_AJ", "Balance",
];

// Detect Resman file type from raw (header: false) rows
function detectResmanFileType(rawRows: string[][]): {
  fileType: FileType; headerRowIdx: number; dataStartIdx: number;
} {
  // Row 3 (index 2) = report title
  const row2 = rawRows[2] ?? [];
  const title = (row2.find((c) => c.trim()) ?? "").toLowerCase();

  if (title.includes("rent roll") || title.includes("unit summary")) {
    return { fileType: "Rent Roll", headerRowIdx: 6, dataStartIdx: 7 };
  }
  if (title.includes("delinquent") || title.includes("delinquency")) {
    return { fileType: "Delinquency Report", headerRowIdx: 5, dataStartIdx: 6 };
  }

  // Detect P&L by looking for month columns in row 6 (index 5)
  const row5 = rawRows[5] ?? [];
  if (row5.some((c) => /\d{4}\s+Actual/i.test(c))) {
    return { fileType: "T12 Income Statement", headerRowIdx: 5, dataStartIdx: 6 };
  }

  return { fileType: "Rent Roll", headerRowIdx: 6, dataStartIdx: 7 };
}

const PLATFORM_COLORS: Record<Platform, string> = {
  AppFolio: "bg-violet-100 text-violet-800 border-violet-200",
  RealPage: "bg-sky-100 text-sky-800 border-sky-200",
  Resman:   "bg-teal-100 text-teal-800 border-teal-200",
};

const FILE_TYPES = [
  "Rent Roll",
  "Delinquency Report",
  "Owner Statement",
  "Work Orders",
  "T12 Income Statement",
] as const;
type FileType = (typeof FILE_TYPES)[number];

// Standard fields relevant per file type
const FIELDS_BY_FILE_TYPE: Record<string, StandardField[]> = {
  "Rent Roll":          ["unit", "tenantName", "unitStatus", "leaseStart", "leaseEnd", "marketRent", "actualRent", "balance"],
  "Delinquency Report": ["unit", "tenantName", "balance", "daysDelinquent", "aging0_30", "aging30plus", "lateCount", "lastPayment", "paymentAmount", "notes"],
  "Owner Statement":    [],
  "Work Orders":        [],
  "T12 Income Statement": [], // auto-parsed by account number, no mapper needed
};

// Built-in accounts derived from properties + any user-added extras
interface AccountDef {
  platform: Platform;
  label: string; // platformAccount value
}

const DEFAULT_ACCOUNTS: AccountDef[] = [
  { platform: "RealPage", label: "TX-East" },
  { platform: "RealPage", label: "TX-Victoria" },
  { platform: "Resman",   label: "TX-SA" },
  { platform: "AppFolio", label: "G&C" },
  { platform: "AppFolio", label: "B" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_COL_RE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}$/i;

function detectFileType(headers: string[]): FileType {
  const h = headers.map((x) => x.toLowerCase());
  // Income statement: has an account number column + month columns
  const hasAccountCol = h.some((x) => /account\s*(number|#|num)/i.test(x) || /acct\s*(#|num)/i.test(x));
  const hasMonthCol   = headers.some((x) => MONTH_COL_RE.test(x.trim()));
  if (hasAccountCol && hasMonthCol) return "T12 Income Statement";
  if (h.some((x) => x.includes("lease") && (x.includes("end") || x.includes("to")))) return "Rent Roll";
  if (h.some((x) => x.includes("delinq") || x.includes("days past") || x.includes("past due"))) return "Delinquency Report";
  if (h.some((x) => x.includes("balance") && !x.includes("market"))) return "Delinquency Report";
  if (h.some((x) => x.includes("work order") || x.includes("vendor"))) return "Work Orders";
  if (h.some((x) => x.includes("noi") || x.includes("t12") || x.includes("operating"))) return "T12 Income Statement";
  if (h.some((x) => x.includes("owner") || x.includes("distribution"))) return "Owner Statement";
  return "Rent Roll";
}

function buildDefaultMapping(platform: Platform, fileType: string, headers: string[]): ColumnMapping {
  const defaults = PLATFORM_COLUMN_DEFAULTS[platform]?.[fileType] ?? {};
  const mapping: ColumnMapping = {};
  for (const [field, defaultHeader] of Object.entries(defaults)) {
    // Try exact match first, then case-insensitive
    const exact = headers.find((h) => h === defaultHeader);
    const loose = headers.find((h) => h.toLowerCase() === defaultHeader.toLowerCase());
    const match = exact ?? loose;
    if (match) mapping[field as StandardField] = match;
  }
  return mapping;
}

// ─── DropZone ─────────────────────────────────────────────────────────────────

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    onFiles(Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith(".csv")));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }

  return (
    <label
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-7 cursor-pointer transition-colors ${
        dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input type="file" accept=".csv" multiple className="sr-only" onChange={handleChange} />
      <UploadCloud className="h-7 w-7 text-gray-300 mb-2" />
      <p className="text-sm font-medium text-gray-500">Drop CSV files or click to browse</p>
    </label>
  );
}

// ─── Column Mapper ────────────────────────────────────────────────────────────

function ColumnMapper({
  pending,
  properties,
  onConfirm,
  onDismiss,
}: {
  pending: PendingImport;
  properties: Property[];
  onConfirm: (mapping: ColumnMapping, targetPropertyId: string) => void;
  onDismiss: () => void;
}) {
  const [mapping, setMapping] = useState<ColumnMapping>(pending.mapping);

  // Properties on the same platform — default to the first matching account
  const eligible = properties.filter((p) => p.platform === pending.platform);
  const defaultProp = eligible.find((p) => p.platformAccount === pending.account) ?? eligible[0];
  const [targetPropertyId, setTargetPropertyId] = useState(defaultProp?.id ?? "");

  const fields = FIELDS_BY_FILE_TYPE[pending.fileType] ?? [];
  const preview = pending.rows[0] ?? {};

  function setField(field: StandardField, col: string) {
    setMapping((prev) => ({ ...prev, [field]: col || undefined }));
  }

  const canConfirm = !!targetPropertyId;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            {pending.fileName}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Detected: <strong>{pending.fileType}</strong> · {pending.rows.length} rows · {pending.headers.length} columns
          </p>
        </div>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Property selector — always shown */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-amber-800 whitespace-nowrap">Apply data to:</span>
        <select
          value={targetPropertyId}
          onChange={(e) => setTargetPropertyId(e.target.value)}
          className="flex-1 min-w-[220px] rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">— select a property —</option>
          {eligible.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.city}, {p.state})
            </option>
          ))}
          {eligible.length === 0 && (
            <option disabled>No {pending.platform} properties found — add one on the dashboard</option>
          )}
        </select>
      </div>

      {fields.length > 0 && (
        <>
          {/* Mapping table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Standard Field</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Maps to CSV Column</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Preview (row 1)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fields.map((field) => {
                  const selectedCol = mapping[field] ?? "";
                  const previewVal = selectedCol ? preview[selectedCol] : "";
                  const isMapped = !!selectedCol;
                  return (
                    <tr key={field} className={`hover:bg-gray-50 ${!isMapped ? "bg-yellow-50/50" : ""}`}>
                      <td className="px-3 py-2 font-medium text-gray-700">
                        {STANDARD_FIELD_LABELS[field]}
                        {!isMapped && <span className="ml-1 text-xs text-amber-500">(unmapped)</span>}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={selectedCol}
                          onChange={(e) => setField(field, e.target.value)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[160px]"
                        >
                          <option value="">— not mapped —</option>
                          {pending.headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 font-mono truncate max-w-[140px]">
                        {previewVal || <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onDismiss}>Cancel</Button>
        <Button
          size="sm"
          disabled={!canConfirm}
          onClick={() => onConfirm(mapping, targetPropertyId)}
        >
          Confirm &amp; Import
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─── Account Card ─────────────────────────────────────────────────────────────

function AccountCard({
  account,
  importLog,
  onFiles,
}: {
  account: AccountDef;
  importLog: { fileType: string; fileName: string; importedAt: string }[];
  onFiles: (files: File[]) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Badge className={`border text-xs ${PLATFORM_COLORS[account.platform]}`}>
            {account.platform}
          </Badge>
          <CardTitle className="text-sm">{account.label}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <DropZone onFiles={onFiles} />
        {importLog.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Last Imports</p>
            {importLog.map((entry) => (
              <div key={entry.fileType} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                <span className="text-gray-600 font-medium">{entry.fileType}</span>
                <div className="text-right text-gray-400">
                  <div className="truncate max-w-[150px]">{entry.fileName}</div>
                  <div>{formatDate(entry.importedAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const { state, setState } = useAppState();

  const [accounts, setAccounts] = useState<AccountDef[]>(DEFAULT_ACCOUNTS);
  const [activePlatform, setActivePlatform] = useState<Platform>("AppFolio");
  const [pendingImports, setPendingImports] = useState<PendingImport[]>([]);
  const [confirmedResults, setConfirmedResults] = useState<
    { fileName: string; fileType: string; status: "success" | "error"; message: string }[]
  >([]);

  // New account form
  const [newLabel, setNewLabel] = useState("");
  const [newPlatform, setNewPlatform] = useState<Platform>("AppFolio");

  const logByAccount = Object.fromEntries(
    accounts.map((a) => [
      `${a.platform}::${a.label}`,
      state.importLog.filter(
        (l) => l.platform === a.platform && l.account === a.label
      ),
    ])
  );

  // When files dropped in an account zone → parse headers, build pending import
  const handleFiles = useCallback(
    (account: AccountDef, files: File[]) => {
      for (const file of files) {
        if (account.platform === "Resman") {
          // ── Resman: raw parse (header: false) then custom skip/header logic ──
          Papa.parse(file, {
            header: false,
            skipEmptyLines: false,
            complete: (result) => {
              const rawRows = result.data as string[][];
              const { fileType, headerRowIdx, dataStartIdx } =
                detectResmanFileType(rawRows);

              let headers: string[];
              let rows: Record<string, string>[];

              if (fileType === "Rent Roll") {
                // Fixed-position synthetic headers
                headers = RESMAN_RENT_ROLL_COLS;
                rows = rawRows
                  .slice(dataStartIdx)
                  .filter((r) => r.some((c) => c.trim()))
                  .map((r) =>
                    Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""]))
                  );
              } else {
                // Use the actual header row from the file
                const rawHeaders = rawRows[headerRowIdx] ?? [];
                headers = rawHeaders.map((h, i) => h.trim() || `_col_${i}`);
                rows = rawRows
                  .slice(dataStartIdx)
                  .filter((r) => r.some((c) => c.trim()))
                  .map((r) =>
                    Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""]))
                  );
              }

              const mapping = buildDefaultMapping(account.platform, fileType, headers);
              const pending: PendingImport = {
                id: `${Date.now()}-${file.name}`,
                fileName: file.name,
                platform: account.platform,
                account: account.label,
                fileType,
                headers,
                rows,
                mapping,
              };
              setPendingImports((prev) => [pending, ...prev]);
            },
            error: (err) => {
              setConfirmedResults((prev) => [
                { fileName: file.name, fileType: "Unknown", status: "error", message: err.message },
                ...prev,
              ]);
            },
          });
        } else {
          // ── AppFolio / RealPage: existing header-based parse ──────────────
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            preview: 3,
            complete: (result) => {
              const headers = result.meta.fields ?? [];
              const fileType = detectFileType(headers);
              const mapping = buildDefaultMapping(account.platform, fileType, headers);
              Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (full) => {
                  const rows = full.data as Record<string, string>[];
                  const pending: PendingImport = {
                    id: `${Date.now()}-${file.name}`,
                    fileName: file.name,
                    platform: account.platform,
                    account: account.label,
                    fileType,
                    headers,
                    rows,
                    mapping,
                  };
                  setPendingImports((prev) => [pending, ...prev]);
                },
              });
            },
            error: (err) => {
              setConfirmedResults((prev) => [
                { fileName: file.name, fileType: "Unknown", status: "error", message: err.message },
                ...prev,
              ]);
            },
          });
        }
      }
    },
    []
  );

  function confirmImport(
    pending: PendingImport,
    mapping: ColumnMapping,
    targetPropertyId: string
  ) {
    setState((prev) => {
      // ── Parse the CSV into typed records ──────────────────────────────
      let newRentRoll   = prev.rentRoll.filter((r) => r.propertyId !== targetPropertyId);
      let newDelinquency = prev.delinquency.filter((d) => d.propertyId !== targetPropertyId);
      let newFinancials  = prev.financials;

      if (pending.platform === "Resman") {
        // ── Resman-specific parsers ────────────────────────────────
        if (pending.fileType === "Rent Roll") {
          const { rentRoll, delinquency } = parseResmanRentRollCSV(
            pending.rows, mapping, targetPropertyId
          );
          newRentRoll    = [...newRentRoll, ...rentRoll];
          newDelinquency = [...newDelinquency, ...delinquency];
        } else if (pending.fileType === "Delinquency Report") {
          const { delinquency } = parseResmanDelinquencyCSV(
            pending.rows, mapping, targetPropertyId
          );
          newDelinquency = [...newDelinquency, ...delinquency];
        } else if (pending.fileType === "T12 Income Statement") {
          const { financials } = parseResmanPL(pending.rows, targetPropertyId);
          newFinancials = [
            ...prev.financials.filter((f) => f.propertyId !== targetPropertyId),
            ...financials,
          ];
        }
      } else {
        // ── AppFolio / RealPage parsers ────────────────────────────
        if (pending.fileType === "Rent Roll") {
          const { rentRoll, delinquency } = parseRentRollCSV(
            pending.rows, mapping, targetPropertyId, pending.platform
          );
          newRentRoll    = [...newRentRoll, ...rentRoll];
          newDelinquency = [...newDelinquency, ...delinquency];
        } else if (pending.fileType === "Delinquency Report") {
          const { delinquency } = parseDelinquencyCSV(
            pending.rows, mapping, targetPropertyId, pending.platform
          );
          newDelinquency = [...newDelinquency, ...delinquency];
        } else if (pending.fileType === "T12 Income Statement") {
          const { financials } = parseIncomeStatementCSV(pending.rows, targetPropertyId);
          newFinancials = [
            ...prev.financials.filter((f) => f.propertyId !== targetPropertyId),
            ...financials,
          ];
        }
      }

      // ── Recalculate property stats ────────────────────────────────────
      const property = prev.properties.find((p) => p.id === targetPropertyId);
      const propRentRoll  = newRentRoll.filter((r) => r.propertyId === targetPropertyId);
      const propDelinquency = newDelinquency.filter((d) => d.propertyId === targetPropertyId);
      const propStats = property ? recalcPropertyStats(property, propRentRoll, propDelinquency) : null;

      const updatedProperties = property
        ? prev.properties.map((p) =>
            p.id === targetPropertyId
              ? { ...p, ...propStats, lastImport: new Date().toISOString() }
              : p
          )
        : prev.properties;

      // ── Update occupancy trend (rent roll imports only) ───────────────
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const newOccupancyTrend =
        pending.fileType === "Rent Roll" && propStats
          ? [
              ...prev.occupancyTrend.filter(
                (t) => !(t.propertyId === targetPropertyId && t.month === currentMonth)
              ),
              {
                propertyId: targetPropertyId,
                month: currentMonth,
                occupancyPct: propStats.occupancyPct,
                fromImport: true as const,
              },
            ]
          : prev.occupancyTrend;

      // ── Update import log ─────────────────────────────────────────────
      const newLog = [
        {
          account: pending.account,
          platform: pending.platform,
          fileType: pending.fileType,
          fileName: pending.fileName,
          importedAt: new Date().toISOString(),
        },
        ...prev.importLog.filter(
          (l) =>
            !(
              l.account === pending.account &&
              l.platform === pending.platform &&
              l.fileType === pending.fileType
            )
        ),
      ];

      return {
        ...prev,
        properties: updatedProperties,
        rentRoll: newRentRoll,
        delinquency: newDelinquency,
        financials: newFinancials,
        occupancyTrend: newOccupancyTrend,
        importLog: newLog,
      };
    });

    const targetName =
      state.properties.find((p) => p.id === targetPropertyId)?.name ?? targetPropertyId;

    setPendingImports((prev) => prev.filter((p) => p.id !== pending.id));
    setConfirmedResults((prev) => [
      {
        fileName: pending.fileName,
        fileType: pending.fileType,
        status: "success",
        message: `${pending.fileType} · ${pending.rows.length} rows → ${targetName}`,
      },
      ...prev,
    ]);
  }

  function dismissPending(id: string) {
    setPendingImports((prev) => prev.filter((p) => p.id !== id));
  }

  function addAccount() {
    const label = newLabel.trim();
    if (!label) return;
    if (accounts.some((a) => a.platform === newPlatform && a.label === label)) return;
    setAccounts((prev) => [...prev, { platform: newPlatform, label }]);
    setNewLabel("");
  }

  const platformAccounts = accounts.filter((a) => a.platform === activePlatform);
  const platformPending = pendingImports.filter((p) => p.platform === activePlatform);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import CSV Files</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload exports from AppFolio, RealPage, or Resman. Column headers are mapped automatically per platform and can be adjusted before import.
        </p>
      </div>

      {/* Supported file types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-blue-500" />
            Supported File Types
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {FILE_TYPES.map((t) => (
              <Badge key={t} className="bg-blue-50 text-blue-700 border border-blue-200 text-xs">{t}</Badge>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            File type is auto-detected from column headers. Column mappings are pre-filled per platform and editable before confirming.
          </p>
        </CardContent>
      </Card>

      {/* Platform tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => setActivePlatform(p)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activePlatform === p
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {p}
            <span className="ml-2 text-xs text-gray-400">
              ({accounts.filter((a) => a.platform === p).length})
            </span>
          </button>
        ))}
      </div>

      {/* Pending imports for active platform */}
      {platformPending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <ChevronRight className="h-4 w-4 text-blue-500" />
            Review Column Mapping — {platformPending.length} file{platformPending.length > 1 ? "s" : ""} pending
          </h3>
          {platformPending.map((pending) => (
            <ColumnMapper
              key={pending.id}
              pending={pending}
              properties={state.properties}
              onConfirm={(mapping, propId) => confirmImport(pending, mapping, propId)}
              onDismiss={() => dismissPending(pending.id)}
            />
          ))}
        </div>
      )}

      {/* Account upload zones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {platformAccounts.map((account) => (
          <AccountCard
            key={`${account.platform}::${account.label}`}
            account={account}
            importLog={logByAccount[`${account.platform}::${account.label}`] ?? []}
            onFiles={(files) => handleFiles(account, files)}
          />
        ))}
        {platformAccounts.length === 0 && (
          <p className="text-sm text-gray-400 col-span-2 py-4">
            No accounts configured for {activePlatform}. Add one below.
          </p>
        )}
      </div>

      {/* Add account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add Account / Portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <select
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value as Platform)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addAccount()}
              placeholder="Account / portfolio name (e.g. G&C, TX-North)"
              className="flex-1 min-w-[220px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button variant="outline" size="md" onClick={addAccount}>
              Add Account
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmed results */}
      {confirmedResults.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Import Log</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setConfirmedResults([])}>Clear</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {confirmedResults.map((r, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${
                  r.status === "success" ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"
                }`}
              >
                {r.status === "success"
                  ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  : <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-800 truncate block">{r.fileName}</span>
                  <p className={`text-xs mt-0.5 ${r.status === "success" ? "text-green-700" : "text-red-700"}`}>
                    {r.message}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
