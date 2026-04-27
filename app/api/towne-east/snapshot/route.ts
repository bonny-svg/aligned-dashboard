// Stores and serves Towne East's three OneSite files via Vercel Blob.
// Follows the same pattern as /api/grove/snapshot.
//
// POST accepts:
//   A) multipart/form-data with fields { rentRoll, availability, residentBalances }
//   B) application/json with { rentRoll: {base64}, availability: {base64}, residentBalances: {base64} }
//
// GET returns { snapshot, configured } where snapshot includes a metricsUrl
// that the client uses to skip the 3 Excel downloads entirely.

import { NextRequest, NextResponse } from "next/server";
import { put, list, BlobNotFoundError } from "@vercel/blob";
import { parseRentRoll, parseAvailability, parseResidentBalances } from "@/lib/grove-parsers";
import { computeTowneEastMetrics } from "@/lib/towne-east-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILES = {
  rentRoll:         "towne-east/latest/rent-roll.xls",
  availability:     "towne-east/latest/availability.xls",
  residentBalances: "towne-east/latest/resident-balances.xls",
  metrics:          "towne-east/latest/metrics.json",
} as const;

interface JsonFile { filename?: string; base64: string }
function isJsonFile(v: unknown): v is JsonFile {
  return !!v && typeof v === "object" && typeof (v as JsonFile).base64 === "string";
}

async function putAdaptive(path: string, body: Buffer | Blob, contentType: string) {
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

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Vercel Blob not configured. Set BLOB_READ_WRITE_TOKEN." },
      { status: 500 }
    );
  }

  const required = process.env.TOWNE_EAST_UPLOAD_KEY;
  const provided  = req.headers.get("x-upload-key");
  if (required && provided && provided !== required) {
    return NextResponse.json({ error: "Invalid x-upload-key." }, { status: 401 });
  }

  let rentRollBody: Buffer | Blob;
  let availabilityBody: Buffer | Blob;
  let residentBalancesBody: Buffer | Blob;

  try {
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("application/json")) {
      const json = (await req.json()) as Record<string, unknown>;
      if (!isJsonFile(json.rentRoll) || !isJsonFile(json.availability) || !isJsonFile(json.residentBalances)) {
        return NextResponse.json(
          { error: "JSON body must have { rentRoll, availability, residentBalances }, each with a base64 field." },
          { status: 400 }
        );
      }
      rentRollBody         = Buffer.from(json.rentRoll.base64,         "base64");
      availabilityBody     = Buffer.from(json.availability.base64,     "base64");
      residentBalancesBody = Buffer.from(json.residentBalances.base64, "base64");
    } else {
      const form = await req.formData();
      const rr = form.get("rentRoll");
      const av = form.get("availability");
      const rb = form.get("residentBalances");
      if (!(rr instanceof Blob) || !(av instanceof Blob) || !(rb instanceof Blob)) {
        return NextResponse.json(
          { error: "All three files (rentRoll, availability, residentBalances) are required." },
          { status: 400 }
        );
      }
      rentRollBody = rr;
      availabilityBody = av;
      residentBalancesBody = rb;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse request body." },
      { status: 400 }
    );
  }

  try {
    const [rrBuf, avBuf, rbBuf] = [
      Buffer.isBuffer(rentRollBody)         ? rentRollBody         : Buffer.from(await (rentRollBody as Blob).arrayBuffer()),
      Buffer.isBuffer(availabilityBody)     ? availabilityBody     : Buffer.from(await (availabilityBody as Blob).arrayBuffer()),
      Buffer.isBuffer(residentBalancesBody) ? residentBalancesBody : Buffer.from(await (residentBalancesBody as Blob).arrayBuffer()),
    ];

    const toAB = (b: Buffer): ArrayBuffer =>
      b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

    const metrics = computeTowneEastMetrics(
      parseRentRoll(toAB(rrBuf)),
      parseAvailability(toAB(avBuf)),
      parseResidentBalances(toAB(rbBuf))
    );
    const uploadedAt     = new Date().toISOString();
    const metricsPayload = JSON.stringify({ uploadedAt, metrics });

    const [rr, av, rb] = await Promise.all([
      putAdaptive(FILES.rentRoll,         rrBuf,  "application/vnd.ms-excel"),
      putAdaptive(FILES.availability,     avBuf,  "application/vnd.ms-excel"),
      putAdaptive(FILES.residentBalances, rbBuf,  "application/vnd.ms-excel"),
      putAdaptive(FILES.metrics, Buffer.from(metricsPayload), "application/json"),
    ]);

    return NextResponse.json({
      uploadedAt,
      urls: { rentRoll: rr.url, availability: av.url, residentBalances: rb.url },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Blob write failed." },
      { status: 500 }
    );
  }
}

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ snapshot: null, configured: false });
  }

  try {
    const { blobs } = await list({ prefix: "towne-east/latest/" });
    const rr = blobs.find((b) => b.pathname === FILES.rentRoll);
    const av = blobs.find((b) => b.pathname === FILES.availability);
    const rb = blobs.find((b) => b.pathname === FILES.residentBalances);
    const mx = blobs.find((b) => b.pathname === FILES.metrics);

    if (!rr || !av || !rb) {
      return NextResponse.json({ snapshot: null, configured: true });
    }

    const uploadedAt = [rr, av, rb]
      .map((b) => new Date(b.uploadedAt).getTime())
      .reduce((a, b) => Math.max(a, b), 0);

    return NextResponse.json({
      snapshot: {
        uploadedAt: new Date(uploadedAt).toISOString(),
        metricsUrl: mx ? "/api/towne-east/file/metrics" : null,
        urls: {
          rentRoll:         "/api/towne-east/file/rentRoll",
          availability:     "/api/towne-east/file/availability",
          residentBalances: "/api/towne-east/file/residentBalances",
        },
      },
      configured: true,
    });
  } catch (err) {
    if (err instanceof BlobNotFoundError) {
      return NextResponse.json({ snapshot: null, configured: true });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load snapshot" },
      { status: 500 }
    );
  }
}
