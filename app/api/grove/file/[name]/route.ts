// Streams one of the 3 Grove OneSite files from Vercel Blob to the browser.
//
// Why a proxy: the Blob store is private, so the URLs list() returns require
// an Authorization: Bearer <BLOB_READ_WRITE_TOKEN> header. Browsers can't
// include that header when fetching a cross-origin URL, so direct fetches
// return 403. This route fetches server-side (where the env var lives) and
// streams the bytes back to the client.

import { NextRequest, NextResponse } from "next/server";
import { list } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILES: Record<string, { path: string; contentType: string }> = {
  rentRoll:         { path: "grove/latest/rent-roll.xls",         contentType: "application/vnd.ms-excel" },
  availability:     { path: "grove/latest/availability.xls",      contentType: "application/vnd.ms-excel" },
  residentBalances: { path: "grove/latest/resident-balances.xls", contentType: "application/vnd.ms-excel" },
  metrics:          { path: "grove/latest/metrics.json",          contentType: "application/json" },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { name: string } }
) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Blob not configured." }, { status: 500 });
  }

  const file = FILES[params.name];
  if (!file) {
    return NextResponse.json({ error: "Unknown file key." }, { status: 404 });
  }

  try {
    const { blobs } = await list({ prefix: "grove/latest/" });
    const blob = blobs.find((b) => b.pathname === file.path);
    if (!blob) {
      return NextResponse.json({ error: "File not found in Blob store." }, { status: 404 });
    }

    const upstream = await fetch(blob.url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `Upstream fetch failed (${upstream.status})` },
        { status: 502 }
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
