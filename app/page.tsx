"use client";

import { useState } from "react";
import { useAppState } from "@/lib/store";
import KPIBar from "@/components/dashboard/KPIBar";
import PropertyCard from "@/components/dashboard/PropertyCard";
import AddPropertyModal from "@/components/dashboard/AddPropertyModal";
import Link from "next/link";
import { UploadCloud, Plus } from "lucide-react";

export default function DashboardPage() {
  const { state } = useAppState();
  const [showAddModal, setShowAddModal] = useState(false);

  const totalUnits = state.properties.reduce((s, p) => s + p.units, 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {state.properties.length} properties · {totalUnits.toLocaleString()} total units
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Property</span>
          </button>
          <Link
            href="/import"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <UploadCloud className="h-4 w-4" />
            <span className="hidden sm:inline">Import CSV</span>
          </Link>
        </div>
      </div>

      {/* KPI bar */}
      <KPIBar />

      {/* Property grid */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Properties
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      </div>

      {state.properties.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <UploadCloud className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-700">No properties yet</h3>
          <p className="text-sm text-gray-500 mt-1">Add a property manually or import CSVs to get started.</p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Property
            </button>
            <Link href="/import" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              <UploadCloud className="h-4 w-4" /> Import CSV
            </Link>
          </div>
        </div>
      )}

      {showAddModal && <AddPropertyModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
