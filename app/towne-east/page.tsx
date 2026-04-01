"use client";

import { useState, useCallback } from "react";
import { MapPin, Home, Clock, CheckCircle2, AlertCircle, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import RenovationSection from "@/components/RenovationSection";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type Month = "mar" | "feb" | "jan";

interface FinRow {
  label: string;
  actual: number;
  budget: number;
  isSummary?: boolean;
  isExpense?: boolean;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function varStr(v: number): string {
  if (Math.abs(v) < 0.5) return "—";
  return `${v > 0 ? "+" : ""}${fmt(v)}`;
}

function varColor(v: number, isExpense = false): string {
  if (Math.abs(v) < 0.5) return "text-gray-400";
  const good = isExpense ? v < 0 : v > 0;
  return good ? "text-emerald-600" : "text-red-500";
}

function sum(rows: FinRow[]): { actual: number; budget: number } {
  return rows.reduce(
    (acc, r) => ({ actual: acc.actual + r.actual, budget: acc.budget + r.budget }),
    { actual: 0, budget: 0 }
  );
}

// ─── PLACEHOLDER DATA ─────────────────────────────────────────────────────────

const INCOME: Record<Month, FinRow[]> = {
  mar: [
    { label: "Gross Potential Rent",   actual:  89_000, budget:  89_000 },
    { label: "Vacancy Loss",           actual:  -7_120, budget:  -5_340 },
    { label: "Loss to Lease",          actual:  -2_670, budget:  -1_780 },
    { label: "Concessions",            actual:    -890, budget:    -445 },
    { label: "Delinquency",            actual:  -3_560, budget:  -1_780 },
    { label: "Late Fees",              actual:   1_245, budget:   1_000 },
    { label: "Other Income",           actual:   2_100, budget:   1_800 },
  ],
  feb: [
    { label: "Gross Potential Rent",   actual:  89_000, budget:  89_000 },
    { label: "Vacancy Loss",           actual:  -6_230, budget:  -5_340 },
    { label: "Loss to Lease",          actual:  -2_450, budget:  -1_780 },
    { label: "Concessions",            actual:    -500, budget:    -445 },
    { label: "Delinquency",            actual:  -2_890, budget:  -1_780 },
    { label: "Late Fees",              actual:   1_100, budget:   1_000 },
    { label: "Other Income",           actual:   1_950, budget:   1_800 },
  ],
  jan: [
    { label: "Gross Potential Rent",   actual:  89_000, budget:  89_000 },
    { label: "Vacancy Loss",           actual:  -5_340, budget:  -5_340 },
    { label: "Loss to Lease",          actual:  -1_780, budget:  -1_780 },
    { label: "Concessions",            actual:    -445, budget:    -445 },
    { label: "Delinquency",            actual:  -1_780, budget:  -1_780 },
    { label: "Late Fees",              actual:     980, budget:   1_000 },
    { label: "
