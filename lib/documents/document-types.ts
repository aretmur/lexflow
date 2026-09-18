import type { AgreementSnapshot } from "@/lib/agreements/snapshot";
import type {
  ShortFormPricingResult,
  StagedPricingResult,
} from "@/lib/agreements/pricing";
import type { Cents } from "@/lib/money";
import type { TemplateMetadata } from "@/lib/documents/templates/vic/metadata";

export type ChargeOutRate = {
  position: string;
  exclusiveCents: Cents;
  inclusiveCents: Cents;
};

export type ConsultantRateRow = {
  label: string;
  hourlyMinCents: Cents;
  hourlyMaxCents: Cents;
  dailyMinCents: Cents;
  dailyMaxCents: Cents;
};

export type DocumentModel = {
  snapshot: AgreementSnapshot;
  metadata: TemplateMetadata;
  capturedDate: string;
  shortForm: ShortFormPricingResult | null;
  staged: StagedPricingResult | null;
  chargeOutRates: ChargeOutRate[];
  consultants: ConsultantRateRow[];
  logoBytes: Uint8Array | null;
};
