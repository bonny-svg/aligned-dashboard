"use client";

import { useState } from "react";
import { useAppState } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Props {
  propertyId: string;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
}

function aggActual(items: { category: string; actual: number }[], cat: string): number {
  return items.filter((f) => f.category === cat).reduce((s, f) => s + f.actual, 0);
}

function aggBudget(items: { category: string; budget: number }[], cat: string): number {
  return items.filter((f) => f.category === cat).reduce((s, f) => s + f.budget, 0);
}

export default function FinancialsTab({ propertyId }: Props) {
  const { state } = useAppState();

  const allFinancials = state.financials.filter((f) => f.propertyId === propertyId);

  // Include months that have either actuals OR budgets
  const months = Array.from(new Set(
    allFinancials
      .filter((f) => !f.isNOI && (f.actual !== 0 || f.budget !== 0))
      .map((f) => f.month)
  )).sort((a, b) => b.localeCompare(a));

  const [month, setMonth] = useState(months[0] ?? "");

  const items = allFinancials.filter((f) => f.month === month && !f.isNOI);

  const isBudgetOnlyMonth = items.length > 0 && items.every((f) => f.budgetOnly);

  const incomeItems       = items.filter((f) => f.category === "Income");
  const expenseItems      = items.filter((f) => f.category === "Expenses");
  const capexItems        = items.filter((f) => f.category === "CapEx");
  const debtItems         = items.filter((f) => f.category === "Debt Service");
  const profFeeItems      = items.filter((f) => f.category === "Professional Fees");
  const netIncomeItem     = items.find((f) => f.isNetCashFlow);

  const totalIncome       = aggActual(items, "Income");
  const totalExpenses     = aggActual(items, "Expenses");
  const totalCapex        = aggActual(items, "CapEx");
  const totalDebt         = aggActual(items, "Debt Service");
  const totalProfFees     = aggActual(items, "Professional Fees");

  const totalIncomeBudget   = aggBudget(items, "Income");
  const totalExpensesBudget = aggBudget(items, "Expenses");

  const noi               = totalIncome - totalExpenses;
  const noiBudgetCalc     = totalIncomeBudget - totalExpensesBudget;
  const cashFlow          = netIncomeItem
    ? netIncomeItem.actual
    : noi - totalCapex - totalDebt - totalProfFees;

  const hasBelowLine      = totalCapex + totalDebt + totalProfFees > 0 || !!netIncomeItem;
  const hasBudget         = items.some((f) => f.budget !== 0);
  const hasVariance       = items.some((f) => f.variance != null);

  const colSpan           = (hasBudget ? 4 : 2) + (hasVariance ? 1 : 0);

  // KPI display values — use budget totals for budget-only months
  const displayIncome   = isBudgetOnlyMonth ? totalIncomeBudget   : totalIncome;
  const displayExpenses = isBudgetOnlyMonth ? totalExpensesBudget : totalExpenses;
  const displayNOI      = isBudgetOnlyMonth ? noiBudgetCalc       : noi;
  const displayCF       = isBudgetOnlyMonth ? noiBudgetCalc       : cashFlow;

  function renderLineItem(item: typeof items[0], isExpense = false) {
    if (item.budgetOnly) {
      return (
        <tr
          key={`${item.lineItem}-${item.accountNumber ?? item.month}`}
          className="border-t border-gray-100 hover:bg-gray-50"
        >
          <td className="px-4 py-2 text-sm text-gray-700 pl-8">{item.lineItem}</td>
          {hasBudget && (
            <td className="px-4 py-2 text-sm text-right text-gray-500">
              {item.budget !== 0 ? formatCurrency(item.budget) : "—"}
            </td>
          )}
          <td className="px-4 py-2 text-sm text-right font-medium text-gray-400">—</td>
          {hasBudget && (
            <td className="px-4 py-2 text-sm text-right font-medium text-gray-300">—</td>
          )}
          {hasVariance && (
            <td className="px-4 py-2 text-sm text-right font-medium text-gray-300">—</td>
          )}
        </tr>
      );
    }

    const varBudget = hasBudget && item.budget !== 0 ? item.actual - item.budget : null;
    const varGood   = isExpense ? (varBudget ?? 0) < 0 : (varBudget ?? 0) > 0;

    return (
      <tr
        key={`${item.lineItem}-${item.accountNumber ?? item.month}`}
        className="border-t border-gray-100 hover:bg-gray-50"
      >
        <td className="px-4 py-2 text-sm text-gray-700 pl-8">{item.lineItem}</td>
        {hasBudget && (
          <td className="px-4 py-2 text-sm text-right text-gray-500">
            {item.budget !== 0 ? formatCurrency(item.budget) : "—"}
          </td>
        )}
        <td className="px-4 py-2 text-sm text-right font-medium text-gray-900">
          {formatCurrency(item.actual)}
        </td>
        {hasBudget && (
          <td className={cn("px-4 py-2 text-sm text-right font-medium",
            varBudget == null || item.budget === 0 ? "text-gray-300" :
            varGood ? "text-green-600" : "text-red-600"
          )}>
            {varBudget != null && item.budget !== 0
              ? `${varBudget >= 0 ? "+" : ""}${formatCurrency(varBudget)}`
              : "—"}
          </td>
        )}
        {hasVariance && (
          <td className={cn("px-4 py-2 text-sm text-right font-medium",
            item.variance == null ? "text-gray-300" :
            (item.category === "Expenses" || item.category === "CapEx")
              ? (item.variance < 0 ? "text-green-600" : "text-red-600")
              : (item.variance > 0 ? "text-green-600" : "text-red-600")
          )}>
            {item.variance != null
              ? `${item.variance >= 0 ? "+" : ""}${formatCurrency(item.variance)}`
              : "—"}
          </td>
        )}
      </tr>
    );
  }

  function renderSectionHeader(label: string, colorClass: string) {
    return (
      <tr className={`${colorClass} border-t-2 border-gray-200`}>
        <td
          colSpan={colSpan}
          className="px-4 py-2 text-xs font-bold uppercase tracking-wider"
        >
          {label}
        </td>
      </tr>
    );
  }

  function renderSubtotal(label: string, actualTotal: number, isExpense = false, budgetTotal?: number) {
    if (isBudgetOnlyMonth) {
      return (
        <tr className="bg-gray-50/80">
          <td className="px-4 py-2 text-xs font-semibold text-gray-500 pl-8">{label}</td>
          {hasBudget && (
            <td className={`px-4 py-2 text-sm text-right font-bold ${isExpense ? "text-red-700" : "text-gray-900"}`}>
              {budgetTotal !== undefined ? formatCurrency(budgetTotal) : "—"}
            </td>
          )}
          <td className="px-4 py-2 text-sm text-right font-bold text-gray-400">—</td>
          {hasBudget && <td />}
        </tr>
      );
    }
    return (
      <tr className="bg-gray-50/80">
        <td className="px-4 py-2 text-xs font-semibold text-gray-500 pl-8">{label}</td>
        {hasBudget && <td />}
        <td className={`px-4 py-2 text-sm text-right font-bold ${isExpense && actualTotal > 0 ? "text-red-700" : "text-gray-900"}`}>
          {formatCurrency(actualTotal)}
        </td>
        {hasBudget && <td />}
      </tr>
    );
  }

  function renderSummaryRow(label: string, value: number, highlighted = false) {
    const color = value >= 0 ? "text-green-700" : "text-red-700";
    return (
      <tr className={`border-t-2 border-gray-400 ${highlighted ? "bg-green-50/30" : "bg-gray-50/50"}`}>
        <td
          colSpan={colSpan}
          className="px-4 py-3 flex items-center justify-between"
        >
          <span className="text-sm font-bold text-gray-900">
            {label}
            {isBudgetOnlyMonth && <span className="ml-1 text-xs font-normal text-gray-400">(Budget)</span>}
          </span>
          <span className={`text-base font-bold ${color}`}>{formatCurrency(value)}</span>
        </td>
      </tr>
    );
  }

  if (months.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        No financial data — upload a T12 Income Statement on the Import page.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Month tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {months.map((m) => (
          <button
            key={m}
            onClick={() => setMonth(m)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              month === m
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {monthLabel(m)}
            {allFinancials.filter((f) => f.month === m && !f.isNOI).every((f) => f.budgetOnly) && (
              <span className="ml-1 text-xs text-gray-400">(B)</span>
            )}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: isBudgetOnlyMonth ? "Total Income (Budget)"   : "Total Income",   value: formatCurrency(displayIncome),   color: "text-gray-900" },
          { label: isBudgetOnlyMonth ? "Total Expenses (Budget)" : "Total Expenses", value: formatCurrency(displayExpenses), color: "text-gray-900" },
          { label: isBudgetOnlyMonth ? "NOI (Budget)"            : "NOI",            value: formatCurrency(displayNOI),      color: displayNOI >= 0 ? "text-green-700" : "text-red-700" },
          { label: isBudgetOnlyMonth ? "Net Cash Flow (Budget)"  : "Net Cash Flow",  value: formatCurrency(displayCF),       color: displayCF >= 0 ? "text-green-700" : "text-red-700" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* P&L table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Line Item</th>
                  {hasBudget && (
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Budget</th>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {isBudgetOnlyMonth ? <span className="text-gray-400">Actual</span> : "Actual"}
                  </th>
                  {hasBudget && (
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Var vs Budget</th>
                  )}
                  {hasVariance && (
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">YTD Var</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {/* ── INCOME ─────────────────────────────────── */}
                {renderSectionHeader("Income", "bg-blue-50/60 text-blue-700")}
                {incomeItems.map((item) => renderLineItem(item, false))}
                {renderSubtotal("Total Operating Income", totalIncome, false, totalIncomeBudget)}

                {/* ── EXPENSES ───────────────────────────────── */}
                {renderSectionHeader("Expenses", "bg-gray-50/60 text-gray-600")}
                {expenseItems.map((item) => renderLineItem(item, true))}
                {renderSubtotal("Total Operating Expenses", totalExpenses, true, totalExpensesBudget)}

                {/* ── NOI ────────────────────────────────────── */}
                {renderSummaryRow("NOI", isBudgetOnlyMonth ? noiBudgetCalc : noi, true)}

                {/* ── BELOW THE LINE ─────────────────────────── */}
                {hasBelowLine && (
                  <>
                    {renderSectionHeader("Below the Line", "bg-slate-50/60 text-slate-600")}
                    {capexItems.length > 0 && (
                      <>
                        <tr className="border-t border-gray-100">
                          <td colSpan={colSpan} className="px-4 py-1.5 text-xs font-semibold text-gray-500 pl-8">
                            Capital Expenditures
                          </td>
                        </tr>
                        {capexItems.map((item) => renderLineItem(item, true))}
                        {capexItems.length > 1 && renderSubtotal("Total CapEx", totalCapex, true)}
                      </>
                    )}
                    {debtItems.length > 0 && (
                      <>
                        <tr className="border-t border-gray-100">
                          <td colSpan={colSpan} className="px-4 py-1.5 text-xs font-semibold text-gray-500 pl-8">
                            Debt Service
                          </td>
                        </tr>
                        {debtItems.map((item) => renderLineItem(item, true))}
                        {debtItems.length > 1 && renderSubtotal("Total Debt Service", totalDebt, true)}
                      </>
                    )}
                    {profFeeItems.length > 0 && (
                      <>
                        <tr className="border-t border-gray-100">
                          <td colSpan={colSpan} className="px-4 py-1.5 text-xs font-semibold text-gray-500 pl-8">
                            Professional Fees
                          </td>
                        </tr>
                        {profFeeItems.map((item) => renderLineItem(item, true))}
                      </>
                    )}

                    {/* ── NET CASH FLOW ───────────────────────── */}
                    {renderSummaryRow("Net Cash Flow", isBudgetOnlyMonth ? noiBudgetCalc : cashFlow, false)}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
