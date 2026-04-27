// Stores and serves The Grove's three OneSite .xls files via Vercel Blob.
//
// POST accepts two shapes:
//   A) multipart/form-data with fields { rentRoll, availability, residentBalances }
//      — used by the browser drag-and-drop on /the-grove
//   B) application/json with {
//        rentRoll:         { filename, base64 },
//        availability:     { filename, base64 },
//        residentBalances: { filename, base64 }
//      }
//      — used by the Apps Script agent; base64 avoids multipart parsing quirks.
//
// Files are written with access:"public" if the store allows it; otherwise
// "private" (the default for newer Vercel Blob stores). GET regenerates fresh
// URLs via list() on every request so private-store signed URLs never stale.

import { NextRequest, NextResponse } from "next/server";
import { put, list, BlobNotFoundError } from "@vercel/blob";
import { parseRentRoll, parseAvailability, parseResidentBalances } from "@/lib/grove-parsers";
import { computeMetrics } from "@/lib/grove-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILES = {
  rentRoll:         "grove/latest/rent-roll.xls",
  availability:     "grove/latest/availability.xls",
  residentBalances: "grove/latest/resident-balances.xls",
  metrics:          "grove/latest/metrics.json",
} as const;

interface JsonFile { filename?: string; base64: string }
function isJsonFile(v: unknown): v is JsonFile {
  return !!v && typeof v === "object" && typeof (v as JsonFile).base64 === "string";
}

// Vercel Blob's `access` param must match the store's access mode.
// Newer stores are private-only; older are public-only. Try public first;
// if the store rejects it with the specific "private store" error, retry as
// private. Avoids forcing a hard-coded value that only works on one store type.
async function putAdaptive(path: string, body: Buffer | Blob, contentType: string) {
  const base = {
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
  };
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
      { error: "Vercel Blob not configured. Set BLOB_READ_WRITE_TOKEN in your Vercel project." },
      { status: 500 }
    );
  }

  // Optional auth for programmatic callers — only enforced if the header is
  // provided, so same-origin browser drag-drop keeps working unchanged.
  const required = process.env.GROVE_UPLOAD_KEY;
  const provided = req.headers.get("x-upload-key");
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
          { error: "JSON body must have {rentRoll, availability, residentBalances}, each with a base64 field." },
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
    // Store the 3 Excel files and compute metrics in parallel where possible.
    const [rrBuf, avBuf, rbBuf] = [
      Buffer.isBuffer(rentRollBody)         ? rentRollBody         : Buffer.from(await (rentRollBody as Blob).arrayBuffer()),
      Buffer.isBuffer(availabilityBody)     ? availabilityBody     : Buffer.from(await (availabilityBody as Blob).arrayBuffer()),
      Buffer.isBuffer(residentBalancesBody) ? residentBalancesBody : Buffer.from(await (residentBalancesBody as Blob).arrayBuffer()),
    ];

    // Compute metrics server-side so the client only needs to fetch JSON.
    // Slice each buffer to get a true ArrayBuffer (Node Buffer.buffer may be pooled/shared).
    const toAB = (b: Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    const metrics = computeMetrics(
      parseRentRoll(toAB(rrBuf)),
      parseAvailability(toAB(avBuf)),
      parseResidentBalances(toAB(rbBuf))
    );
    const uploadedAt = new Date().toISOString();
    const metricsPayload = JSON.stringify({ uploadedAt, metrics });

    const [rr, av, rb] = await Promise.all([
      putAdaptive(FILES.rentRoll,         rrBuf,  "application/vnd.ms-excel"),
      putAdaptive(FILES.availability,     avBuf,  "application/vnd.ms-excel"),
      putAdaptive(FILES.residentBalances, rbBuf,  "application/vnd.ms-excel"),
      putAdaptive(FILES.metrics, Buffer.from(metricsPayload), "application/json"),
    ]);

    return NextResponse.json({ uploadedAt, urls: { rentRoll: rr.url, availability: av.url, residentBalances: rb.url } });
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
    const { blobs } = await list({ prefix: "grove/latest/" });
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
        // metricsUrl is present when the JSON was pre-computed at upload time.
        // The client uses it directly and skips the 3 Excel downloads entirely.
        metricsUrl: mx ? "/api/grove/file/metrics" : null,
        urls: {
          rentRoll:         "/api/grove/file/rentRoll",
          availability:     "/api/grove/file/availability",
          residentBalances: "/api/grove/file/residentBalances",
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
