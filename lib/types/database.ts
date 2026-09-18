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
  TemplateStatus,
} from "@/lib/types/enums";

export type Firm = {
  id: string;
  name: string;
  practice_name: string | null;
  abn: string | null;
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
  practising_certificate_number: string | null;
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
  status: AgreementStatus;
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

type EmptyRelationships = [];

export type Database = {
  public: {
    Tables: {
      firms: {
        Row: Firm;
        Insert: Partial<Firm> & Pick<Firm, "name">;
        Update: Partial<Firm>;
        Relationships: EmptyRelationships;
      };
      users: {
        Row: UserProfile;
        Insert: Pick<UserProfile, "id" | "email"> & Partial<UserProfile>;
        Update: Partial<Pick<UserProfile, "email" | "full_name">>;
        Relationships: EmptyRelationships;
      };
      firm_memberships: {
        Row: FirmMembership;
        Insert: Omit<FirmMembership, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Pick<FirmMembership, "role">>;
        Relationships: EmptyRelationships;
      };
      practitioners: {
        Row: Practitioner;
        Insert: Omit<Practitioner, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Practitioner>;
        Relationships: EmptyRelationships;
      };
      clients: {
        Row: Client;
        Insert: Omit<Client, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Client>;
        Relationships: EmptyRelationships;
      };
      matters: {
        Row: Matter;
        Insert: Omit<Matter, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Matter>;
        Relationships: EmptyRelationships;
      };
      legal_templates: {
        Row: LegalTemplate;
        Insert: Omit<LegalTemplate, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<LegalTemplate>;
        Relationships: EmptyRelationships;
      };
      costs_agreements: {
        Row: CostsAgreement;
        Insert: Omit<CostsAgreement, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<CostsAgreement>;
        Relationships: EmptyRelationships;
      };
      agreement_versions: {
        Row: AgreementVersion;
        Insert: Omit<AgreementVersion, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AgreementVersion>;
        Relationships: EmptyRelationships;
      };
      funding_requests: {
        Row: FundingRequest;
        Insert: Omit<FundingRequest, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<FundingRequest>;
        Relationships: EmptyRelationships;
      };
      funding_receipts: {
        Row: FundingReceipt;
        Insert: Omit<FundingReceipt, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<FundingReceipt>;
        Relationships: EmptyRelationships;
      };
      audit_events: {
        Row: AuditEvent;
        Insert: Omit<AuditEvent, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<AuditEvent>;
        Relationships: EmptyRelationships;
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_firm: {
        Args: { p_name: string; p_practice_name?: string | null };
        Returns: Firm;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
