import { describe, expect, it } from "vitest";
import { emptyDraft } from "@/lib/agreements/draft";
import { createSerialSaveQueue, type DraftSaveResult } from "@/lib/agreements/draft-save-queue";
import { calculateShortFormPricing } from "@/lib/agreements/pricing";
import {
  applyShortFormPricingType,
  shortFormReviewShowsHourlyRate,
} from "@/lib/agreements/short-form-pricing";
import { formatAudFromCents, interpretMoneyFieldText } from "@/lib/money";
import type { AgreementDraft } from "@/lib/validations";

const AGREEMENT_ID = "33333333-3333-4333-a333-333333333333";

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function baseDraft(): AgreementDraft {
  return emptyDraft(AGREEMENT_ID, "short_form");
}

function withMoney(
  draft: AgreementDraft,
  field: keyof AgreementDraft["pricing"],
  typed: string,
): AgreementDraft {
  let cents = draft.pricing[field];
  let text = "";
  for (const character of typed) {
    text += character;
    const interpretation = interpretMoneyFieldText(text);
    if (interpretation.status === "valid") {
      cents = interpretation.cents;
    }
  }
  return {
    ...draft,
    pricing: { ...draft.pricing, [field]: cents },
  };
}

function hourlyDraft(): AgreementDraft {
  let draft = applyShortFormPricingType(baseDraft(), "hourly", 55_000);
  draft = withMoney(draft, "hourlyRateCents", "550");
  draft = withMoney(draft, "professionalFeesExGstCents", "4000");
  return draft;
}

function fixedFeeDraft(): AgreementDraft {
  let draft = applyShortFormPricingType(baseDraft(), "fixed_fee");
  draft = withMoney(draft, "professionalFeesExGstCents", "5000");
  draft = withMoney(draft, "discountCents", "500");
  draft = withMoney(draft, "disbursementsCents", "200");
  draft = withMoney(draft, "amountRequestedUpfrontCents", "2000");
  return draft;
}

function expectFixedFeeReview(draft: AgreementDraft) {
  expect(draft.matter.pricingType).toBe("fixed_fee");
  expect(shortFormReviewShowsHourlyRate(draft.matter.pricingType)).toBe(false);
  expect(formatAudFromCents(draft.pricing.professionalFeesExGstCents)).toBe("$5,000.00");
  expect(formatAudFromCents(draft.pricing.discountCents)).toBe("$500.00");
  const totals = calculateShortFormPricing(draft.pricing);
  expect(formatAudFromCents(totals.subtotalExGstCents)).toBe("$4,500.00");
  expect(formatAudFromCents(totals.gstCents)).toBe("$450.00");
  expect(formatAudFromCents(draft.pricing.disbursementsCents)).toBe("$200.00");
  expect(formatAudFromCents(totals.totalInclGstCents)).toBe("$5,150.00");
  expect(formatAudFromCents(draft.pricing.amountRequestedUpfrontCents)).toBe("$2,000.00");
}

function expectHourlyReview(draft: AgreementDraft) {
  expect(draft.matter.pricingType).toBe("hourly");
  expect(shortFormReviewShowsHourlyRate(draft.matter.pricingType)).toBe(true);
  expect(formatAudFromCents(draft.pricing.hourlyRateCents)).toBe("$550.00");
  expect(formatAudFromCents(draft.pricing.professionalFeesExGstCents)).toBe("$4,000.00");
}

async function reviewLatest(
  queue: ReturnType<typeof createSerialSaveQueue<AgreementDraft>>,
  draftRef: { current: AgreementDraft },
) {
  return queue.saveNow(draftRef.current);
}

