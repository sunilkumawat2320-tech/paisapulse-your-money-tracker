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
function parseDateFromIndianSms(text: string): string {
  const MONTHS: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  const textLower = text.toLowerCase();
  const dmyMatch = textLower.match(/\b(\d{1,2})[-/]([a-z]{3}|\d{1,2})(?:[-/](\d{2,4}))?\b/i);
  if (dmyMatch && dmyMatch[1] && dmyMatch[2]) {
    const day = parseInt(dmyMatch[1], 10);
    let month = -1;
    if (isNaN(Number(dmyMatch[2]))) {
      month = MONTHS[dmyMatch[2].slice(0, 3)] ?? -1;
    } else {
      month = parseInt(dmyMatch[2], 10) - 1;
    }

    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) {
      const now = new Date();
      let year = now.getFullYear();
      if (dmyMatch[3]) {
        const parsedYear = parseInt(dmyMatch[3], 10);
        year = parsedYear < 100 ? 2000 + parsedYear : parsedYear;
      }
      const parsedDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString();
      }
    }
  }

  return new Date().toISOString();
}

function splitIntoSmsChunks(rawText: string): string[] {
  // Split by double newlines (paragraphs/separate SMS messages)
  const paragraphs = rawText
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];

  for (const para of paragraphs) {
    // If a single paragraph contains multiple SMS headers, split them
    const delimiterPattern = /(?=(?:(?:Dear\s+Customer|Alert\s*:|A\/c\s*[\*x\d]+|Txn\s*ID|Rs\.?\s*[\d,]+(?:\.\d{1,2})?\s*(?:debited|credited)|Paid\s+Rs|Sent\s+Rs))\b)/i;
    const splitMessages = para.split(delimiterPattern).map((m) => m.trim()).filter(Boolean);
    if (splitMessages.length > 1) {
      chunks.push(...splitMessages);
    } else {
      chunks.push(para);
    }
  }

  // If there's only 1 chunk with multiple discrete lines having amounts, split by line
  if (chunks.length === 1 && paragraphs.length === 1) {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const amountLines = lines.filter((l) =>
      /(?:rs\.?|inr|₹)\s*[\d,]+|[\d,]+\s*(?:rs\.?|inr|₹|rupees)|\bdebited\b|\bcredited\b/i.test(l)
    );
    if (amountLines.length > 1) {
      return lines;
    }
  }

  return chunks.length ? chunks : [rawText.trim()];
}

export function parseIndianSmsOrText(rawText: string): CaptureRecord[] {
  const chunks = splitIntoSmsChunks(rawText);
  const results: CaptureRecord[] = [];

  for (const chunk of chunks) {
    // Strip out available balance mentions first (e.g. "Bal Rs. 14,250" or "Avail Bal: Rs 89,000")
    // so account balance numbers don't get mistakenly parsed as expense amounts
    const textWithoutBalance = chunk.replace(
      /(?:avail(?:able)?\s+)?bal(?:ance)?(?:\s+is|\s*:)?\s*(?:rs\.?|inr|₹)?\s*[\d,]+(?:\.\d{1,2})?/gi,
      ""
    );

    // 1. Amount Extraction (handles ₹, Rs, Rs., INR, numbers with commas, e.g. Rs. 1,250.50 or 450 rupees)
    const amountMatch =
      textWithoutBalance.match(/(?:(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?))/i) ||
      textWithoutBalance.match(/([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹|rupees)/i) ||
      textWithoutBalance.match(/\b(?:debited\s+by|paid|spent|sent)\s+([\d,]+(?:\.\d{1,2})?)/i) ||
      textWithoutBalance.match(/\b([\d,]+(?:\.\d{1,2})?)\b/);

    if (!amountMatch || !amountMatch[1]) continue;

    const parsedAmount = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (isNaN(parsedAmount) || parsedAmount <= 0) continue;

    // 2. Type detection: Income vs Expense
    const isIncome =
      /\b(?:credited|received|salary|refund|cashback|deposited)\b/i.test(chunk) &&
      !/\b(?:debited|paid|spent|sent|transferred\s+to)\b/i.test(chunk);

    // 3. Payment Mode detection
    let paymentMode = "UPI";
    if (/\b(?:credit\s*card|cc)\b/i.test(chunk)) paymentMode = "Credit Card";
    else if (/\b(?:debit\s*card|dc)\b/i.test(chunk)) paymentMode = "Debit Card";
    else if (/\bnet\s*banking\b/i.test(chunk)) paymentMode = "Net Banking";
    else if (/\bcash\b/i.test(chunk)) paymentMode = "Cash";
    else if (/\bgpay|google\s*pay\b/i.test(chunk)) paymentMode = "Google Pay";
    else if (/\bphonepe\b/i.test(chunk)) paymentMode = "PhonePe";
    else if (/\bpaytm\b/i.test(chunk)) paymentMode = "Paytm";

    // 4. Merchant detection
    let merchant = "";
    const merchantMatch =
      chunk.match(/(?:to|at|vpa|info|towards)\s+([A-Za-z0-9&.\-_ ]+?)(?:\s+(?:on|via|using|ref|a\/c|bal)|$)/i) ||
      chunk.match(/paid\s+to\s+([A-Za-z0-9&.\-_ ]+)/i);

    if (merchantMatch && merchantMatch[1]) {
      merchant = merchantMatch[1].trim().replace(/[.,;]+$/, "");
    } else {
      // Look for known merchants in text
      for (const m of Object.keys(MERCHANT_CATEGORY_MAP)) {
        if (new RegExp(`\\b${m}\\b`, "i").test(chunk)) {
          merchant = m.charAt(0).toUpperCase() + m.slice(1);
          break;
        }
      }
    }

    // 5. Category classification
    let category = isIncome ? "Salary" : "Other";
    const lowerChunk = chunk.toLowerCase();
    for (const [key, cat] of Object.entries(MERCHANT_CATEGORY_MAP)) {
      if (lowerChunk.includes(key)) {
        category = isIncome ? (cat === "Salary" ? "Salary" : "Refund") : cat;
        break;
      }
    }

    // Default food & dining if typical food words are present
    if (category === "Other") {
      if (/\b(?:lunch|dinner|breakfast|snack|chai|coffee|food|pizza|burger|meal)\b/i.test(chunk)) {
        category = "Food & dining";
      } else if (/\b(?:cab|taxi|train|bus|fuel|petrol|toll)\b/i.test(chunk)) {
        category = "Travel";
      } else if (/\b(?:groceries|fruits|sabzi|mart|market)\b/i.test(chunk)) {
        category = "Groceries";
      }
    }

    // 6. Occurred Date parsing
    const occurredAt = parseDateFromIndianSms(chunk);

    // 7. Clean concise note
    const singleLineChunk = chunk.replace(/\s+/g, " ").trim();
    const note = merchant
      ? `${merchant} · ${singleLineChunk.slice(0, 60)}`
      : singleLineChunk.length > 50
        ? singleLineChunk.slice(0, 50) + "…"
        : singleLineChunk;

    results.push({
      amount: parsedAmount,
      type: isIncome ? "income" : "expense",
      category,
      merchant: merchant || (isIncome ? "Deposit" : "Payment"),
      paymentMode,
      note,
      occurredAt,
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
