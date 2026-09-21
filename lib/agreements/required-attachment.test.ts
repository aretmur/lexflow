import { describe, expect, it } from "vitest";
import { freezeSnapshot, type AgreementSnapshot } from "@/lib/agreements/snapshot";
import {
  MISSING_ATTACHMENT_READY_ERROR,
  attachmentForReadySnapshot,
  nextAgreementVersionNumber,
  reopenReadyAgreementStatus,
  snapshotHasRequiredAttachment,
} from "@/lib/agreements/required-attachment";
import type { RequiredAttachment } from "@/lib/types/database";

function attachment(overrides: Partial<RequiredAttachment> = {}): RequiredAttachment {
  return {
    id: "att-1",
    firm_id: "firm-1",
    title: "Legal Services Council Costs agreements Information sheet July 2022",
    version: 1,
    storage_path: "firm-1/att-1.pdf",
    original_filename: "information-sheet.pdf",
    content_type: "application/pdf",
    byte_size: 12_000,
    is_active: true,
    uploaded_by: "user-1",
    uploaded_at: "2026-09-21T00:00:00.000Z",
    used_at: null,
    ...overrides,
  };
}

function snapshotWithAttachment(
  frozen: NonNullable<AgreementSnapshot["attachment"]>,
): AgreementSnapshot {
  return freezeSnapshot({
    capturedAt: "2026-09-21T00:00:00.000Z",
    template: {
      key: "vic_short_form",
      version: "2026-09-under-legal-review",
      jurisdiction: "VIC",
      legalReview: true,
    },
    attachment: frozen,
    firm: {
      legalEntityName: "Octagon Legal",
      tradingName: null,
      abn: null,
      email: null,
      phone: null,
      website: null,
      jurisdiction: "VIC",
      logoPath: null,
      addressLine1: null,
      addressLine2: null,
      suburb: null,
      state: null,
      postcode: null,
      bankName: null,
      accountName: null,
      bsb: null,
      accountNumber: null,
      paymentReferencePrefix: null,
      cyberFraudContactPhone: null,
    },
    practitioner: null,
    client: {
      fullName: "Client",
      email: null,
      phone: null,
      addressLine1: null,
      addressLine2: null,
      suburb: null,
      state: null,
      postcode: null,
    },
    matter: {
      referenceNumber: "M-1",
      title: "Matter",
      description: null,
      instructionsDate: null,
      jurisdiction: "VIC",
    },
    agreementType: "short_form",
    scopeItems: [],
    generalScopeStatement: null,
    exclusions: null,
    pricing: {},
    stages: [],
    amountRequestedUpfrontCents: 0,
  });
}

describe("mark ready without attachment", () => {
  it("cannot mark ready without attachment", () => {
    expect(() => attachmentForReadySnapshot(null)).toThrow(MISSING_ATTACHMENT_READY_ERROR);
    expect(() => attachmentForReadySnapshot(undefined)).toThrow(
      MISSING_ATTACHMENT_READY_ERROR,
    );
  });
});

describe("automatic attachment freeze", () => {
  it("active attachment automatically freezes into snapshot", () => {
    const frozen = attachmentForReadySnapshot(
      attachment({
        id: "att-2",
        version: 2,
        title: "Information sheet",
        storage_path: "firm-1/att-2.pdf",
      }),
    );
    expect(frozen).toEqual({
      id: "att-2",
      version: 2,
      title: "Information sheet",
      storagePath: "firm-1/att-2.pdf",
    });
    expect(snapshotHasRequiredAttachment({ attachment: frozen })).toBe(true);
  });

  it("old attachment remains frozen after firm uploads newer version", () => {
    const frozen = snapshotWithAttachment(attachmentForReadySnapshot(attachment()));
    const laterActive = attachment({
      id: "att-2",
      version: 2,
      storage_path: "firm-1/att-2.pdf",
      is_active: true,
    });

    expect(frozen.attachment?.id).toBe("att-1");
    expect(frozen.attachment?.version).toBe(1);
    expect(frozen.attachment?.storagePath).toBe("firm-1/att-1.pdf");
    expect(laterActive.version).toBe(2);
    expect(frozen.attachment?.version).not.toBe(laterActive.version);
  });
});

describe("legacy ready agreement without attachment", () => {
  it("can reopen and create a new version without changing the frozen snapshot", () => {
    const readyVersion = {
      versionNumber: 1,
      status: "issued",
      snapshot: { attachment: null },
    };

    expect(snapshotHasRequiredAttachment(readyVersion.snapshot)).toBe(false);
    expect(reopenReadyAgreementStatus("ready")).toBe("draft");
    expect(readyVersion.snapshot.attachment).toBe(null);
    expect(readyVersion.status).toBe("issued");

    const nextVersion = nextAgreementVersionNumber(readyVersion.versionNumber);
    expect(nextVersion).toBe(2);

    const replacement = snapshotWithAttachment(
      attachmentForReadySnapshot(attachment({ version: 3, id: "att-3" })),
    );
    expect(replacement.attachment?.version).toBe(3);
    expect(readyVersion.snapshot.attachment).toBe(null);
  });
});
