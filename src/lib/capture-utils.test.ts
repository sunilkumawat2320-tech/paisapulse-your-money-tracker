import { describe, expect, test } from "bun:test";

import { fingerprintTransaction, type CaptureRecord } from "./capture-utils";

const sample: CaptureRecord = {
  amount: 20,
  category: "Food & dining",
  merchant: "Chai shop",
  occurredAt: "2026-11-09T12:00:00.000Z",
  paymentMode: "UPI",
  note: "Tea",
};

describe("statement duplicate fingerprint", () => {
  test("matches the same transaction after case and whitespace normalization", async () => {
    const first = await fingerprintTransaction(sample);
    const repeated = await fingerprintTransaction({ ...sample, merchant: "  CHAI SHOP " });
    expect(repeated).toBe(first);
  });

  test("distinguishes transactions with a different amount", async () => {
    const first = await fingerprintTransaction(sample);
    const changedAmount = await fingerprintTransaction({ ...sample, amount: 80 });
    expect(changedAmount).not.toBe(first);
  });
});