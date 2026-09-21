import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgreementStatus } from "@/lib/types/enums";
import type { Database } from "@/lib/types/database";
import {
  SignatureWorkflowError,
  type SignatureRequestRecord,
  type SignatureSendContext,
  type SignedAgreementDocumentRecord,
} from "@/lib/signatures/types";

export type SignatureAuditInput = {
  firmId: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  payload: Record<string, unknown>;
};

export type InsertSignatureRequestInput = {
  firmId: string;
  costsAgreementId: string;
  agreementVersionId: string;
  generatedPackId: string;
  provider: SignatureRequestRecord["provider"];
  providerRequestId: string;
  signerName: string;
  signerEmail: string;
  status: SignatureRequestRecord["status"];
  testMode: boolean;
  sentAt: string;
  createdBy: string;
  requirePageInitials: boolean;
  initialsFieldCount: number;
  pageCount: number;
  signingMode: SignatureRequestRecord["signingMode"];
  providerSignatureId?: string | null;
  signingTokenHash?: string | null;
  signingTokenExpiresAt?: string | null;
};

export type UpdateSignatureRequestInput = Partial<
  Pick<
    SignatureRequestRecord,
    | "status"
    | "lastError"
    | "lastWebhookEventId"
    | "sentAt"
    | "viewedAt"
    | "signedAt"
    | "declinedAt"
    | "completedAt"
    | "cancelledAt"
    | "expiredAt"
    | "signingTokenHash"
    | "signingTokenExpiresAt"
    | "providerSignatureId"
    | "signingMode"
  >
>;

export type InsertSignedDocumentInput = {
  firmId: string;
  costsAgreementId: string;
  agreementVersionId: string;
  signatureRequestId: string;
  storagePath: string;
  sha256: string;
  pageCount: number;
  byteSize: number;
  signedAt: string;
};

