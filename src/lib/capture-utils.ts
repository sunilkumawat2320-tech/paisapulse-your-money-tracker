export type CaptureRecord = {
  amount: number;
  category: string;
  merchant: string;
  occurredAt: string;
  paymentMode: string;
  note: string;
};

export async function fingerprintTransaction(entry: CaptureRecord): Promise<string> {
  const normalized = [
    entry.amount.toFixed(2),
    entry.occurredAt.slice(0, 10),
    entry.merchant.trim().toLocaleLowerCase("en-IN"),
    entry.category.trim().toLocaleLowerCase("en-IN"),
    entry.paymentMode.trim().toLocaleLowerCase("en-IN"),
    entry.note.trim().toLocaleLowerCase("en-IN"),
  ].join("|");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}