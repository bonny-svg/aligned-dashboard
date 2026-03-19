"use client";

import { useParams, useRouter } from "next/navigation";
import { useAppState } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { statusColor } from "@/lib/utils";
import { ArrowLeft, MapPin, Home, Layers } from "lucide-react";
import OverviewTab from "@/components/dashboard/tabs/OverviewTab";
import DelinquencyTab from "@/components/dashboard/tabs/DelinquencyTab";
import LeasingTab from "@/components/dashboard/tabs/LeasingTab";
import FinancialsTab from "@/components/dashboard/tabs/FinancialsTab";
import CapExTab from "@/components/dashboard/tabs/CapExTab";

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state } = useAppState();

  const property = state.properties.find((p) => p.id === id);

  if (!property) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Property not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const statColor = statusColor(property.status);

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Portfolio
      </button>

      {/* Property header */}
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{property.name}</h1>
              <Badge className={`${statColor} border text-sm px-3 py-0.5`}>{property.status}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                {property.address}, {property.city}, {property.state}
              </span>
              <span className="flex items-center gap-1">
                <Home className="h-4 w-4 flex-shrink-0" />
                {property.units} units
              </span>
              <span className="flex items-center gap-1">
                <Layers className="h-4 w-4 flex-shrink-0" />
                {property.platform} — {property.platformAccount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="delinquency">Delinquency</TabsTrigger>
          <TabsTrigger value="leasing">Leasing</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="capex">CapEx / Work Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab propertyId={id} />
        </TabsContent>
        <TabsContent value="delinquency">
          <DelinquencyTab propertyId={id} />
        </TabsContent>
        <TabsContent value="leasing">
          <LeasingTab propertyId={id} />
        </TabsContent>
        <TabsContent value="financials">
          <FinancialsTab propertyId={id} />
        </TabsContent>
        <TabsContent value="capex">
          <CapExTab propertyId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
