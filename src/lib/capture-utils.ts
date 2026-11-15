export type CaptureRecord = {
  amount: number;
  category: string;
  merchant: string;
  occurredAt: string;
  paymentMode: string;
  note: string;
  type?: "expense" | "income";
};

export async function fingerprintTransaction(entry: CaptureRecord): Promise<string> {
  const normalized = [
    entry.amount.toFixed(2),
    entry.occurredAt.slice(0, 10),
    (entry.merchant || "").trim().toLocaleLowerCase("en-IN"),
    entry.category.trim().toLocaleLowerCase("en-IN"),
    (entry.paymentMode || "").trim().toLocaleLowerCase("en-IN"),
    (entry.note || "").trim().toLocaleLowerCase("en-IN"),
  ].join("|");
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized)
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

/**
 * Common merchant classification mapping for Indian fintech & everyday spending
 */
const MERCHANT_CATEGORY_MAP: Record<string, string> = {
  swiggy: "Food & dining",
  zomato: "Food & dining",
  mcdonalds: "Food & dining",
  starbucks: "Food & dining",
  chai: "Food & dining",
  tea: "Food & dining",
  coffee: "Food & dining",
  restaurant: "Food & dining",
  cafe: "Food & dining",
  biryani: "Food & dining",
  dhaba: "Food & dining",
  dominos: "Food & dining",
  blinkit: "Groceries",
  zepto: "Groceries",
  instamart: "Groceries",
  bigbasket: "Groceries",
  dmart: "Groceries",
  naturebasket: "Groceries",
  milk: "Groceries",
  vegetables: "Groceries",
  sabzi: "Groceries",
  uber: "Travel",
  ola: "Travel",
  rapido: "Travel",
  metro: "Travel",
  auto: "Travel",
  irctc: "Travel",
  indigo: "Travel",
  petrol: "Travel",
  diesel: "Travel",
  fuel: "Travel",
  shell: "Travel",
  toll: "Travel",
  amazon: "Shopping",
  flipkart: "Shopping",
  myntra: "Shopping",
  ajio: "Shopping",
  zara: "Shopping",
  h_and_m: "Shopping",
  nykaa: "Shopping",
  tata_cliq: "Shopping",
  jio: "Bills & utilities",
  airtel: "Bills & utilities",
  vi: "Bills & utilities",
  electricity: "Bills & utilities",
  bescom: "Bills & utilities",
  torrent: "Bills & utilities",
  broadband: "Bills & utilities",
  gas: "Bills & utilities",
  indane: "Bills & utilities",
  water: "Bills & utilities",
  netflix: "Entertainment",
  spotify: "Entertainment",
  prime: "Entertainment",
  hotstar: "Entertainment",
  pvr: "Entertainment",
  inox: "Entertainment",
  bookmyshow: "Entertainment",
  pharmacy: "Healthcare",
  apollo: "Healthcare",
  pharmeasy: "Healthcare",
  "1mg": "Healthcare",
  hospital: "Healthcare",
  clinic: "Healthcare",
  doctor: "Healthcare",
  groww: "Investment",
  zerodha: "Investment",
  coin: "Investment",
  sip: "Investment",
  mutual_fund: "Investment",
  salary: "Salary",
};

/**
 * Client-side parser for Indian bank/UPI SMS formats and natural language entries.
 * Handles inputs like:
 * - "Paid Rs. 450 to Swiggy via UPI on 15-Nov"
 * - "Rs 120.00 debited from HDFC Bank A/c **1234 on 15-NOV-26 to ZOMATO"
 * - "Chai and samosa 60 rupees at office"
 * - "Auto 120 to metro station"
 * - "Salary Rs 75,000 credited"
 */
