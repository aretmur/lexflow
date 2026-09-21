import type { AgreementType } from "@/lib/agreements/constants";
import type { PricingType } from "@/lib/types/enums";
import type { Cents } from "@/lib/money";

export type SnapshotParty = {
  fullName: string;
  email: string | null;
  phone: string | null;
  mobile?: string | null;
  title?: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
};

export type AgreementSnapshot = {
  capturedAt: string;
  template: {
    key: string;
    version: string;
    jurisdiction: string;
    legalReview: true;
  };
  attachment: {
    id: string;
    version: number;
    title: string;
    storagePath: string;
  } | null;
  firm: {
    legalEntityName: string;
    tradingName: string | null;
    abn: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    jurisdiction: string;
    logoPath: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
    bankName: string | null;
    accountName: string | null;
    bsb: string | null;
    accountNumber: string | null;
    paymentReferencePrefix: string | null;
    cyberFraudContactPhone: string | null;
  };
  practitioner: {
    fullName: string;
    title: string | null;
    email: string | null;
    mobile: string | null;
    defaultHourlyRateCents: Cents;
  } | null;
  client: SnapshotParty;
  matter: {
    referenceNumber: string;
    title: string;
    description: string | null;
    instructionsDate: string | null;
    jurisdiction: string;
  };
  agreementType: AgreementType;
  pricingType: PricingType;
  scopeItems: string[];
  generalScopeStatement: string | null;
  exclusions: string | null;
  pricing: Record<string, Cents | string | null>;
  stages: Array<{
    stageNumber: number;
    title: string;
    timing: string | null;
    scopeItems: string[];
    solicitorCostEstimateCents: Cents;
    consultantEstimateCents: Cents;
    notes: string | null;
  }>;
  amountRequestedUpfrontCents: Cents;
};

export function freezeSnapshot(snapshot: AgreementSnapshot): AgreementSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as AgreementSnapshot;
}
