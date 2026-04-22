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

function mergeSheetData(state: AppState, sheets: SheetsSummary): AppState {
  const updatedProperties = state.properties.map(prop => {
    const rr   = sheets.rentRoll[prop.id];
    const del  = sheets.delinquency[prop.id];
    const fin  = sheets.financials[prop.id];
    const avl  = sheets.availability[prop.id];
    const wo   = sheets.work_orders[prop.id];
    if (!rr && !del && !fin && !avl && !wo) return prop;

    const occupancyPct = rr?.occupancy_pct
      ? parseFloat(rr.occupancy_pct) <= 1
        ? parseFloat(rr.occupancy_pct) * 100
        : parseFloat(rr.occupancy_pct)
      : prop.occupancyPct;

    const collectedMTD = rr?.rent_collected
      ? parseFloat(rr.rent_collected)
      : prop.collectedMTD;

    const totalDelinquent = del?.total_delinquent_amt ? parseFloat(del.total_delinquent_amt) : null;
    const gpr = fin?.gross_potential_rent ? parseFloat(fin.gross_potential_rent) : null;
    const delinquencyPct = totalDelinquent != null && gpr != null && gpr > 0
      ? (totalDelinquent / gpr) * 100
      : prop.delinquencyPct;

    const noi = fin?.noi ? parseFloat(fin.noi) : undefined;
    const reportMonth = fin?.report_month || rr?.report_month || undefined;

    // Most recent received_date across any report tab — the "last time we heard anything"
    const receivedTimes = [rr, del, fin, avl, wo]
      .map(r => r?.received_date)
      .filter((s): s is string => !!s)
      .map(s => new Date(s).getTime())
      .filter(t => !isNaN(t));
    const lastDataPulled = receivedTimes.length
      ? new Date(Math.max(...receivedTimes)).toISOString()
      : undefined;

    return {
      ...prop,
      occupancyPct,
      collectedMTD,
      delinquencyPct,
      ...(noi !== undefined ? { lastNOI: noi } : {}),
      ...(reportMonth !== undefined ? { lastReportMonth: reportMonth } : {}),
      ...(lastDataPulled !== undefined ? { lastDataPulled } : {}),
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
