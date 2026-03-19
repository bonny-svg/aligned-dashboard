"use client";

import { useState } from "react";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { Platform, PropertyStatus } from "@/lib/types";

const PLATFORMS: Platform[] = ["AppFolio", "RealPage", "Resman"];
const STATUSES: PropertyStatus[] = ["Active", "Stabilizing", "Remediation", "Under Contract"];

interface Props {
  onClose: () => void;
}

export default function AddPropertyModal({ onClose }: Props) {
  const { setState } = useAppState();
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    units: "",
    platform: "AppFolio" as Platform,
    platformAccount: "",
    status: "Active" as PropertyStatus,
  });
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const units = parseInt(form.units);
    if (!form.name.trim()) { setError("Property name is required."); return; }
    if (!form.city.trim() || !form.state.trim()) { setError("City and state are required."); return; }
    if (isNaN(units) || units < 1) { setError("Enter a valid unit count."); return; }

    const id = form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    setState((prev) => ({
      ...prev,
      properties: [
        ...prev.properties,
        {
          id: `${id}-${Date.now()}`,
          name: form.name.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim().toUpperCase(),
          units,
          occupancyPct: 0,
          collectedMTD: 0,
          delinquencyPct: 0,
          status: form.status,
          platform: form.platform,
          platformAccount: form.platformAccount.trim(),
        },
      ],
    }));
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Add Property</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Property Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Sunset Ridge Apartments"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="e.g. 123 Main St"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* City / State */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Austin"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
                placeholder="TX"
                maxLength={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Units */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Units *</label>
            <input
              type="number"
              min={1}
              value={form.units}
              onChange={(e) => set("units", e.target.value)}
              placeholder="48"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Platform + Account */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PM Platform</label>
              <select
                value={form.platform}
                onChange={(e) => set("platform", e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account / Portfolio</label>
              <input
                type="text"
                value={form.platformAccount}
                onChange={(e) => set("platformAccount", e.target.value)}
                placeholder="e.g. G&C, TX-East"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Add Property
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