export type InsertWebhookEventInput = {
  firmId: string;
  signatureRequestId: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

export interface SignatureStore {
  loadSendContext(firmId: string, agreementId: string): Promise<SignatureSendContext | null>;
  loadRequestById(firmId: string, requestId: string): Promise<SignatureRequestRecord | null>;
  loadRequestByProviderId(providerRequestId: string): Promise<SignatureRequestRecord | null>;
  loadLatestRequest(
    firmId: string,
    agreementId: string,
  ): Promise<SignatureRequestRecord | null>;
  loadRequestByTokenHash(tokenHash: string): Promise<SignatureRequestRecord | null>;
  loadSignedDocument(
    firmId: string,
    agreementId: string,
  ): Promise<SignedAgreementDocumentRecord | null>;
  loadSignedDocumentByRequest(
    signatureRequestId: string,
  ): Promise<SignedAgreementDocumentRecord | null>;
  downloadGeneratedPack(storagePath: string): Promise<Uint8Array | null>;
  uploadSignedPdf(storagePath: string, bytes: Uint8Array): Promise<void>;
  insertRequest(input: InsertSignatureRequestInput): Promise<SignatureRequestRecord>;
  updateRequest(
    requestId: string,
    patch: UpdateSignatureRequestInput,
  ): Promise<SignatureRequestRecord>;
  updateAgreementStatus(
    firmId: string,
    agreementId: string,
    status: AgreementStatus,
    allowedFrom: AgreementStatus[],
  ): Promise<void>;
  markVersionExecuted(
    firmId: string,
    versionId: string,
    executedAt: string,
  ): Promise<void>;
  insertSignedDocument(
    input: InsertSignedDocumentInput,
  ): Promise<SignedAgreementDocumentRecord>;
  claimWebhookEvent(input: InsertWebhookEventInput): Promise<boolean>;
  insertAudit(input: SignatureAuditInput): Promise<void>;
}

export function createSupabaseSignatureStore(
  supabase: SupabaseClient<Database>,
): SignatureStore {
  return {
    async loadSendContext(firmId, agreementId) {
      const { data: agreement } = await supabase
        .from("costs_agreements")
        .select("id, firm_id, status")
        .eq("id", agreementId)
        .eq("firm_id", firmId)
        .maybeSingle();
      if (!agreement) {
        return null;
      }

      const { data: version } = await supabase
        .from("agreement_versions")
        .select("id, version_number")
        .eq("firm_id", firmId)
        .eq("costs_agreement_id", agreementId)
        .in("status", ["issued", "signed"])
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!version) {
        return null;
      }

      const { data: pack } = await supabase
        .from("generated_agreement_packs")
        .select("id, storage_path, version_number")
        .eq("firm_id", firmId)
        .eq("agreement_version_id", version.id)
        .maybeSingle();
      if (!pack) {
        return null;
      }

      const { data: active } = await supabase
        .from("signature_requests")
        .select("*")
        .eq("firm_id", firmId)
        .eq("costs_agreement_id", agreementId)
        .in("status", ["pending", "sent", "viewed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        agreementId: agreement.id,
        firmId: agreement.firm_id,
        agreementStatus: agreement.status,
        versionId: version.id,
        versionNumber: version.version_number,
        packId: pack.id,
        packStoragePath: pack.storage_path,
        packVersionNumber: pack.version_number,
        activeRequest: active ? fromRow(active) : null,
      };
    },

    async loadRequestById(firmId, requestId) {
      const { data } = await supabase
        .from("signature_requests")
        .select("*")
        .eq("id", requestId)
        .eq("firm_id", firmId)
        .maybeSingle();
      return data ? fromRow(data) : null;
    },

    async loadRequestByProviderId(providerRequestId) {
      const { data } = await supabase
        .from("signature_requests")
        .select("*")
        .eq("provider_request_id", providerRequestId)
        .maybeSingle();
      return data ? fromRow(data) : null;
    },

    async loadRequestByTokenHash(tokenHash) {
      const { data } = await supabase
        .from("signature_requests")
        .select("*")
        .eq("signing_token_hash", tokenHash)
        .maybeSingle();
      return data ? fromRow(data) : null;
    },

    async loadLatestRequest(firmId, agreementId) {
      const { data } = await supabase
        .from("signature_requests")
        .select("*")
        .eq("firm_id", firmId)
        .eq("costs_agreement_id", agreementId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? fromRow(data) : null;
    },

    async loadSignedDocument(firmId, agreementId) {
      const { data } = await supabase
        .from("signed_agreement_documents")
        .select("*")
        .eq("firm_id", firmId)
        .eq("costs_agreement_id", agreementId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? fromSignedRow(data) : null;
    },

    async loadSignedDocumentByRequest(signatureRequestId) {
      const { data } = await supabase
        .from("signed_agreement_documents")
        .select("*")
        .eq("signature_request_id", signatureRequestId)
        .maybeSingle();
      return data ? fromSignedRow(data) : null;
    },

    async downloadGeneratedPack(storagePath) {
      const { data, error } = await supabase.storage
        .from("generated-agreements")
        .download(storagePath);
      if (error || !data) {
        return null;
      }
      return new Uint8Array(await data.arrayBuffer());
    },

    async uploadSignedPdf(storagePath, bytes) {
      const { error } = await supabase.storage.from("signed-agreements").upload(
        storagePath,
        Buffer.from(bytes),
        { contentType: "application/pdf", upsert: false },
      );
      if (error && !/already exists|Duplicate/i.test(error.message)) {
        throw new SignatureWorkflowError(error.message);
      }
    },

    async insertRequest(input) {
      const { data, error } = await supabase
        .from("signature_requests")
        .insert({
          firm_id: input.firmId,
          costs_agreement_id: input.costsAgreementId,
          agreement_version_id: input.agreementVersionId,
          generated_pack_id: input.generatedPackId,
          provider: input.provider,
          provider_request_id: input.providerRequestId,
          signer_name: input.signerName,
          signer_email: input.signerEmail,
          status: input.status,
          test_mode: input.testMode,
          sent_at: input.sentAt,
          created_by: input.createdBy,
          require_page_initials: input.requirePageInitials,
          initials_field_count: input.initialsFieldCount,
          page_count: input.pageCount,
          signing_mode: input.signingMode,
          provider_signature_id: input.providerSignatureId ?? null,
          signing_token_hash: input.signingTokenHash ?? null,
          signing_token_expires_at: input.signingTokenExpiresAt ?? null,
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new SignatureWorkflowError(
          error?.message || "Unable to record the signature request.",
        );
      }
      return fromRow(data);
    },

    async updateRequest(requestId, patch) {
      const update: Database["public"]["Tables"]["signature_requests"]["Update"] = {};
      if (patch.status !== undefined) update.status = patch.status;
      if (patch.lastError !== undefined) update.last_error = patch.lastError;
      if (patch.lastWebhookEventId !== undefined) {
        update.last_webhook_event_id = patch.lastWebhookEventId;
      }
      if (patch.sentAt !== undefined) update.sent_at = patch.sentAt;
      if (patch.viewedAt !== undefined) update.viewed_at = patch.viewedAt;
      if (patch.signedAt !== undefined) update.signed_at = patch.signedAt;
      if (patch.declinedAt !== undefined) update.declined_at = patch.declinedAt;
      if (patch.completedAt !== undefined) update.completed_at = patch.completedAt;
      if (patch.cancelledAt !== undefined) update.cancelled_at = patch.cancelledAt;
      if (patch.expiredAt !== undefined) update.expired_at = patch.expiredAt;
      if (patch.signingTokenHash !== undefined) {
        update.signing_token_hash = patch.signingTokenHash;
      }
      if (patch.signingTokenExpiresAt !== undefined) {
        update.signing_token_expires_at = patch.signingTokenExpiresAt;
      }
      if (patch.providerSignatureId !== undefined) {
        update.provider_signature_id = patch.providerSignatureId;
      }
      if (patch.signingMode !== undefined) update.signing_mode = patch.signingMode;

      const { data, error } = await supabase
        .from("signature_requests")
        .update(update)
        .eq("id", requestId)
        .select("*")
        .single();
      if (error || !data) {
        throw new SignatureWorkflowError(
          error?.message || "Unable to update the signature request.",
        );
      }
      return fromRow(data);
    },

    async updateAgreementStatus(firmId, agreementId, status, allowedFrom) {
      let query = supabase
        .from("costs_agreements")
        .update({ status })
        .eq("id", agreementId)
        .eq("firm_id", firmId);
      if (allowedFrom.length) {
        query = query.in("status", allowedFrom);
      }
      const { error } = await query;
      if (error) {
        throw new SignatureWorkflowError(error.message);
      }
    },

    async markVersionExecuted(firmId, versionId, executedAt) {
      const { error } = await supabase
        .from("agreement_versions")
        .update({ status: "signed", executed_at: executedAt })
        .eq("id", versionId)
        .eq("firm_id", firmId)
        .eq("status", "issued");
      if (error) {
        throw new SignatureWorkflowError(error.message);
      }
    },

    async insertSignedDocument(input) {
      const { data, error } = await supabase
        .from("signed_agreement_documents")
        .insert({
          firm_id: input.firmId,
          costs_agreement_id: input.costsAgreementId,
          agreement_version_id: input.agreementVersionId,
          signature_request_id: input.signatureRequestId,
          storage_path: input.storagePath,
          sha256: input.sha256,
          page_count: input.pageCount,
          byte_size: input.byteSize,
          signed_at: input.signedAt,
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new SignatureWorkflowError(
          error?.message || "Unable to record the signed agreement.",
        );
      }
      return fromSignedRow(data);
    },

    async claimWebhookEvent(input) {
      const { error } = await supabase.from("signature_webhook_events").insert({
        firm_id: input.firmId,
        signature_request_id: input.signatureRequestId,
        provider: input.provider,
        provider_event_id: input.providerEventId,
        event_type: input.eventType,
        payload: input.payload,
      });
      if (!error) {
        return true;
      }
      if (/duplicate|unique/i.test(error.message)) {
        return false;
      }
      throw new SignatureWorkflowError(error.message);
    },

    async insertAudit(input) {
      const { error } = await supabase.from("audit_events").insert({
        firm_id: input.firmId,
        actor_user_id: input.actorUserId,
        entity_type: input.entityType,
        entity_id: input.entityId,
        action: input.action,
        payload: input.payload,
      });
      if (error) {
        throw new SignatureWorkflowError(error.message);
      }
    },
  };
}

type SignatureRequestRow = Database["public"]["Tables"]["signature_requests"]["Row"];
type SignedDocumentRow = Database["public"]["Tables"]["signed_agreement_documents"]["Row"];

function fromRow(row: SignatureRequestRow): SignatureRequestRecord {
  return {
    id: row.id,
    firmId: row.firm_id,
    costsAgreementId: row.costs_agreement_id,
    agreementVersionId: row.agreement_version_id,
    generatedPackId: row.generated_pack_id,
    provider: row.provider,
    providerRequestId: row.provider_request_id,
    signerName: row.signer_name,
    signerEmail: row.signer_email,
    status: row.status,
    testMode: row.test_mode,
    lastError: row.last_error,
    lastWebhookEventId: row.last_webhook_event_id,
    sentAt: row.sent_at,
    viewedAt: row.viewed_at,
    signedAt: row.signed_at,
    declinedAt: row.declined_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    expiredAt: row.expired_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    requirePageInitials: row.require_page_initials !== false,
    initialsFieldCount: row.initials_field_count ?? 0,
    pageCount: row.page_count ?? 0,
    signingMode: row.signing_mode ?? "email",
    providerSignatureId: row.provider_signature_id ?? null,
    signingTokenHash: row.signing_token_hash ?? null,
    signingTokenExpiresAt: row.signing_token_expires_at ?? null,
  };
}

function fromSignedRow(row: SignedDocumentRow): SignedAgreementDocumentRecord {
  return {
    id: row.id,
    firmId: row.firm_id,
    costsAgreementId: row.costs_agreement_id,
    agreementVersionId: row.agreement_version_id,
    signatureRequestId: row.signature_request_id,
    storagePath: row.storage_path,
    sha256: row.sha256,
    pageCount: row.page_count,
    byteSize: row.byte_size,
    signedAt: row.signed_at,
    createdAt: row.created_at,
  };
}
