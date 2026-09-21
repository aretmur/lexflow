import type { AgreementType } from "@/lib/agreements/constants";
import type {
  AgreementStatus,
  AgreementVersionStatus,
  ClientType,
  DestinationType,
  FundingRequestStatus,
  GstTreatment,
  Jurisdiction,
  MatterStatus,
  MembershipRole,
  PricingType,
  SignatureProviderName,
  SignatureRequestStatus,
  SigningMode,
  TemplateStatus,
} from "@/lib/types/enums";

type EmptyRelationships = [];

export type Firm = {
  id: string;
  name: string;
  practice_name: string | null;
  abn: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  jurisdiction: Jurisdiction;
  logo_path: string | null;
  address_line1: string | null;
  address_line2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  bank_name: string | null;
  account_name: string | null;
  bsb: string | null;
  account_number: string | null;
  payment_reference_prefix: string | null;
  cyber_fraud_contact_phone: string | null;
  require_page_initials: boolean;
  created_at: string;
  updated_at: string;
};

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at: string;
};

export type FirmMembership = {
  id: string;
  firm_id: string;
  user_id: string;
  role: MembershipRole;
  created_at: string;
};

export type Practitioner = {
  id: string;
  firm_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  title: string | null;
  mobile: string | null;
  practising_certificate_number: string | null;
  default_hourly_rate_cents: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  firm_id: string;
  display_name: string;
  client_type: ClientType;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  created_at: string;
  updated_at: string;
};

export type Matter = {
  id: string;
  firm_id: string;
  client_id: string;
  responsible_practitioner_id: string | null;
  matter_number: string;
  matter_title: string;
  matter_description: string | null;
  instructions_date: string | null;
  jurisdiction: Jurisdiction;
  practice_area: string | null;
  pricing_type: PricingType;
  agreed_or_estimated_cost_cents: number;
  gst_treatment: GstTreatment;
  status: MatterStatus;
  created_at: string;
  updated_at: string;
};

