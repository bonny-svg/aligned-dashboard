"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import type { AppState } from "./types";
import { SAMPLE_STATE } from "./sampleData";

const AppStateContext = createContext<{
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
} | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(SAMPLE_STATE);

  // Persist to sessionStorage so state survives page navigations within session
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("alignedState");
      if (saved) {
        setState(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem("alignedState", JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  return (
    <AppStateContext.Provider value={{ state, setState }}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
