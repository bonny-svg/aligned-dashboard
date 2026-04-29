// Stores and serves Towne East's three supplemental reports:
//   • delinquency  — Collections platform CSV (Knock / similar)
//   • maintenance  — Work-order summary CSV
//   • leasing      — Leasing-by-channel Excel
//
// POST: multipart/form-data with optional fields { delinquency, maintenance, leasing }
//       or application/json with { delinquency: {base64}, maintenance: {base64}, leasing: {base64} }
// GET:  returns /api/towne-east/file/extras (proxied) or null

import { NextRequest, NextResponse } from "next/server";
import { put, list, BlobNotFoundError } from "@vercel/blob";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXTRAS_PATH = "towne-east/latest/extras.json";

// ─── CSV parser ──────────────────────────────────────────────────────────────
function parseFlatCSV(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const parts = line.split(",");
    if (parts.length < 2) continue;
    // Last column is the value; everything else is the key path
    const value = parts[parts.length - 1].trim().replace(/^"|"$/g, "");
    const key   = parts.slice(0, -1).join("|").trim().replace(/^"|"$/g, "");
    if (key) result[key] = value;
  }
  return result;
}

function cleanNum(v: string | undefined): number {
  if (!v) return 0;
  const s = v.replace(/[$,%\s]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ─── Delinquency CSV ─────────────────────────────────────────────────────────
function parseDelinquency(text: string) {
  const map = parseFlatCSV(text);
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = map[k];
      if (v !== undefined) return v;
    }
    return undefined;
  };
  return {
    currentMonthCharges:          cleanNum(get("Performance|Current Month Charges $ - Current Period")),
    currentMonthDelinquency:      cleanNum(get("Performance|Current Month Delinquency $(%) - Current Period")),
    collectedOnAllOpenCharges:    cleanNum(get("Performance|Collected on All Open Charges $ - Current Period")),
    delinquencyAllOpenCharges:    cleanNum(get("Performance|Delinquency for All Open Charges $(%) - Current Period")),
    aiMessagesSent:               cleanNum(get("AI Performance|AI Messages Sent - Total")),
    emailMessagesCount:           cleanNum(get("AI Performance|Email Messages - Count")),
    smsMessagesCount:             cleanNum(get("AI Performance|SMS Messages - Count")),
    hoursSaved:                   cleanNum(get("AI Performance|Hours Saved")),
    emailEngagementRate:          cleanNum(get("Engagement|Email Engagement Rate (last 30 days)")),
    smsEngagementRate:            cleanNum(get("Engagement|SMS Engagement Rate (last 30 days)")),
    openTasksCount:               cleanNum(get("Residents Waiting for Agents' Response|Number of Open Tasks")),
    openTasksAmount:              cleanNum(get("Residents Waiting for Agents' Response|$ Associated with Open Tasks")),
    oldestTaskDays:               cleanNum(get("Residents Waiting for Agents' Response|Age of Oldest Task (Days)")),
    unresponsiveCount:            cleanNum(get("Residents Needing Agents' Attention|Unresponsive Residents - Count")),
    unresponsiveAmount:           cleanNum(get("Residents Needing Agents' Attention|Unresponsive Residents - Amount")),
    promiseToPayCount:            cleanNum(get("Residents Needing Agents' Attention|Promise to Pay - Count")),
    promiseToPayAmount:           cleanNum(get("Residents Needing Agents' Attention|Promise to Pay - Amount")),
  };
}

// ─── Maintenance CSV ─────────────────────────────────────────────────────────
function parseMaintenance(text: string) {
  const map: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const idx = line.indexOf(",");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().replace(/^"|"$/g, "");
    const val = line.slice(idx + 1).trim().replace(/^"|"$/g, "");
    if (key) map[key] = val;
  }
  const g = (k: string) => cleanNum(map[k]);
  return {
    totalWorkOrdersOpened:    g("Total Work Orders Opened"),
    aiWorkOrdersOpened:       g("AI Work Orders Opened"),
    outstandingWorkOrders:    g("Outstanding Work Orders"),
    workOrdersCompleted:      g("Work Orders Completed"),
    completionRatePct:        g("Completion Rate (%)"),
    completedWithin2DaysPct:  g("Completed Within 2 Days (%)"),
    medianTimeToCompleteDays: g("Median Time to Complete (Days)"),
    avgCompletionTimeDays:    g("Average Completion Time (Days)"),
    completedSameDay:         g("Completed Same Day"),
    completed1to2Days:        g("Completed 1-2 Days"),
    completed3to7Days:        g("Completed 3-7 Days"),
    completedOver7Days:       g("Completed Over 7 Days"),
    aiSubmissionPct:          g("AI Submission Percentage (%)"),
  };
}

