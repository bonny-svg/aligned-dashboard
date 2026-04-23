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
//      — used by the Apps Script agent; base64 avoids the multipart parsing
//      quirks we hit trying to build a form-data body from Apps Script.
//
// GET returns the URLs + upload timestamp for the most-recent snapshot.

import { NextRequest, NextResponse } from "next/server";
import { put, list, BlobNotFoundError } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILES = {
  rentRoll: "grove/latest/rent-roll.xls",
  availability: "grove/latest/availability.xls",
  residentBalances: "grove/latest/resident-balances.xls",
  meta: "grove/latest/meta.json",
} as const;

interface Meta {
  uploadedAt: string;
  urls: {
    rentRoll: string;
    availability: string;
    residentBalances: string;
  };
}

interface JsonFile {
  filename?: string;
  base64: string;
}

function isJsonFile(v: unknown): v is JsonFile {
  return !!v && typeof v === "object" && typeof (v as JsonFile).base64 === "string";
}

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Vercel Blob not configured. Set BLOB_READ_WRITE_TOKEN in your Vercel project." },
      { status: 500 }
    );
  }

  // Optional auth for programmatic callers — only enforced if the header is
  // provided, so the same-origin browser drag-drop keeps working unchanged.
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

  const common = {
    access: "public" as const,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/vnd.ms-excel",
  };

  try {
    const [rrBlob, avBlob, rbBlob] = await Promise.all([
      put(FILES.rentRoll, rentRollBody, common),
      put(FILES.availability, availabilityBody, common),
      put(FILES.residentBalances, residentBalancesBody, common),
    ]);

    const meta: Meta = {
      uploadedAt: new Date().toISOString(),
      urls: {
        rentRoll: rrBlob.url,
        availability: avBlob.url,
        residentBalances: rbBlob.url,
      },
    };

    await put(FILES.meta, JSON.stringify(meta), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });

    return NextResponse.json(meta);
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
    const metaBlob = blobs.find((b) => b.pathname === FILES.meta);
    if (!metaBlob) {
      return NextResponse.json({ snapshot: null, configured: true });
    }

    const metaRes = await fetch(metaBlob.url, { cache: "no-store" });
    if (!metaRes.ok) return NextResponse.json({ snapshot: null, configured: true });

    const meta = (await metaRes.json()) as Meta;
    return NextResponse.json({ snapshot: meta, configured: true });
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
