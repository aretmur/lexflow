import type { RequiredAttachment } from "@/lib/types/database";
import type { AgreementSnapshot } from "@/lib/agreements/snapshot";

export const MISSING_ATTACHMENT_READY_ERROR =
  "Upload the required costs information sheet before marking this agreement ready.";

export class MissingRequiredAttachmentError extends Error {
  constructor(message = MISSING_ATTACHMENT_READY_ERROR) {
    super(message);
    this.name = "MissingRequiredAttachmentError";
  }
}

export function requireActiveAttachment(
  attachment: RequiredAttachment | null | undefined,
): RequiredAttachment {
  if (!attachment) {
    throw new MissingRequiredAttachmentError();
  }
  return attachment;
}

export function freezeRequiredAttachment(
  attachment: RequiredAttachment,
): NonNullable<AgreementSnapshot["attachment"]> {
  return {
    id: attachment.id,
    version: attachment.version,
    title: attachment.title,
    storagePath: attachment.storage_path,
  };
}

export function attachmentForReadySnapshot(
  attachment: RequiredAttachment | null | undefined,
): NonNullable<AgreementSnapshot["attachment"]> {
  return freezeRequiredAttachment(requireActiveAttachment(attachment));
}

export function snapshotHasRequiredAttachment(
  snapshot: { attachment?: AgreementSnapshot["attachment"] } | null | undefined,
): boolean {
  return Boolean(snapshot?.attachment?.id && snapshot.attachment.storagePath);
}

export function nextAgreementVersionNumber(lastVersionNumber: number | null | undefined): number {
  return (lastVersionNumber ?? 0) + 1;
}

export function reopenReadyAgreementStatus(status: string): "draft" | null {
  return status === "ready" ? "draft" : null;
}
