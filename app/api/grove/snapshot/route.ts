// Stores and serves The Grove's three OneSite .xls files via Vercel Blob.
// Clients POST multipart with fields { rentRoll, availability, residentBalances }.
// GET returns the URLs + upload timestamp for the most-recent snapshot.

import { NextRequest, NextResponse } from "next/server";
import { put, list, BlobNotFoundError } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fixed-path strategy: we always overwrite the single "latest" snapshot.
// Hex-suffix keeps Blob happy with addRandomSuffix: false while remaining stable.
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

export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Vercel Blob not configured. Set BLOB_READ_WRITE_TOKEN in your Vercel project." },
      { status: 500 }
    );
  }

  const form = await req.formData();
  const rentRoll = form.get("rentRoll");
  const availability = form.get("availability");
  const residentBalances = form.get("residentBalances");

  if (!(rentRoll instanceof Blob) || !(availability instanceof Blob) || !(residentBalances instanceof Blob)) {
    return NextResponse.json(
      { error: "All three files (rentRoll, availability, residentBalances) are required." },
      { status: 400 }
    );
  }

  const common = {
    access: "public" as const,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/vnd.ms-excel",
  };

  const [rrBlob, avBlob, rbBlob] = await Promise.all([
    put(FILES.rentRoll, rentRoll, common),
    put(FILES.availability, availability, common),
    put(FILES.residentBalances, residentBalances, common),
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
