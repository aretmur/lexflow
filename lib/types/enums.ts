export const MEMBERSHIP_ROLES = ["owner", "admin", "member"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const CLIENT_TYPES = ["individual", "company", "other"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const JURISDICTIONS = [
  "VIC",
  "NSW",
  "QLD",
  "SA",
  "WA",
  "TAS",
  "NT",
  "ACT",
  "CTH",
  "OTHER",
] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

export const PRICING_TYPES = [
  "fixed_fee",
  "staged_fixed_fee",
  "hourly",
  "estimate_range",
] as const;
export type PricingType = (typeof PRICING_TYPES)[number];

export const GST_TREATMENTS = [
  "gst_inclusive",
  "gst_exclusive",
  "gst_free",
  "not_applicable",
] as const;
export type GstTreatment = (typeof GST_TREATMENTS)[number];

export const MATTER_STATUSES = [
  "draft",
  "awaiting_agreement",
  "agreement_sent",
  "agreement_signed",
  "awaiting_funds",
  "funded",
  "active",
  "closed",
] as const;
export type MatterStatus = (typeof MATTER_STATUSES)[number];

export const AGREEMENT_STATUSES = [
  "draft",
  "ready_to_send",
  "sent",
  "viewed",
  "signed",
  "declined",
  "superseded",
] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

export const AGREEMENT_VERSION_STATUSES = [
  "draft",
  "issued",
  "signed",
  "superseded",
] as const;
export type AgreementVersionStatus = (typeof AGREEMENT_VERSION_STATUSES)[number];

export const FUNDING_REQUEST_STATUSES = [
  "draft",
  "sent",
  "partially_received",
  "received",
  "cancelled",
] as const;
export type FundingRequestStatus = (typeof FUNDING_REQUEST_STATUSES)[number];

export const DESTINATION_TYPES = ["trust", "office", "other"] as const;
export type DestinationType = (typeof DESTINATION_TYPES)[number];

export const TEMPLATE_STATUSES = [
  "draft",
  "under_legal_review",
  "approved",
  "retired",
] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const ACTIVE_MATTER_STATUSES = [
  "awaiting_agreement",
  "agreement_sent",
  "agreement_signed",
  "awaiting_funds",
  "funded",
  "active",
] as const satisfies readonly MatterStatus[];

export const AGREEMENTS_AWAITING_SIGNATURE_STATUSES = [
  "sent",
  "viewed",
] as const satisfies readonly AgreementStatus[];

export const AGREEMENTS_REQUIRING_ATTENTION_STATUSES = [
  "draft",
  "ready_to_send",
  "sent",
  "viewed",
  "declined",
] as const satisfies readonly AgreementStatus[];
