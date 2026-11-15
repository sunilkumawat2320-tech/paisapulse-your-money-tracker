import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Receipt,
  Trash2,
  Sparkles,
  Key,
  HelpCircle,
  FileText,
  Camera,
  Layers,
  Undo2,
  Check,
  AlertCircle,
  CreditCard,
  Building2,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

import { Card, PageShell, EmptyState } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/format";
import {
  type CaptureRecord,
  fingerprintTransaction,
  parseIndianSmsOrText,
  getStoredGeminiKey,
  setStoredGeminiKey,
  parseWithGemini,
} from "@/lib/capture-utils";

export const Route = createFileRoute("/_authenticated/capture")({
  head: () => ({
    meta: [
      { title: "Capture — PaisaPulse" },
      {
        name: "description",
        content: "Log spends with AI: paste SMS, scan receipts, import statements, or quick manual entry.",
      },
      { property: "og:title", content: "Capture — PaisaPulse" },
      {
        property: "og:description",
        content: "Intelligent transaction capture in rupees: SMS, voice, receipt OCR, statements, and manual logging.",
      },
    ],
  }),
  component: CaptureScreen,
});

const EXPENSE_CATEGORIES = [
  "Food & dining",
  "Groceries",
  "Travel",
  "Shopping",
  "Bills & utilities",
  "Entertainment",
  "Healthcare",
  "Investment",
  "Other",
];

const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Investment",
  "Refund",
  "Gift",
  "Other",
];

const PAYMENT_MODES = ["UPI", "Credit Card", "Debit Card", "Net Banking", "Cash"];

