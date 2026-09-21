"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAgreementDraftAction } from "@/app/actions/agreements";
import { createSerialSaveQueue } from "@/lib/agreements/draft-save-queue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MoneyField } from "@/components/agreements/money-field";
import { ScopeList } from "@/components/agreements/scope-list";
import { StageList } from "@/components/agreements/stage-list";
import {
  calculateShortFormPricing,
  calculateStagedPricing,
} from "@/lib/agreements/pricing";
import { formatAudFromCents } from "@/lib/money";
import { cn } from "@/lib/cn";
import {
  applyShortFormPricingType,
  shortFormFeeLabel,
  shouldPopulatePractitionerHourlyRate,
} from "@/lib/agreements/short-form-pricing";
import type { Practitioner } from "@/lib/types/database";
import type { AgreementDraft } from "@/lib/validations";

export function AgreementForm({
  initialDraft,
  practitioners,
}: {
  initialDraft: AgreementDraft;
  practitioners: Pick<
    Practitioner,
    "id" | "full_name" | "title" | "default_hourly_rate_cents" | "is_active"
  >[];
}) {
  const router = useRouter();
  const [draft, setDraftState] = useState(initialDraft);
  const [saveState, setSaveState] = useState("Saved");
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const skipFirst = useRef(true);
  const draftRef = useRef(initialDraft);
  const debounceRef = useRef<number | null>(null);
  const reviewingRef = useRef(false);
  const queueRef = useRef(
    createSerialSaveQueue(async (nextDraft: AgreementDraft) => {
      const result = await saveAgreementDraftAction(nextDraft);
      if (result.error) {
        return { error: result.error };
      }
      return { ok: true };
    }),
  );

  function updateDraft(updater: (current: AgreementDraft) => AgreementDraft) {
    setDraftState((current) => {
      const next = updater(current);
      draftRef.current = next;
      return next;
    });
  }

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    setSaveState("Saving…");
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void queueRef.current.enqueue(draftRef.current).then((result) => {
        if (reviewingRef.current) {
          return;
        }
        if ("error" in result) {
          setSaveState("Save failed");
          setError(result.error);
          return;
        }
        setError(null);
        setSaveState("Saved");
      });
    }, 700);
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [draft]);

  const shortForm = calculateShortFormPricing(draft.pricing);
  const staged = calculateStagedPricing({
    stages: draft.stages,
    disbursementsCents: draft.pricing.disbursementsCents,
    miscellaneousFeesCents: draft.pricing.miscellaneousFeesCents,
    amountRequestedUpfrontCents: draft.pricing.amountRequestedUpfrontCents,
  });
  const isShort = draft.agreementType === "short_form";

  function updatePricing<K extends keyof AgreementDraft["pricing"]>(
    key: K,
    value: AgreementDraft["pricing"][K],
  ) {
    updateDraft((current) => ({
      ...current,
      pricing: { ...current.pricing, [key]: value },
    }));
  }

  async function handleReview() {
    if (reviewingRef.current) {
      return;
    }
    reviewingRef.current = true;
    setReviewing(true);
    setSaveState("Saving…");
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (typeof document !== "undefined") {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        active.blur();
      }
    }
    const latest = draftRef.current;
    const result = await queueRef.current.saveNow(latest);
    if ("error" in result) {
      reviewingRef.current = false;
      setReviewing(false);
      setSaveState("Save failed");
      setError(result.error);
      return;
    }
    router.push(`/agreements/${latest.agreementId}`);
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs uppercase tracking-[0.14em] text-ink-muted">{saveState}</p>
        <Button variant="secondary" disabled={reviewing} onClick={() => void handleReview()}>
          {reviewing ? "Saving…" : "Review"}
        </Button>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Client</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="clientName">Full name</Label>
            <Input
              id="clientName"
              value={draft.client.fullName}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  client: { ...current.client, fullName: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientEmail">Email</Label>
            <Input
              id="clientEmail"
              type="email"
              value={draft.client.email}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  client: { ...current.client, email: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientPhone">Phone</Label>
            <Input
              id="clientPhone"
              value={draft.client.phone}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  client: { ...current.client, phone: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="clientAddress">Address</Label>
            <Input
              id="clientAddress"
              value={draft.client.addressLine1}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  client: { ...current.client, addressLine1: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientSuburb">Suburb</Label>
            <Input
              id="clientSuburb"
              value={draft.client.suburb}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  client: { ...current.client, suburb: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientState">State</Label>
            <Input
              id="clientState"
              value={draft.client.state}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  client: { ...current.client, state: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientPostcode">Postcode</Label>
            <Input
              id="clientPostcode"
              value={draft.client.postcode}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  client: { ...current.client, postcode: event.target.value },
                }))
              }
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Matter</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="matterNumber">Reference number</Label>
            <Input
              id="matterNumber"
              value={draft.matter.referenceNumber}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  matter: { ...current.matter, referenceNumber: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instructionsDate">Instructions date</Label>
            <Input
              id="instructionsDate"
              type="date"
              value={draft.matter.instructionsDate}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  matter: { ...current.matter, instructionsDate: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="matterTitle">Matter title</Label>
            <Input
              id="matterTitle"
              value={draft.matter.title}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  matter: { ...current.matter, title: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="matterDescription">Matter description</Label>
            <Textarea
              id="matterDescription"
              value={draft.matter.description}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  matter: { ...current.matter, description: event.target.value },
                }))
              }
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="practitioner">Responsible practitioner</Label>
            <Select
              id="practitioner"
              value={draft.matter.responsiblePractitionerId}
              onChange={(event) => {
                const practitioner = practitioners.find((item) => item.id === event.target.value);
                updateDraft((current) => ({
                  ...current,
                  matter: {
                    ...current.matter,
                    responsiblePractitionerId: event.target.value,
                  },
                  pricing:
                    isShort &&
                    practitioner &&
                    shouldPopulatePractitionerHourlyRate(
                      current.matter.pricingType,
                      current.pricing.hourlyRateCents,
                    )
                      ? {
                          ...current.pricing,
                          hourlyRateCents: practitioner.default_hourly_rate_cents,
                        }
                      : current.pricing,
                }));
              }}
            >
              <option value="">Select</option>
              {practitioners
                .filter((item) => item.is_active)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name}
                    {item.title ? ` · ${item.title}` : ""}
                  </option>
                ))}
            </Select>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl">Scope</h2>
        {!isShort ? (
          <div className="space-y-2">
            <Label htmlFor="generalScope">General scope statement</Label>
            <Textarea
              id="generalScope"
              value={draft.generalScopeStatement}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  generalScopeStatement: event.target.value,
                }))
              }
            />
          </div>
        ) : null}
        <ScopeList
          items={draft.scopeItems}
          onChange={(scopeItems) => updateDraft((current) => ({ ...current, scopeItems }))}
        />
        {!isShort ? (
          <div className="space-y-2">
            <Label htmlFor="exclusions">Exclusions</Label>
            <Textarea
              id="exclusions"
              value={draft.exclusions}
              onChange={(event) =>
                updateDraft((current) => ({ ...current, exclusions: event.target.value }))
              }
            />
          </div>
        ) : null}
      </section>

      {isShort ? (
        <section className="space-y-4">
          <h2 className="font-serif text-xl">Costs</h2>
          <div className="space-y-2">
            <Label>Costs basis</Label>
            <div className="inline-flex border border-rule-strong">
              {(["hourly", "fixed_fee"] as const).map((basis) => {
                const selected = draft.matter.pricingType === basis;
                return (
                  <button
                    key={basis}
                    type="button"
                    className={cn(
                      "h-10 px-4 text-sm font-medium",
                      selected
                        ? "bg-accent text-paper-raised"
                        : "bg-paper-raised text-ink hover:border-ink",
                    )}
                    onClick={() => {
                      const practitioner = practitioners.find(
                        (item) => item.id === draft.matter.responsiblePractitionerId,
                      );
                      updateDraft((current) =>
                        applyShortFormPricingType(
                          current,
                          basis,
                          practitioner?.default_hourly_rate_cents ?? 0,
                        ),
                      );
                    }}
                  >
                    {basis === "hourly" ? "Hourly" : "Fixed fee"}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              id="hourlyRate"
              label="Hourly rate"
              valueCents={draft.pricing.hourlyRateCents}
              disabled={draft.matter.pricingType === "fixed_fee"}
              onChange={(value) => updatePricing("hourlyRateCents", value)}
            />
            <MoneyField
              id="fees"
              label={shortFormFeeLabel(draft.matter.pricingType)}
              valueCents={draft.pricing.professionalFeesExGstCents}
              onChange={(value) => updatePricing("professionalFeesExGstCents", value)}
            />
            <MoneyField
              id="discount"
              label="Discount"
              valueCents={draft.pricing.discountCents}
              onChange={(value) => updatePricing("discountCents", value)}
            />
            <MoneyField
              id="disbursements"
              label="Disbursements"
              valueCents={draft.pricing.disbursementsCents}
              onChange={(value) => updatePricing("disbursementsCents", value)}
            />
            <MoneyField
              id="upfront"
              label="Amount requested upfront"
              valueCents={draft.pricing.amountRequestedUpfrontCents}
              onChange={(value) => updatePricing("amountRequestedUpfrontCents", value)}
            />
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-ink-muted">Subtotal</dt>
              <dd className="tabular-nums">{formatAudFromCents(shortForm.subtotalExGstCents)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">GST</dt>
              <dd className="tabular-nums">{formatAudFromCents(shortForm.gstCents)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Total incl GST</dt>
              <dd className="tabular-nums">{formatAudFromCents(shortForm.totalInclGstCents)}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="font-serif text-xl">Rates</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyField
                id="principalRate"
                label="Principal lawyer rate"
                valueCents={draft.pricing.principalLawyerRateCents}
                onChange={(value) => updatePricing("principalLawyerRateCents", value)}
              />
              <MoneyField
                id="specialCounselRate"
                label="Special counsel rate"
                valueCents={draft.pricing.specialCounselRateCents}
                onChange={(value) => updatePricing("specialCounselRateCents", value)}
              />
              <MoneyField
                id="seniorLawyerRate"
                label="Senior lawyer rate"
                valueCents={draft.pricing.seniorLawyerRateCents}
                onChange={(value) => updatePricing("seniorLawyerRateCents", value)}
              />
              <MoneyField
                id="lawyerRate"
                label="Lawyer rate"
                valueCents={draft.pricing.lawyerRateCents}
                onChange={(value) => updatePricing("lawyerRateCents", value)}
              />
              <MoneyField
                id="paralegalRate"
                label="Paralegal / law clerk rate"
                valueCents={draft.pricing.paralegalRateCents}
                onChange={(value) => updatePricing("paralegalRateCents", value)}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-serif text-xl">Stages</h2>
            <StageList
              stages={draft.stages}
              onChange={(stages) => updateDraft((current) => ({ ...current, stages }))}
            />
          </section>

          <section className="space-y-4">
            <h2 className="font-serif text-xl">Consultants</h2>
            <p className="text-sm text-ink-muted">Optional. Leave blank if not used.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyField
                id="scHourlyMin"
                label="Senior counsel hourly from"
                valueCents={draft.pricing.seniorCounselHourlyMinCents}
                onChange={(value) => updatePricing("seniorCounselHourlyMinCents", value)}
              />
              <MoneyField
                id="scHourlyMax"
                label="Senior counsel hourly to"
                valueCents={draft.pricing.seniorCounselHourlyMaxCents}
                onChange={(value) => updatePricing("seniorCounselHourlyMaxCents", value)}
              />
              <MoneyField
                id="scDailyMin"
                label="Senior counsel daily from"
                valueCents={draft.pricing.seniorCounselDailyMinCents}
                onChange={(value) => updatePricing("seniorCounselDailyMinCents", value)}
              />
              <MoneyField
                id="scDailyMax"
                label="Senior counsel daily to"
                valueCents={draft.pricing.seniorCounselDailyMaxCents}
                onChange={(value) => updatePricing("seniorCounselDailyMaxCents", value)}
              />
              <MoneyField
                id="jcHourlyMin"
                label="Junior counsel hourly from"
                valueCents={draft.pricing.juniorCounselHourlyMinCents}
                onChange={(value) => updatePricing("juniorCounselHourlyMinCents", value)}
              />
              <MoneyField
                id="jcHourlyMax"
                label="Junior counsel hourly to"
                valueCents={draft.pricing.juniorCounselHourlyMaxCents}
                onChange={(value) => updatePricing("juniorCounselHourlyMaxCents", value)}
              />
              <MoneyField
                id="jcDailyMin"
                label="Junior counsel daily from"
                valueCents={draft.pricing.juniorCounselDailyMinCents}
                onChange={(value) => updatePricing("juniorCounselDailyMinCents", value)}
              />
              <MoneyField
                id="jcDailyMax"
                label="Junior counsel daily to"
                valueCents={draft.pricing.juniorCounselDailyMaxCents}
                onChange={(value) => updatePricing("juniorCounselDailyMaxCents", value)}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="font-serif text-xl">Other costs</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyField
                id="stagedDisbursements"
                label="Disbursements"
                valueCents={draft.pricing.disbursementsCents}
                onChange={(value) => updatePricing("disbursementsCents", value)}
              />
              <MoneyField
                id="misc"
                label="Miscellaneous fees"
                valueCents={draft.pricing.miscellaneousFeesCents}
                onChange={(value) => updatePricing("miscellaneousFeesCents", value)}
              />
              <MoneyField
                id="stagedUpfront"
                label="Amount requested upfront"
                valueCents={draft.pricing.amountRequestedUpfrontCents}
                onChange={(value) => updatePricing("amountRequestedUpfrontCents", value)}
              />
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-ink-muted">Solicitor estimates</dt>
                <dd className="tabular-nums">{formatAudFromCents(staged.solicitorTotalCents)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">GST on solicitor estimates</dt>
                <dd className="tabular-nums">{formatAudFromCents(staged.gstCents)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Total estimate</dt>
                <dd className="tabular-nums">{formatAudFromCents(staged.totalEstimateCents)}</dd>
              </div>
            </dl>
          </section>
        </>
      )}
    </div>
  );
}