describe("serial draft save queue", () => {
  it("never runs overlapping saves", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const started = deferred();
    const release = deferred();
    const queue = createSerialSaveQueue<string>(async () => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      started.resolve();
      await release.promise;
      concurrent -= 1;
      return { ok: true };
    });

    const first = queue.enqueue("A");
    await started.promise;
    const second = queue.enqueue("B");
    release.resolve();
    await Promise.all([first, second]);
    expect(maxConcurrent).toBe(1);
  });

  it("collapses intermediate drafts and saves the newest pending state", async () => {
    const written: string[] = [];
    const releaseA = deferred();
    let saves = 0;
    const queue = createSerialSaveQueue<string>(async (value) => {
      saves += 1;
      if (saves === 1) {
        await releaseA.promise;
      }
      written.push(value);
      return { ok: true };
    });

    const first = queue.enqueue("A");
    void queue.enqueue("B");
    const latest = queue.enqueue("C");
    releaseA.resolve();
    await Promise.all([first, latest]);
    expect(written).toEqual(["A", "C"]);
  });

  it("Review uses the latest draft ref, not a stale closure", async () => {
    const written: AgreementDraft[] = [];
    const releaseA = deferred();
    let saves = 0;
    const queue = createSerialSaveQueue<AgreementDraft>(async (draft) => {
      saves += 1;
      if (saves === 1) {
        await releaseA.promise;
      }
      written.push(draft);
      return { ok: true };
    });

    const draftRef = { current: hourlyDraft() };
    const stale = draftRef.current;
    void queue.enqueue(stale);
    draftRef.current = fixedFeeDraft();
    const review = reviewLatest(queue, draftRef);
    releaseA.resolve();
    const result = await review;
    expect(result).toEqual({ ok: true });
    expect(written.at(-1)).toBe(draftRef.current);
    expect(written.at(-1)?.matter.pricingType).toBe("fixed_fee");
    expect(stale.matter.pricingType).toBe("hourly");
  });

  it("Review waits for an in-flight save then writes the latest draft", async () => {
    const order: string[] = [];
    const releaseA = deferred();
    let saves = 0;
    const queue = createSerialSaveQueue<string>(async (value) => {
      saves += 1;
      if (value === "A") {
        await releaseA.promise;
      }
      order.push(value);
      return { ok: true };
    });

    void queue.enqueue("A");
    const review = queue.saveNow("B");
    await Promise.resolve();
    expect(order).toEqual([]);
    expect(saves).toBe(1);
    releaseA.resolve();
    await review;
    expect(order).toEqual(["A", "B"]);
  });

  it("does not navigate-equivalent succeed when the latest save fails", async () => {
    const queue = createSerialSaveQueue<string>(async (value) => {
      if (value === "B") {
        return { error: "persist failed" };
      }
      return { ok: true };
    });
    await queue.enqueue("A");
    const result = await queue.saveNow("B");
    expect(result).toEqual({ error: "persist failed" });
  });

  it("autosaves cannot overwrite newer state even with artificial latency", async () => {
    const written: string[] = [];
    const finishA = deferred();
    let sequence = 0;
    let aFinishedAt = 0;
    let bStartedAt = 0;
    const queue = createSerialSaveQueue<string>(async (value) => {
      if (value === "A") {
        await finishA.promise;
        aFinishedAt = ++sequence;
      }
      if (value === "B") {
        bStartedAt = ++sequence;
      }
      written.push(value);
      return { ok: true };
    });

    const autosaveA = queue.enqueue("A");
    const reviewB = queue.saveNow("B");
    finishA.resolve();
    await Promise.all([autosaveA, reviewB]);
    expect(written).toEqual(["A", "B"]);
    expect(written.at(-1)).toBe("B");
    expect(bStartedAt).toBeGreaterThan(aFinishedAt);
  });
});