// ─── Leasing Excel ───────────────────────────────────────────────────────────
function parseLeasing(buf: Buffer) {
  const wb    = XLSX.read(new Uint8Array(buf), { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];

  // Header row: ["", "", "Interests", "Leads", ...]
  const hdr = rows[0] as string[];
  const col = (name: string) => hdr.findIndex((h) => String(h).toLowerCase().includes(name.toLowerCase()));

  const cLeads   = col("leads");
  const cTours   = col("tours booked");
  const cAttend  = col("tours attended");
  const cApps    = col("application started");
  const cSigned  = col("leases signed");
  const cAIMsgs  = col("ai messages");
  const cHours   = col("hours saved");

  // Aggregate across all channel rows (skip header, sum numeric rows)
  let leads = 0, toursBooked = 0, toursAttended = 0, apps = 0, signed = 0, aiMessages = 0, hoursSaved = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const label = String(row[0] || "").toLowerCase();
    if (label === "grand total") continue; // skip summary row
    const n = (c: number) => c >= 0 ? Number(row[c]) || 0 : 0;
    leads         += n(cLeads);
    toursBooked   += n(cTours);
    toursAttended += n(cAttend);
    apps          += n(cApps);
    signed        += n(cSigned);
    aiMessages    += n(cAIMsgs);
    hoursSaved    += n(cHours);
  }

  return {
    leads, toursBooked, toursAttended,
    applicationsStarted: apps,
    leasesSigned: signed,
    aiMessages, hoursSaved,
    leadToSignedRate:  leads > 0 ? (signed / leads) * 100 : 0,
    tourToLeaseRate:   toursAttended > 0 ? (signed / toursAttended) * 100 : 0,
  };
}

// ─── Adaptive Blob put ────────────────────────────────────────────────────────
async function putAdaptive(path: string, body: Buffer, contentType: string) {
  const base = { addRandomSuffix: false, allowOverwrite: true, contentType };
  try {
    return await put(path, body, { ...base, access: "public" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/private store|private access/i.test(msg)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await put(path, body, { ...base, access: "private" as any });
    }
    throw err;
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob not configured." }, { status: 500 });
  }

  interface JsonFile { base64: string }
  function isJsonFile(v: unknown): v is JsonFile {
    return !!v && typeof v === "object" && typeof (v as JsonFile).base64 === "string";
  }

  let delinquencyText: string | null = null;
  let maintenanceText: string | null = null;
  let leasingBuf:      Buffer | null = null;
  let renovationData:  unknown       = null;

  try {
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      const json = (await req.json()) as Record<string, unknown>;
      if (isJsonFile(json.delinquency))
        delinquencyText = Buffer.from(json.delinquency.base64, "base64").toString("utf-8");
      if (isJsonFile(json.maintenance))
        maintenanceText = Buffer.from(json.maintenance.base64, "base64").toString("utf-8");
      if (isJsonFile(json.leasing))
        leasingBuf = Buffer.from(json.leasing.base64, "base64");
      if (json.renovation && typeof json.renovation === "object")
        renovationData = json.renovation;
    } else {
      const form = await req.formData();
      const d = form.get("delinquency");
      const m = form.get("maintenance");
      const l = form.get("leasing");
      if (d instanceof Blob) delinquencyText = await d.text();
      if (m instanceof Blob) maintenanceText = await m.text();
      if (l instanceof Blob) leasingBuf = Buffer.from(await l.arrayBuffer());
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse body." },
      { status: 400 }
    );
  }

  if (!delinquencyText && !maintenanceText && !leasingBuf && !renovationData) {
    return NextResponse.json({ error: "At least one of delinquency, maintenance, leasing, or renovation is required." }, { status: 400 });
  }

  try {
    // Load existing extras so we can merge (preserves fields not included in this upload)
    let existing: Record<string, unknown> = {};
    try {
      const { blobs } = await list({ prefix: "towne-east/latest/" });
      const blob = blobs.find((b) => b.pathname === EXTRAS_PATH);
      if (blob) {
        const res = await fetch(blob.url, {
          headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
          cache: "no-store",
        });
        if (res.ok) {
          const prev = await res.json() as { extras?: Record<string, unknown> };
          existing = prev.extras ?? {};
        }
      }
    } catch {}

    const extras: Record<string, unknown> = { ...existing };
    if (delinquencyText) extras.delinquency = parseDelinquency(delinquencyText);
    if (maintenanceText) extras.maintenance  = parseMaintenance(maintenanceText);
    if (leasingBuf)      extras.leasing      = parseLeasing(leasingBuf);
    if (renovationData)  extras.renovation   = renovationData;

    const uploadedAt = new Date().toISOString();
    await putAdaptive(EXTRAS_PATH, Buffer.from(JSON.stringify({ uploadedAt, extras })), "application/json");

    return NextResponse.json({ uploadedAt, fields: Object.keys(extras) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save extras." },
      { status: 500 }
    );
  }
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET() {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ extras: null, configured: false });

  try {
    const { blobs } = await list({ prefix: "towne-east/latest/" });
    const blob = blobs.find((b) => b.pathname === EXTRAS_PATH);
    if (!blob) return NextResponse.json({ extras: null, configured: true });

    const res = await fetch(blob.url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ extras: null, configured: true });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof BlobNotFoundError) return NextResponse.json({ extras: null, configured: true });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