export type LegalTemplate = {
  id: string;
  firm_id: string;
  template_name: string;
  jurisdiction: Jurisdiction;
  version: string;
  effective_date: string | null;
  status: TemplateStatus;
  approved_by: string | null;
  last_reviewed_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CostsAgreement = {
  id: string;
  firm_id: string;
  matter_id: string;
  template_id: string | null;
  agreement_type: AgreementType;
  jurisdiction: Jurisdiction;
  template_key: string;
  template_version: string;
  status: AgreementStatus;
  snapshot_frozen_at: string | null;
  required_attachment_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AgreementVersion = {
  id: string;
  firm_id: string;
  costs_agreement_id: string;
  version_number: number;
  status: AgreementVersionStatus;
  snapshot: Record<string, unknown>;
  executed_at: string | null;
  created_at: string;
};

export type AgreementPricing = {
  costs_agreement_id: string;
  firm_id: string;
  hourly_rate_cents: number;
  professional_fees_ex_gst_cents: number;
  discount_cents: number;
  disbursements_cents: number;
  miscellaneous_fees_cents: number;
  amount_requested_upfront_cents: number;
  subtotal_ex_gst_cents: number;
  gst_cents: number;
  total_incl_gst_cents: number;
  total_estimate_cents: number;
  principal_lawyer_rate_cents: number;
  special_counsel_rate_cents: number;
  senior_lawyer_rate_cents: number;
  lawyer_rate_cents: number;
  paralegal_rate_cents: number;
  senior_counsel_hourly_min_cents: number;
  senior_counsel_hourly_max_cents: number;
  senior_counsel_daily_min_cents: number;
  senior_counsel_daily_max_cents: number;
  junior_counsel_hourly_min_cents: number;
  junior_counsel_hourly_max_cents: number;
  junior_counsel_daily_min_cents: number;
  junior_counsel_daily_max_cents: number;
  general_scope_statement: string | null;
  exclusions: string | null;
  created_at: string;
  updated_at: string;
};

export type AgreementStage = {
  id: string;
  firm_id: string;
  costs_agreement_id: string;
  position: number;
  stage_number: number;
  title: string;
  timing: string | null;
  solicitor_cost_estimate_cents: number;
  consultant_estimate_cents: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AgreementScopeItem = {
  id: string;
  firm_id: string;
  costs_agreement_id: string;
  stage_id: string | null;
  position: number;
  body: string;
  created_at: string;
};

export type RequiredAttachment = {
  id: string;
  firm_id: string;
  title: string;
  version: number;
  storage_path: string;
  original_filename: string;
  content_type: string;
  byte_size: number;
  is_active: boolean;
  uploaded_by: string;
  uploaded_at: string;
  used_at: string | null;
};

export type FundingRequest = {
  id: string;
  firm_id: string;
  matter_id: string;
  amount_requested_cents: number;
  date_requested: string;
  due_date: string | null;
  description: string | null;
  status: FundingRequestStatus;
  created_by: string;
  created_at: string;
};

export type FundingReceipt = {
  id: string;
  firm_id: string;
  matter_id: string;
  funding_request_id: string | null;
  amount_received_cents: number;
  date_received: string;
  recorded_by: string;
  reference: string | null;
  note: string | null;
  destination_type: DestinationType;
  created_at: string;
};

export type GeneratedAgreementPack = {
  id: string;
  firm_id: string;
  costs_agreement_id: string;
  agreement_version_id: string;
  version_number: number;
  generated_at: string;
  generated_by: string;
  template_key: string;
  template_version: string;
  required_attachment_id: string;
  storage_path: string;
  sha256: string;
  page_count: number;
  byte_size: number;
};

export type SignatureRequest = {
  id: string;
  firm_id: string;
  costs_agreement_id: string;
  agreement_version_id: string;
  generated_pack_id: string;
  provider: SignatureProviderName;
  provider_request_id: string | null;
  signer_name: string;
  signer_email: string;
  status: SignatureRequestStatus;
  test_mode: boolean;
  last_error: string | null;
  last_webhook_event_id: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  require_page_initials: boolean;
  initials_field_count: number;
  page_count: number;
  signing_mode: SigningMode;
  provider_signature_id: string | null;
  signing_token_hash: string | null;
  signing_token_expires_at: string | null;
};

export type SignatureWebhookEvent = {
  id: string;
  firm_id: string;
  signature_request_id: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed_at: string;
};

export type SignedAgreementDocument = {
  id: string;
  firm_id: string;
  costs_agreement_id: string;
  agreement_version_id: string;
  signature_request_id: string;
  storage_path: string;
  sha256: string;
  page_count: number;
  byte_size: number;
  signed_at: string;
  created_at: string;
};

export type AuditEvent = {
  id: string;
  firm_id: string;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
};

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: EmptyRelationships;
};

export type Database = {
  public: {
    Tables: {
      firms: Table<Firm, Partial<Firm> & Pick<Firm, "name">, Partial<Firm>>;
      users: Table<
        UserProfile,
        Pick<UserProfile, "id" | "email"> & Partial<UserProfile>,
        Partial<Pick<UserProfile, "email" | "full_name">>
      >;
      firm_memberships: Table<
        FirmMembership,
        Omit<FirmMembership, "id" | "created_at"> & { id?: string; created_at?: string },
        Partial<Pick<FirmMembership, "role">>
      >;
      practitioners: Table<
        Practitioner,
        Partial<Practitioner> & Pick<Practitioner, "firm_id" | "full_name">,
        Partial<Practitioner>
      >;
      clients: Table<
        Client,
        Partial<Client> & Pick<Client, "firm_id" | "display_name">,
        Partial<Client>
      >;
      matters: Table<
        Matter,
        Omit<Matter, "id" | "created_at" | "updated_at" | "instructions_date"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          instructions_date?: string | null;
        },
        Partial<Matter>
      >;
      legal_templates: Table<
        LegalTemplate,
        Omit<LegalTemplate, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        },
        Partial<LegalTemplate>
      >;
      costs_agreements: Table<
        CostsAgreement,
        Partial<CostsAgreement> & Pick<CostsAgreement, "firm_id" | "matter_id">,
        Partial<CostsAgreement>
      >;
      agreement_versions: Table<
        AgreementVersion,
        Omit<AgreementVersion, "id" | "created_at"> & { id?: string; created_at?: string },
        Partial<AgreementVersion>
      >;
      agreement_pricing: Table<
        AgreementPricing,
        Partial<AgreementPricing> & Pick<AgreementPricing, "costs_agreement_id" | "firm_id">,
        Partial<AgreementPricing>
      >;
      agreement_stages: Table<
        AgreementStage,
        Omit<AgreementStage, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        },
        Partial<AgreementStage>
      >;
      agreement_scope_items: Table<
        AgreementScopeItem,
        Omit<AgreementScopeItem, "created_at"> & { created_at?: string },
        Partial<AgreementScopeItem>
      >;
      required_attachments: Table<
        RequiredAttachment,
        Omit<RequiredAttachment, "id" | "uploaded_at" | "used_at"> & {
          id?: string;
          uploaded_at?: string;
          used_at?: string | null;
        },
        Partial<RequiredAttachment>
      >;
      funding_requests: Table<
        FundingRequest,
        Omit<FundingRequest, "id" | "created_at"> & { id?: string; created_at?: string },
        Partial<FundingRequest>
      >;
      funding_receipts: Table<
        FundingReceipt,
        Omit<FundingReceipt, "id" | "created_at"> & { id?: string; created_at?: string },
        Partial<FundingReceipt>
      >;
      generated_agreement_packs: Table<
        GeneratedAgreementPack,
        Omit<GeneratedAgreementPack, "id" | "generated_at"> & {
          id?: string;
          generated_at?: string;
        },
        Partial<GeneratedAgreementPack>
      >;
      signature_requests: Table<
        SignatureRequest,
        Omit<
          SignatureRequest,
          | "id"
          | "created_at"
          | "updated_at"
          | "provider_request_id"
          | "test_mode"
          | "last_error"
          | "last_webhook_event_id"
          | "sent_at"
          | "viewed_at"
          | "signed_at"
          | "declined_at"
          | "completed_at"
          | "cancelled_at"
          | "expired_at"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          provider_request_id?: string | null;
          test_mode?: boolean;
          last_error?: string | null;
          last_webhook_event_id?: string | null;
          sent_at?: string | null;
          viewed_at?: string | null;
          signed_at?: string | null;
          declined_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          expired_at?: string | null;
        },
        Partial<SignatureRequest>
      >;
      signature_webhook_events: Table<
        SignatureWebhookEvent,
        Omit<SignatureWebhookEvent, "id" | "processed_at"> & {
          id?: string;
          processed_at?: string;
        },
        Partial<SignatureWebhookEvent>
      >;
      signed_agreement_documents: Table<
        SignedAgreementDocument,
        Omit<SignedAgreementDocument, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        },
        Partial<SignedAgreementDocument>
      >;
      audit_events: Table<
        AuditEvent,
        Omit<AuditEvent, "id" | "created_at"> & { id?: string; created_at?: string },
        Partial<AuditEvent>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      create_firm: {
        Args: { p_name: string; p_practice_name?: string | null };
        Returns: Firm;
      };
      create_agreement_draft: {
        Args: { p_agreement_type: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