export function CaptureScreen() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab mode: "quick" | "smart" | "receipt" | "statement"
  const [activeTab, setActiveTab] = useState<"quick" | "smart" | "receipt" | "statement">("quick");

  // Quick entry state
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food & dining");
  const [merchant, setMerchant] = useState("");
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });

  // Smart SMS / NLP state
  const [rawTextInput, setRawTextInput] = useState("");
  const [parsedEntries, setParsedEntries] = useState<CaptureRecord[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  // Statement import state
  const [statementImportId, setStatementImportId] = useState<string | null>(null);

  // AI Studio Key Dialog
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredGeminiKey());
  const [isTestingKey, setIsTestingKey] = useState(false);

  // Query recent transactions
  const txQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data ?? [];
    },
  });

  // Single transaction insert mutation
  const addTxMutation = useMutation({
    mutationFn: async (payload: {
      amount: number;
      type: "expense" | "income";
      category: string;
      merchant?: string | null;
      payment_mode?: string | null;
      note?: string | null;
      occurred_at: string;
      source?: string;
      raw_text?: string | null;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      const fingerprint = await fingerprintTransaction({
        amount: payload.amount,
        category: payload.category,
        merchant: payload.merchant || "",
        paymentMode: payload.payment_mode || "",
        note: payload.note || "",
        occurredAt: payload.occurred_at,
      });

      const { error } = await supabase.from("transactions").insert({
        user_id: auth.user.id,
        amount: payload.amount,
        type: payload.type,
        category: payload.category,
        merchant: payload.merchant || null,
        payment_mode: payload.payment_mode || null,
        note: payload.note || null,
        occurred_at: payload.occurred_at,
        source: payload.source || "manual",
        raw_text: payload.raw_text || null,
        source_fingerprint: fingerprint,
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success(`Logged ${formatINR(variables.amount)} for ${variables.category}`);
      setAmount("");
      setMerchant("");
      setNote("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to log transaction");
    },
  });

  // Batch insert mutation (for smart parsed entries and statements)
  const batchInsertMutation = useMutation({
    mutationFn: async ({
      entries,
      source,
      rawText,
      importId,
    }: {
      entries: CaptureRecord[];
      source: string;
      rawText?: string;
      importId?: string;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not authenticated");

      const fingerprints = await Promise.all(entries.map(fingerprintTransaction));
      const rows = entries.map((entry, idx) => ({
        user_id: auth.user.id,
        amount: entry.amount,
        type: entry.type || "expense",
        category: entry.category,
        merchant: entry.merchant || null,
        payment_mode: entry.paymentMode || null,
        note: entry.note || null,
        occurred_at: entry.occurredAt,
        source,
        raw_text: rawText || null,
        source_fingerprint: fingerprints[idx] ?? null,
        statement_import_id: importId || null,
      }));

      const { data, error } = await supabase
        .from("transactions")
        .upsert(rows, { onConflict: "user_id,source_fingerprint", ignoreDuplicates: true })
        .select("id");

      if (error) throw error;
      return { count: data?.length ?? 0, total: entries.length };
    },
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      if (vars.importId) setStatementImportId(vars.importId);
      toast.success(`Successfully saved ${res.count} transactions (${res.total - res.count} duplicates skipped)`);
      setParsedEntries([]);
      setRawTextInput("");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save entries");
    },
  });

  // Undo statement import mutation
  const undoStatementMutation = useMutation({
    mutationFn: async (importId: string) => {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("statement_import_id", importId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      setStatementImportId(null);
      toast.success("Statement import reverted successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to undo statement import");
    },
  });

  // Delete single transaction mutation
  const deleteTxMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Transaction removed");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to remove transaction");
    },
  });

  // Parse text / SMS input
  async function handleParseText() {
    if (!rawTextInput.trim()) {
      toast.error("Please paste an SMS or type transactions first");
      return;
    }
    setIsParsing(true);
    const geminiKey = getStoredGeminiKey();

    try {
      if (geminiKey) {
        // Use Gemini multimodal extraction
        const prompt = `Extract all personal finance transactions from this text. For each return amount (INR positive number), category, merchant name, type ('expense' or 'income'), paymentMode, and concise note.\n\nText: ${rawTextInput}`;
        const res = await parseWithGemini(prompt, undefined, geminiKey);
        if (res.entries.length) {
          setParsedEntries(res.entries);
          toast.success(`AI extracted ${res.entries.length} transaction(s)!`);
        } else {
          fallbackLocalParse();
        }
      } else {
        fallbackLocalParse();
      }
    } catch {
      fallbackLocalParse();
    } finally {
      setIsParsing(false);
    }
  }

  function fallbackLocalParse() {
    const localParsed = parseIndianSmsOrText(rawTextInput);
    if (localParsed.length) {
      setParsedEntries(localParsed);
      toast.success(`Extracted ${localParsed.length} transaction(s) using smart parser`);
    } else {
      toast.error("Couldn't find transaction amounts in the text. Check formatting or add via Quick Entry.");
    }
  }

  // Handle receipt image upload
  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const geminiKey = getStoredGeminiKey();
    if (!geminiKey) {
      toast.error("Please connect your Google AI Studio key first to scan receipts.");
      setKeyDialogOpen(true);
      return;
    }

    setIsParsing(true);
    toast.info("Scanning receipt photo with Gemini Vision…");

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(",")[1];
        if (!base64Data) {
          toast.error("Could not read receipt file.");
          setIsParsing(false);
          return;
        }

        try {
          const res = await parseWithGemini(
            "Extract every expense transaction, total, merchant name, date, and payment mode from this receipt photo.",
            { mimeType: file.type || "image/jpeg", dataBase64: base64Data },
            geminiKey
          );

          if (res.entries.length) {
            setParsedEntries(res.entries);
            setActiveTab("smart");
            toast.success(`Found ${res.entries.length} items from receipt!`);
          } else {
            toast.warning("No itemized totals found. Please review the photo.");
          }
        } catch (err: unknown) {
          toast.error((err as Error).message || "Vision extraction failed");
        } finally {
          setIsParsing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsParsing(false);
      toast.error("Failed to read image");
    }
  }

  // Save manual quick entry
  function handleQuickSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    addTxMutation.mutate({
      amount: parsedAmount,
      type,
      category,
      merchant: merchant.trim() || null,
      payment_mode: paymentMode,
      note: note.trim() || null,
      occurred_at: date ? new Date(date).toISOString() : new Date().toISOString(),
      source: "manual",
    });
  }

  // Test Gemini API key
  async function testGeminiKey() {
    if (!apiKeyInput.trim()) {
      toast.error("Please enter an API key");
      return;
    }
    setIsTestingKey(true);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKeyInput.trim()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Hello" }] }],
          }),
        }
      );

      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(errJson?.error?.message || `HTTP ${res.status}`);
      }

      setStoredGeminiKey(apiKeyInput.trim());
      toast.success("Google AI Studio connection verified and saved!");
      setKeyDialogOpen(false);
    } catch (err: unknown) {
      toast.error(`Key verification failed: ${(err as Error).message}`);
    } finally {
      setIsTestingKey(false);
    }
  }

  const categories = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const transactions = txQuery.data ?? [];
  const hasGeminiKey = Boolean(getStoredGeminiKey());

  return (
    <PageShell title="Capture" subtitle="Log an expense or income">
      {/* Top Banner: Mode switcher & AI Key Button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("quick")}
            className={`rounded-lg px-2.5 py-1.5 transition-all ${
              activeTab === "quick" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Quick Entry
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("smart")}
            className={`rounded-lg px-2.5 py-1.5 transition-all ${
              activeTab === "smart" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Sparkles className="mr-1 inline h-3 w-3" /> Smart SMS / NLP
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-lg px-2.5 py-1.5 transition-all ${
              activeTab === "receipt" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Camera className="mr-1 inline h-3 w-3" /> Bill Scan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("statement")}
            className={`rounded-lg px-2.5 py-1.5 transition-all ${
              activeTab === "statement" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <FileText className="mr-1 inline h-3 w-3" /> Statement
          </button>
        </div>

        <button
          type="button"
          onClick={() => setKeyDialogOpen(true)}
          className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${
            hasGeminiKey
              ? "border-primary/40 bg-primary-soft text-primary"
              : "border-border bg-card text-muted-foreground hover:bg-muted"
          }`}
          title="Configure Google AI Studio API key"
        >
          <Key className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{hasGeminiKey ? "AI Active" : "Connect AI"}</span>
        </button>

        {/* Hidden file input for bill scan */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleReceiptUpload}
          className="hidden"
        />
      </div>

      {/* 1. Quick Manual Entry Form */}
      {activeTab === "quick" && (
        <Card>
          <form onSubmit={handleQuickSubmit} className="space-y-4">
            {/* Type Toggle */}
            <div className="grid grid-cols-2 rounded-xl bg-muted p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setType("expense");
                  setCategory("Food & dining");
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
                  type === "expense"
                    ? "bg-card text-danger shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                <ArrowDownRight className="h-4 w-4" /> Expense
              </button>
              <button
                type="button"
                onClick={() => {
                  setType("income");
                  setCategory("Salary");
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all ${
                  type === "income"
                    ? "bg-card text-success shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                <ArrowUpRight className="h-4 w-4" /> Income
              </button>
            </div>

            {/* Amount Input */}
            <div className="space-y-1.5">
              <Label htmlFor="tx-amount" className="text-xs text-muted-foreground">
                Amount (₹)
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="tx-amount"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="h-16 pl-10 text-3xl font-extrabold tracking-tight text-foreground"
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Category Chips */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                      category === c
                        ? type === "expense"
                          ? "bg-danger text-danger-foreground border-danger"
                          : "bg-success text-success-foreground border-success"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Merchant & Payment Mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tx-merchant" className="text-xs text-muted-foreground">
                  Merchant / Payee (Optional)
                </Label>
                <Input
                  id="tx-merchant"
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="e.g. Swiggy, Uber, Shell"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tx-mode" className="text-xs text-muted-foreground">
                  Payment Mode
                </Label>
                <select
                  id="tx-mode"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {PAYMENT_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Note & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tx-note" className="text-xs text-muted-foreground">
                  Note / Description (Optional)
                </Label>
                <Input
                  id="tx-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Team lunch, weekend trip"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tx-date" className="text-xs text-muted-foreground">
                  Date & Time
                </Label>
                <Input
                  id="tx-date"
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-11 text-xs"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-base font-semibold"
              disabled={addTxMutation.isPending}
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              {addTxMutation.isPending ? "Logging…" : `Save ${type === "expense" ? "Expense" : "Income"}`}
            </Button>
          </form>
        </Card>
      )}

      {/* 2. Smart NLP / SMS Parser */}
      {activeTab === "smart" && (
        <Card className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" /> Smart SMS & Natural Language
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Paste Indian bank SMS messages, UPI debit texts, or everyday spend descriptions.
            </p>
          </div>

          <textarea
            rows={4}
            value={rawTextInput}
            onChange={(e) => setRawTextInput(e.target.value)}
            placeholder={`Examples:\n• Paid Rs. 450 to Swiggy on 15-Nov using UPI\n• Rs 120.00 debited from a/c **1234 on 15-NOV-26 to ZOMATO\n• Auto 150 from home to office\n• Chai 40 rupees with team`}
            className="w-full rounded-xl border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleParseText}
              disabled={isParsing || !rawTextInput.trim()}
              className="flex-1 rounded-xl"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {isParsing ? "Extracting…" : "Extract Transactions"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRawTextInput("");
                setParsedEntries([]);
              }}
              className="rounded-xl"
            >
              Clear
            </Button>
          </div>

          {/* Parsed Preview Cards */}
          {parsedEntries.length > 0 && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">
                  Detected Transactions ({parsedEntries.length})
                </p>
                <Button
                  size="sm"
                  onClick={() =>
                    batchInsertMutation.mutate({
                      entries: parsedEntries,
                      source: "text",
                      rawText: rawTextInput,
                    })
                  }
                  disabled={batchInsertMutation.isPending}
                  className="rounded-xl h-8 text-xs font-semibold"
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  {batchInsertMutation.isPending ? "Saving…" : "Confirm & Save All"}
                </Button>
              </div>

              <div className="space-y-2">
                {parsedEntries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        {entry.merchant || entry.category}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.category} · {entry.paymentMode} · {entry.note}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          entry.type === "income" ? "text-success" : "text-foreground"
                        }`}
                      >
                        {entry.type === "income" ? "+" : "-"}
                        {formatINR(entry.amount)}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setParsedEntries(parsedEntries.filter((_, i) => i !== idx))
                        }
                        className="text-[11px] text-danger hover:underline mt-1"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* 3. Statement Import */}
      {activeTab === "statement" && (
        <Card className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" /> Bank / Card Statement Import
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Paste statement transaction rows or bank export lines. Duplicate rows are skipped automatically.
            </p>
          </div>

          <textarea
            rows={5}
            value={rawTextInput}
            onChange={(e) => setRawTextInput(e.target.value)}
            placeholder={`Paste statement rows:\n15/11/2026 SWIGGY BANGALORE UPI/DR/5201 450.00\n15/11/2026 SHELL PETROL PUMP CARD/DR/9921 1200.00\n14/11/2026 SALARY CREDIT CORP/CR/0012 75000.00`}
            className="w-full rounded-xl border border-input bg-background p-3 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          <Button
            type="button"
            onClick={handleParseText}
            disabled={isParsing || !rawTextInput.trim()}
            className="w-full rounded-xl"
          >
            {isParsing ? "Processing…" : "Parse Statement Rows"}
          </Button>

          {statementImportId && (
            <div className="flex items-center justify-between rounded-xl bg-muted p-3 text-xs">
              <div>
                <p className="font-semibold text-foreground">Recent Statement Imported</p>
                <p className="text-muted-foreground">ID: {statementImportId.slice(0, 8)}…</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => undoStatementMutation.mutate(statementImportId)}
                disabled={undoStatementMutation.isPending}
                className="gap-1 rounded-lg text-danger hover:bg-danger-soft hover:text-danger"
              >
                <Undo2 className="h-3.5 w-3.5" />
                {undoStatementMutation.isPending ? "Reverting…" : "Undo Import"}
              </Button>
            </div>
          )}

          {parsedEntries.length > 0 && (
            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">
                  Parsed Rows ({parsedEntries.length})
                </p>
                <Button
                  size="sm"
                  onClick={() =>
                    batchInsertMutation.mutate({
                      entries: parsedEntries,
                      source: "statement",
                      rawText: rawTextInput,
                      importId: crypto.randomUUID(),
                    })
                  }
                  disabled={batchInsertMutation.isPending}
                  className="rounded-xl h-8 text-xs font-semibold"
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Save Statement Batch
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Recent Ledger */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Recent Transactions</h3>
          <span className="text-xs text-muted-foreground">Latest {transactions.length}</span>
        </div>

        {txQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-8 w-8 text-muted-foreground" />}
            title="No transactions logged yet"
            description="Log an expense or paste an SMS above to see real-time updates."
          />
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => {
              const isExpense = tx.type === "expense";
              const formattedDate = new Intl.DateTimeFormat("en-IN", {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              }).format(new Date(tx.occurred_at));

              return (
                <Card key={tx.id} className="p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          isExpense ? "bg-danger-soft text-danger" : "bg-success-soft text-success"
                        }`}
                      >
                        {isExpense ? (
                          <ArrowDownRight className="h-5 w-5" />
                        ) : (
                          <ArrowUpRight className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {tx.merchant || tx.category}
                          </p>
                          {tx.source && tx.source !== "manual" && (
                            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary capitalize">
                              {tx.source}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {tx.category} · {tx.payment_mode || "UPI"} {tx.note ? `· ${tx.note}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p
                          className={`text-sm font-bold ${
                            isExpense ? "text-foreground" : "text-success"
                          }`}
                        >
                          {isExpense ? "-" : "+"}
                          {formatINR(Number(tx.amount))}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{formattedDate}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteTxMutation.mutate(tx.id)}
                        className="p-1 text-muted-foreground hover:text-danger transition-colors"
                        aria-label="Delete transaction"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Google AI Studio Configuration Dialog */}
      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Google AI Studio API Key
            </DialogTitle>
            <DialogDescription>
              Connect your Gemini key to unlock multimodal receipt OCR, voice transcription, and AI-powered transaction categorization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Key Prefix Guidance */}
            <div className="rounded-xl border border-primary/20 bg-primary-soft/50 p-3 text-xs text-primary leading-relaxed">
              <p className="font-semibold flex items-center gap-1.5 mb-1 text-foreground">
                <HelpCircle className="h-4 w-4 text-primary" /> Key Prefix Explanation
              </p>
              Standard keys generated in Google AI Studio typically begin with <code className="font-mono font-semibold">AIzaSy...</code>. However, keys generated via Google Cloud Console or service accounts may start with other prefixes (e.g. <code className="font-mono">AIza...</code> or project credentials). Any key from Google Cloud with the <strong>Generative Language API</strong> enabled is accepted.
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gemini-key">API Key</Label>
              <Input
                id="gemini-key"
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Stored safely in your local browser storage. It is never logged or shared.
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            {apiKeyInput && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStoredGeminiKey("");
                  setApiKeyInput("");
                  toast.info("API key removed");
                }}
                className="rounded-xl text-xs text-danger hover:text-danger"
              >
                Disconnect
              </Button>
            )}
            <Button
              type="button"
              onClick={testGeminiKey}
              disabled={isTestingKey || !apiKeyInput.trim()}
              className="rounded-xl flex-1"
            >
              {isTestingKey ? "Testing…" : "Test & Save Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
