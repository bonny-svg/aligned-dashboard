"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatPct } from "@/lib/utils";
import { TrendingUp, TrendingDown, AlertTriangle, Clock, ArrowRight } from "lucide-react";

interface PropertyLiveData {
  name: string;
  href: string;
  units: number;
  uploadedAt: string | null;
  physicalOccupancyPct: number;
  economicOccupancyPct: number;
  collectedMTD: number;
  gpr: number;
  delinquentBalance: number;
  delinquentCount: number;
  signedLeasesMTD: number;
  moveOutsNTVCount: number;
  rentReadyCount: number;
  vacantTotalCount: number;
}

async function loadProperty(
  snapshotEndpoint: string,
  meta: { name: string; href: string }
): Promise<PropertyLiveData | null> {
  try {
    const snapRes = await fetch(snapshotEndpoint, { cache: "no-store" });
    if (!snapRes.ok) return null;
    const snap = await snapRes.json();
    const metricsUrl: string | null = snap?.snapshot?.metricsUrl ?? null;
    const uploadedAt: string | null = snap?.snapshot?.uploadedAt ?? null;
    if (!metricsUrl) return null;

    const mRes = await fetch(metricsUrl, { cache: "no-store" });
    if (!mRes.ok) return null;
    const m = await mRes.json();

    return {
      name: meta.name,
      href: meta.href,
      units: m.unitCount ?? 0,
      uploadedAt,
      physicalOccupancyPct: m.physicalOccupancyPct ?? 0,
      economicOccupancyPct: m.economicOccupancyPct ?? 0,
      // Grove uses collectedMTD/totalChargesMTD; TE uses totalCollected/gpr
      collectedMTD:      m.collectedMTD      ?? m.totalCollected ?? 0,
      gpr:               m.totalChargesMTD   ?? m.gpr            ?? 0,
      delinquentBalance: m.totalDelinquent   ?? m.delinquentBalance ?? 0,
      delinquentCount:   m.delinquentCount   ?? 0,
      signedLeasesMTD:   m.signedLeasesMTD   ?? 0,
      moveOutsNTVCount:  m.moveOutsCount      ?? m.moveOutsNTVCount ?? 0,
      rentReadyCount:    m.rentReadyCount     ?? 0,
      vacantTotalCount:  m.vacantTotalCount   ?? m.vacantCount ?? 0,
    };
  } catch { return null; }
}

function relTime(iso: string | null): string {
  if (!iso) return "No data";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Updated just now";
  if (h < 24) return `Updated ${h}h ago`;
  const d = Math.floor(h / 24);
  return `Updated ${d}d ago`;
}

function StatRow({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: "up" | "down" | "neutral" }) {
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;
  const color = trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-gray-900";
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold flex items-center gap-1 justify-end ${color}`}>
          {Icon && <Icon className="h-3 w-3" />}
          {value}
        </span>
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
      </div>
    </div>
  );
}

function PropertyCard({ d }: { d: PropertyLiveData }) {
  const collPct   = d.gpr > 0 ? (d.collectedMTD / d.gpr) * 100 : 0;
  const occ       = d.physicalOccupancyPct;
  const econ      = d.economicOccupancyPct;
  const staleness = relTime(d.uploadedAt);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 text-base">{d.name}</h3>
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <Clock className="h-3 w-3" />{staleness}
          </p>
        </div>
        <Link
          href={d.href}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          Full report <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="px-5 py-3">
        {/* Occupancy */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Occupancy</p>
        <StatRow
          label="Physical"
          value={formatPct(occ / 100)}
          trend={occ >= 93 ? "up" : occ >= 85 ? "neutral" : "down"}
        />
        <StatRow
          label="Economic"
          value={formatPct(econ / 100)}
          sub="lease rent ÷ market rent"
          trend={econ >= 90 ? "up" : econ >= 80 ? "neutral" : "down"}
        />

        {/* Collections */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-1">Collections</p>
        <StatRow
          label="Collected MTD"
          value={formatCurrency(d.collectedMTD)}
          sub={`${formatPct(collPct / 100)} of ${formatCurrency(d.gpr)} GPR`}
          trend={collPct >= 95 ? "up" : collPct >= 85 ? "neutral" : "down"}
        />
        <StatRow
          label="Delinquent Balance"
          value={formatCurrency(d.delinquentBalance)}
          sub={`${d.delinquentCount} residents`}
          trend={d.delinquentBalance < 5000 ? "up" : d.delinquentBalance < 15000 ? "neutral" : "down"}
        />

        {/* Leasing */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-1">Leasing</p>
        <StatRow
          label="Signed Leases MTD"
          value={d.signedLeasesMTD.toString()}
          trend={d.signedLeasesMTD > 0 ? "up" : "neutral"}
        />
        <StatRow
          label="Move-outs / NTV"
          value={d.moveOutsNTVCount.toString()}
          trend={d.moveOutsNTVCount === 0 ? "up" : d.moveOutsNTVCount <= 3 ? "neutral" : "down"}
        />

        {/* Make-ready */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-3 mb-1">Make-ready</p>
        <StatRow
          label="Rent Ready"
          value={`${d.rentReadyCount} of ${d.vacantTotalCount} vacant`}
          trend={d.vacantTotalCount === 0 || d.rentReadyCount === d.vacantTotalCount ? "up" : "neutral"}
        />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden animate-pulse">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-24" />
      </div>
      <div className="px-5 py-3 space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3 bg-gray-100 rounded w-28" />
            <div className="h-3 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LivePortfolioSection() {
  const [grove, setGrove] = useState<PropertyLiveData | null | "loading">("loading");
  const [te, setTe]       = useState<PropertyLiveData | null | "loading">("loading");

  useEffect(() => {
    loadProperty("/api/grove/snapshot",      { name: "The Grove",           href: "/the-grove"   }).then(setGrove);
    loadProperty("/api/towne-east/snapshot", { name: "Towne East Village",  href: "/towne-east"  }).then(setTe);
  }, []);

  const hasAny = grove !== null || te !== null;

  if (grove === null && te === null) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Live Property Metrics
        </h2>
        {(grove !== "loading" && grove) || (te !== "loading" && te) ? (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
            Live data
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {grove === "loading" ? <SkeletonCard /> : grove ? <PropertyCard d={grove} /> : null}
        {te    === "loading" ? <SkeletonCard /> : te    ? <PropertyCard d={te}    /> : null}
      </div>
    </div>
  );
}
