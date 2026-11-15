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
