import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fingerprintTransaction, type CaptureRecord } from "@/lib/capture-utils";

const recordSchema = z.object({
  amount: z.number().positive().max(10_000_000),
  category: z.string().trim().min(1).max(80),
  merchant: z.string().max(160),
  occurredAt: z.string().datetime(),
  paymentMode: z.string().max(80),
  note: z.string().max(500),
});

const parsedSchema = z.object({
  entries: z.array(recordSchema).max(50),
  transcript: z.string().max(8000),
});

const inputSchema = z.object({
  source: z.enum(["text", "audio", "camera", "bill", "screenshot"]),
  text: z.string().max(8000).optional(),
  mimeType: z.string().max(100).optional(),
  dataBase64: z.string().max(18_000_000).optional(),
});

const statementSchema = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.string().max(100),
  text: z.string().max(1_500_000).optional(),
  dataBase64: z.string().max(18_000_000).optional(),
}).refine((value) => Boolean(value.text?.trim() || value.dataBase64), "The statement file is empty.");

const entryJsonSchema = {
  type: "OBJECT",
  properties: {
    amount: { type: "NUMBER" },
    category: { type: "STRING" },
    merchant: { type: "STRING" },
    occurredAt: { type: "STRING" },
    paymentMode: { type: "STRING" },
    note: { type: "STRING" },
  },
  required: ["amount", "category", "merchant", "occurredAt", "paymentMode", "note"],
};

async function callGemini(prompt: string, media?: { mimeType: string; dataBase64: string }) {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("Google AI Studio is not connected yet. Please add its API key in project settings.");

  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  if (media) parts.push({ inline_data: { mime_type: media.mimeType, data: media.dataBase64 } });

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
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
          required: ["entries", "transcript"],
        },
      },
    }),
  });

  const payload = await response.json().catch(() => null) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  } | null;
  if (!response.ok) {
    const reason = payload?.error?.message;
    if (response.status === 401 || response.status === 403) {
      throw new Error(reason || "Google AI Studio did not accept this API key. Check the key and its API access in AI Studio.");
    }
    if (response.status === 429) throw new Error(reason || "Google AI Studio is rate-limiting requests. Please try again later.");
    throw new Error(reason || `Google AI Studio could not process this request (${response.status}).`);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;
  if (!text) throw new Error("No transaction details could be read. Try a clearer photo or more specific description.");
  try {
    return parsedSchema.parse(JSON.parse(text));
  } catch {
    throw new Error("The transaction details could not be structured. Please try again with a clearer input.");
  }
}

function makePrompt(source: string, text?: string) {
  return [
    "Extract personal finance transactions from the user's input. Return every separate expense or income entry; do not invent values.",
    "For each entry use a positive rupee amount, a short category, merchant (empty if unknown), ISO-8601 date/time (use current date if no date is shown), payment mode (empty if unknown), and concise note.",
    "Use type only as expense/income in the note prefix when relevant; keep category readable. For audio, include a faithful transcript. If no transaction is found return an empty entries array.",
    `Input source: ${source}. Current date: ${new Date().toISOString()}.`,
    text ? `User text: ${text}` : "Read the attached media.",
  ].join("\n");
}

export const parseCaptureInput = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.source === "text" && !data.text?.trim()) throw new Error("Type one or more expenses first.");
    if (data.source !== "text" && !data.dataBase64) throw new Error("Choose a file or record audio before continuing.");
    const parsed = await callGemini(makePrompt(data.source, data.text), data.dataBase64 && data.mimeType
      ? { dataBase64: data.dataBase64, mimeType: data.mimeType }
      : undefined);
    return { ...parsed, source: data.source };
  });

export const confirmCaptureEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ source: inputSchema.shape.source, rawText: z.string().max(8000), entries: z.array(recordSchema).min(1).max(50) }).parse(input))
  .handler(async ({ data, context }) => {
    const records: CaptureRecord[] = data.entries;
    const fingerprints = await Promise.all(records.map(fingerprintTransaction));
    const rows = records.map((entry, index) => ({
      user_id: context.userId,
      amount: entry.amount,
      category: entry.category,
      merchant: entry.merchant || null,
      occurred_at: entry.occurredAt,
      payment_mode: entry.paymentMode || null,
      note: entry.note || null,
      raw_text: data.rawText || null,
      source: data.source,
      source_fingerprint: fingerprints[index],
    }));
    const { data: saved, error } = await context.supabase
      .from("transactions")
      .upsert(rows, { onConflict: "user_id,source_fingerprint", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    const count = saved?.length ?? 0;
    return { saved: count, duplicates: records.length - count };
  });

export const importCaptureStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => statementSchema.parse(input))
  .handler(async ({ data, context }) => {
    const parsed = await callGemini(
      `Extract every bank/card/UPI statement transaction from ${data.fileName}. Ignore balances, headings, and summary totals. Include only completed transactions, with amount, category, merchant, ISO date, payment mode, and note. Return an empty list if there are no transactions. ${data.text ? `Statement rows:\n${data.text}` : "Read the attached PDF."}`,
      data.dataBase64 ? { mimeType: data.mimeType, dataBase64: data.dataBase64 } : undefined,
    );
    const importId = crypto.randomUUID();
    const fingerprints = await Promise.all(parsed.entries.map(fingerprintTransaction));
    if (!parsed.entries.length) return { importId, imported: 0, duplicates: 0 };

    const rows = parsed.entries.map((entry, index) => ({
      user_id: context.userId,
      amount: entry.amount,
      category: entry.category,
      merchant: entry.merchant || null,
      occurred_at: entry.occurredAt,
      payment_mode: entry.paymentMode || null,
      note: entry.note || null,
      raw_text: `${data.fileName}\n${entry.note}`.slice(0, 8000),
      source: "statement",
      source_fingerprint: fingerprints[index],
      statement_import_id: importId,
    }));
    const { data: importedRows, error } = await context.supabase
      .from("transactions")
      .upsert(rows, { onConflict: "user_id,source_fingerprint", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    const imported = importedRows?.length ?? 0;
    return { importId, imported, duplicates: parsed.entries.length - imported };
  });

export const undoCaptureStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ importId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("transactions").delete().eq("statement_import_id", data.importId);
    if (error) throw new Error(error.message);
    return { undone: true };
  });