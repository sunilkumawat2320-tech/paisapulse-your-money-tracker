import * as XLSX from "xlsx";
import type { Tables } from "@/integrations/supabase/types";

export function exportTransactionsToExcel(
  transactions: Tables<"transactions">[],
  fileName = `PaisaPulse_Transactions_${new Date().toISOString().slice(0, 10)}.xlsx`
) {
  if (!transactions.length) {
    throw new Error("No transactions to export");
  }

  const rows = transactions.map((tx) => ({
    "Date & Time": new Date(tx.occurred_at).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    }),
    Type: tx.type === "expense" ? "Expense" : "Income",
    Category: tx.category,
    "Merchant / Payee": tx.merchant || "—",
    "Amount (INR)": Number(tx.amount),
    "Payment Mode": tx.payment_mode || "UPI",
    Description: tx.note || "—",
    Source: tx.source || "manual",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 20 }, // Date
    { wch: 10 }, // Type
    { wch: 18 }, // Category
    { wch: 22 }, // Merchant
    { wch: 14 }, // Amount
    { wch: 14 }, // Payment Mode
    { wch: 30 }, // Description
    { wch: 12 }, // Source
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
  XLSX.writeFile(workbook, fileName);
}

export interface BudgetStatementRow {
  category: string;
  monthly_limit: number;
  spent: number;
  variance: number;
  percentUtilized: number;
  status: string;
  safeDailySpend: number;
}

export function exportBudgetStatementToExcel(
  items: BudgetStatementRow[],
  totals: {
    totalBudget: number;
    totalSpent: number;
    totalVariance: number;
  },
  monthName: string,
  fileName = `PaisaPulse_Budget_Statement_${monthName.replace(/\s+/g, "_")}.xlsx`
) {
  if (!items.length) {
    throw new Error("No budget data to export");
  }

  const rows = items.map((b) => ({
    Category: b.category,
    "Budget (INR)": b.monthly_limit,
    "Actual Spent (INR)": b.spent,
    "Variance (INR)": b.variance,
    "% Utilized": `${b.percentUtilized}%`,
    Status: b.status,
    "Safe Daily Spend (INR)": b.safeDailySpend,
  }));

  // Append Totals row
  rows.push({
    Category: "TOTAL",
    "Budget (INR)": totals.totalBudget,
    "Actual Spent (INR)": totals.totalSpent,
    "Variance (INR)": totals.totalVariance,
    "% Utilized": totals.totalBudget > 0 ? `${Math.round((totals.totalSpent / totals.totalBudget) * 100)}%` : "0%",
    Status: totals.totalSpent > totals.totalBudget ? "Overspent" : "On track",
    "Safe Daily Spend (INR)": 0,
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet["!cols"] = [
    { wch: 22 }, // Category
    { wch: 15 }, // Budget
    { wch: 18 }, // Actual Spent
    { wch: 16 }, // Variance
    { wch: 14 }, // % Utilized
    { wch: 14 }, // Status
    { wch: 22 }, // Safe Daily Spend
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Budget ${monthName.slice(0, 20)}`);
  XLSX.writeFile(workbook, fileName);
}

