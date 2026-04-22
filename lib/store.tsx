"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { AppState } from "./types";
import { SAMPLE_STATE } from "./sampleData";
import { fetchSheetsSummary } from "./sheets";
import type { SheetsSummary } from "./sheets";

const AppStateContext = createContext<{
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  sheetsLoading: boolean;
} | null>(null);

function num(v: string | undefined): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

/** Normalize 0-1 or 0-100 occupancy values to 0-100 display scale. */
function toPct(v: number | null): number | null {
  if (v == null) return null;
  return v <= 1 ? v * 100 : v;
}

function mergeSheetData(state: AppState, sheets: SheetsSummary): AppState {
  const updatedProperties = state.properties.map(prop => {
    const s = sheets.snapshot[prop.id];
    const f = sheets.financials[prop.id];
    if (!s && !f) return prop;

    // Core KPIs — prefer snapshot (weekly/daily freshness), fall back to sample
    const physicalOcc   = toPct(num(s?.physical_occupancy_pct));
    const economicOcc   = toPct(num(s?.economic_occupancy_pct));
    const projectedOcc  = toPct(num(s?.projected_occupancy_pct));

    const occupancyPct = physicalOcc ?? prop.occupancyPct;
    const collectedMTD = num(s?.collected_mtd) ?? prop.collectedMTD;
    const expectedMTD  = num(s?.expected_mtd);

    // Delinquency — prefer direct delinquent_total / GPR (monthly), else snapshot total
    const totalDelinquent = num(s?.delinquent_total);
    const gpr             = num(f?.gross_potential_rent);
    const delinquencyPct  = totalDelinquent != null && gpr != null && gpr > 0
      ? (totalDelinquent / gpr) * 100
      : prop.delinquencyPct;

    const noi         = num(f?.noi) ?? undefined;
    const reportMonth = f?.report_month || undefined;

    // Renewal pipeline & operational signals
    const leasesExpiring30  = num(s?.leases_expiring_30d) ?? 0;
    const leasesExpiring60  = num(s?.leases_expiring_60d) ?? 0;
    const leasesExpiring90  = num(s?.leases_expiring_90d) ?? 0;
    const ntvUnits          = num(s?.ntv_units) ?? 0;
    const preleasedUnits    = num(s?.preleased_units) ?? 0;
    const lossToLease       = num(s?.loss_to_lease_amt) ?? 0;
    const mtomUnits         = num(s?.mtom_units) ?? 0;

    // Budget variance (financials)
    const budgetVarPct      = num(f?.budget_variance_pct) ?? null;
    const budgetVarAmt      = num(f?.budget_variance_amt) ?? null;

    // Narrative
    const pmFocus          = s?.pm_focus || '';
    const activeProjects   = s?.active_projects || '';
    const currentSpecial   = s?.current_special || '';

    // Last time we heard anything
    const receivedTimes = [s?.received_date, f?.received_date]
      .filter((d): d is string => !!d)
      .map(d => new Date(d).getTime())
      .filter(t => !isNaN(t));
    const lastDataPulled = receivedTimes.length
      ? new Date(Math.max(...receivedTimes)).toISOString()
      : undefined;

    return {
      ...prop,
      occupancyPct,
      collectedMTD,
      delinquencyPct,
      ...(economicOcc !== null ? { economicOccupancyPct: economicOcc } : {}),
      ...(projectedOcc !== null ? { projectedOccupancyPct: projectedOcc } : {}),
      ...(expectedMTD !== null ? { expectedMTD } : {}),
      ...(noi !== undefined ? { lastNOI: noi } : {}),
      ...(reportMonth !== undefined ? { lastReportMonth: reportMonth } : {}),
      ...(lastDataPulled !== undefined ? { lastDataPulled } : {}),
      leasesExpiring30, leasesExpiring60, leasesExpiring90,
      ntvUnits, preleasedUnits, lossToLease, mtomUnits,
      ...(budgetVarPct != null ? { budgetVariancePct: budgetVarPct } : {}),
      ...(budgetVarAmt != null ? { budgetVarianceAmt: budgetVarAmt } : {}),
      pmFocus, activeProjects, currentSpecial,
    };
  });
  return { ...state, properties: updatedProperties };
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState]           = useState<AppState>(SAMPLE_STATE);
  const [sheetsLoading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("alignedState");
      if (saved) setState(JSON.parse(saved));
    } catch { }
  }, []);

  useEffect(() => {
    async function loadSheets() {
      try {
        const sheets = await fetchSheetsSummary();
        if (sheets) setState(prev => mergeSheetData(prev, sheets));
      } catch (e) {
        console.error('Sheets merge error:', e);
      } finally {
        setLoading(false);
      }
    }
    loadSheets();
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem("alignedState", JSON.stringify(state));
    } catch { }
  }, [state]);

  return (
    <AppStateContext.Provider value={{ state, setState, sheetsLoading }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