export function parseIndianSmsOrText(rawText: string): CaptureRecord[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const results: CaptureRecord[] = [];

  for (const line of lines) {
    // 1. Amount Extraction (handles ₹, Rs, Rs., INR, numbers with commas, e.g. Rs. 1,250.50 or 450 rupees)
    const amountMatch =
      line.match(/(?:(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?))/i) ||
      line.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹|rupees)/i) ||
      line.match(/\b(?:debited\s+by|paid|spent|sent)\s+([\d,]+(?:\.\d{1,2})?)/i) ||
      line.match(/\b([\d,]+(?:\.\d{1,2})?)\b/);

    if (!amountMatch || !amountMatch[1]) continue;

    const parsedAmount = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (isNaN(parsedAmount) || parsedAmount <= 0) continue;

    // 2. Type detection: Income vs Expense
    const isIncome =
      /\b(?:credited|received|salary|refund|cashback|deposited)\b/i.test(line) &&
      !/\b(?:debited|paid|spent|sent|transferred\s+to)\b/i.test(line);

    // 3. Payment Mode detection
    let paymentMode = "UPI";
    if (/\b(?:credit\s*card|cc)\b/i.test(line)) paymentMode = "Credit Card";
    else if (/\b(?:debit\s*card|dc)\b/i.test(line)) paymentMode = "Debit Card";
    else if (/\bnet\s*banking\b/i.test(line)) paymentMode = "Net Banking";
    else if (/\bcash\b/i.test(line)) paymentMode = "Cash";
    else if (/\bgpay|google\s*pay\b/i.test(line)) paymentMode = "Google Pay";
    else if (/\bphonepe\b/i.test(line)) paymentMode = "PhonePe";
    else if (/\bpaytm\b/i.test(line)) paymentMode = "Paytm";

    // 4. Merchant detection
    let merchant = "";
    const merchantMatch =
      line.match(/(?:to|at|vpa|info|towards)\s+([A-Za-z0-9&.\-_ ]+?)(?:\s+(?:on|via|using|ref|a\/c|bal)|$)/i) ||
      line.match(/paid\s+to\s+([A-Za-z0-9&.\-_ ]+)/i);

    if (merchantMatch && merchantMatch[1]) {
      merchant = merchantMatch[1].trim().replace(/[.,;]+$/, "");
    } else {
      // Look for known merchants in text
      for (const m of Object.keys(MERCHANT_CATEGORY_MAP)) {
        if (new RegExp(`\\b${m}\\b`, "i").test(line)) {
          merchant = m.charAt(0).toUpperCase() + m.slice(1);
          break;
        }
      }
    }

    // 5. Category classification
    let category = isIncome ? "Salary" : "Other";
    const lowerLine = line.toLowerCase();
    for (const [key, cat] of Object.entries(MERCHANT_CATEGORY_MAP)) {
      if (lowerLine.includes(key)) {
        category = isIncome ? (cat === "Salary" ? "Salary" : "Refund") : cat;
        break;
      }
    }

    // Default food & dining if typical food words are present
    if (category === "Other") {
      if (/\b(?:lunch|dinner|breakfast|snack|chai|coffee|food|pizza|burger|meal)\b/i.test(line)) {
        category = "Food & dining";
      } else if (/\b(?:cab|taxi|train|bus|fuel|petrol|toll)\b/i.test(line)) {
        category = "Travel";
      } else if (/\b(?:groceries|fruits|sabzi|mart|market)\b/i.test(line)) {
        category = "Groceries";
      }
    }

    // 6. Note cleanup
    const note = merchant
      ? `${merchant} · ${line.slice(0, 60)}`
      : line.length > 50
        ? line.slice(0, 50) + "…"
        : line;

    results.push({
      amount: parsedAmount,
      type: isIncome ? "income" : "expense",
      category,
      merchant: merchant || (isIncome ? "Deposit" : "Payment"),
      paymentMode,
      note,
      occurredAt: new Date().toISOString(),
    });
  }

  return results;
}

const GEMINI_KEY_STORAGE = "paisapulse_gemini_api_key";

export function getStoredGeminiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(GEMINI_KEY_STORAGE) || "";
}

export function setStoredGeminiKey(key: string): void {
  if (typeof window === "undefined") return;
  if (!key.trim()) {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
  } else {
    localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
  }
}

/**
 * Call Google AI Studio (Gemini 2.5 Flash / 1.5 Flash) directly from the client.
 * Handles structured transaction extraction for text, photos/receipts, and statements.
 */
export async function parseWithGemini(
  prompt: string,
  media?: { mimeType: string; dataBase64: string },
  customKey?: string
): Promise<{ entries: CaptureRecord[]; transcript?: string }> {
  const apiKey = customKey || getStoredGeminiKey();
  if (!apiKey) {
    throw new Error(
      "Google AI Studio API key is not configured. Please add your key in AI Settings."
    );
  }

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (media) {
    parts.push({
      inline_data: { mime_type: media.mimeType, data: media.dataBase64 },
    });
  }

  const entryJsonSchema = {
    type: "OBJECT",
    properties: {
      amount: { type: "NUMBER" },
      type: { type: "STRING", enum: ["expense", "income"] },
      category: { type: "STRING" },
      merchant: { type: "STRING" },
      occurredAt: { type: "STRING" },
      paymentMode: { type: "STRING" },
      note: { type: "STRING" },
    },
    required: ["amount", "category", "merchant", "occurredAt", "paymentMode", "note"],
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              entries: { type: "ARRAY", items: entryJsonSchema },
              transcript: { type: "STRING" },
            },
            required: ["entries"],
          },
        },
      }),
    }
  );

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  } | null;

  if (!response.ok) {
    const reason = payload?.error?.message;
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        reason ||
        "Google AI Studio did not accept this API key. Verify that the key is valid and Generative Language API is active."
      );
    }
    if (response.status === 429) {
      throw new Error("Google AI Studio rate-limit reached. Please try again in a few moments.");
    }
    throw new Error(reason || `Google AI Studio error (${response.status}).`);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("No transaction details could be detected.");
  }

  try {
    const parsed = JSON.parse(text) as { entries: CaptureRecord[]; transcript?: string };
    const out: { entries: CaptureRecord[]; transcript?: string } = {
      entries: parsed.entries.map((e) => ({
        ...e,
        type: e.type || "expense",
        occurredAt: e.occurredAt || new Date().toISOString(),
      })),
    };
    if (parsed.transcript) {
      out.transcript = parsed.transcript;
    }
    return out;
  } catch {
    throw new Error("Could not parse structured transactions from Gemini response.");
  }
}
