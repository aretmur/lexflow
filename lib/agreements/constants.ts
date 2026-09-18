export {
  AGREEMENT_TYPES,
  type AgreementType,
  AGREEMENT_STATUSES,
  type AgreementStatus,
} from "@/lib/types/enums";

export const EDITABLE_AGREEMENT_STATUSES = ["draft", "ready"] as const;

export const VICTORIAN_TEMPLATES = {
  short_form: {
    key: "vic_short_form",
    version: "2026-09-under-legal-review",
    label: "Short form",
    jurisdiction: "VIC" as const,
  },
  full_staged: {
    key: "vic_full_staged",
    version: "2026-09-under-legal-review",
    label: "Full / staged",
    jurisdiction: "VIC" as const,
  },
} as const;

export const REQUIRED_ATTACHMENT_TITLE =
  "Legal Services Council Costs agreements Information sheet July 2022";