describe("short-form editor save workflows", () => {
  it("fixed fee immediate Review preserves basis and money fields", async () => {
    const persisted: AgreementDraft[] = [];
    const queue = createSerialSaveQueue<AgreementDraft>(async (draft) => {
      persisted.push(structuredClone(draft));
      return { ok: true };
    });

    const draftRef = { current: applyShortFormPricingType(hourlyDraft(), "fixed_fee") };
    draftRef.current = withMoney(draftRef.current, "professionalFeesExGstCents", "5000");
    draftRef.current = withMoney(draftRef.current, "discountCents", "500");
    draftRef.current = withMoney(draftRef.current, "disbursementsCents", "200");
    draftRef.current = withMoney(draftRef.current, "amountRequestedUpfrontCents", "2000");

    const result = await reviewLatest(queue, draftRef);
    expect(result).toEqual({ ok: true });
    const saved = persisted.at(-1);
    expect(saved).toBeTruthy();
    expectFixedFeeReview(saved!);
  });

  it("fixed fee Review then Edit reloads the same values", async () => {
    let store: AgreementDraft | null = null;
    const queue = createSerialSaveQueue<AgreementDraft>(async (draft) => {
      store = structuredClone(draft);
      return { ok: true };
    });
    const draftRef = { current: fixedFeeDraft() };
    await reviewLatest(queue, draftRef);
    const reloaded = structuredClone(store!);
    expectFixedFeeReview(reloaded);
  });

  it("hourly Review then Edit reloads the same values", async () => {
    let store: AgreementDraft | null = null;
    const queue = createSerialSaveQueue<AgreementDraft>(async (draft) => {
      store = structuredClone(draft);
      return { ok: true };
    });
    const draftRef = { current: hourlyDraft() };
    await reviewLatest(queue, draftRef);
    expectHourlyReview(store!);
  });

  it("switching hourly to fixed fee then immediately Review stays fixed_fee", async () => {
    const persisted: AgreementDraft[] = [];
    const releaseHourly = deferred();
    let saves = 0;
    const queue = createSerialSaveQueue<AgreementDraft>(async (draft) => {
      saves += 1;
      if (saves === 1) {
        await releaseHourly.promise;
      }
      persisted.push(structuredClone(draft));
      return { ok: true };
    });

    const draftRef = { current: hourlyDraft() };
    void queue.enqueue(draftRef.current);
    draftRef.current = fixedFeeDraft();
    const review = reviewLatest(queue, draftRef);
    releaseHourly.resolve();
    await review;
    expectFixedFeeReview(persisted.at(-1)!);
  });

  it("switching fixed fee to hourly then immediately Review stays hourly", async () => {
    const persisted: AgreementDraft[] = [];
    const releaseFixed = deferred();
    let saves = 0;
    const queue = createSerialSaveQueue<AgreementDraft>(async (draft) => {
      saves += 1;
      if (saves === 1) {
        await releaseFixed.promise;
      }
      persisted.push(structuredClone(draft));
      return { ok: true };
    });

    const draftRef = { current: fixedFeeDraft() };
    void queue.enqueue(draftRef.current);
    draftRef.current = hourlyDraft();
    const review = reviewLatest(queue, draftRef);
    releaseFixed.resolve();
    await review;
    expectHourlyReview(persisted.at(-1)!);
  });

  it("rapid hourly then fixed_fee Review cannot finish with the old hourly write", async () => {
    const persisted: AgreementDraft[] = [];
    const releaseA = deferred();
    let saves = 0;
    const queue = createSerialSaveQueue<AgreementDraft>(async (draft) => {
      saves += 1;
      if (saves === 1) {
        await releaseA.promise;
      }
      persisted.push(structuredClone(draft));
      return { ok: true };
    });

    const draftA = applyShortFormPricingType(baseDraft(), "hourly");
    const draftB = withMoney(
      applyShortFormPricingType(draftA, "fixed_fee"),
      "professionalFeesExGstCents",
      "5000",
    );
    void queue.enqueue(draftA);
    const review = queue.saveNow(draftB);
    releaseA.resolve();
    await review;
    expect(persisted.map((item) => item.matter.pricingType)).toEqual(["hourly", "fixed_fee"]);
    expect(persisted.at(-1)?.pricing.professionalFeesExGstCents).toBe(500_000);
  });
});

describe("failed latest save", () => {
  it("does not treat a failed Review save as success", async () => {
    const results: DraftSaveResult[] = [];
    const queue = createSerialSaveQueue<AgreementDraft>(async () => ({
      error: "network",
    }));
    const result = await queue.saveNow(fixedFeeDraft());
    results.push(result);
    expect(results[0]).toEqual({ error: "network" });
  });
});
