import { VICTORIAN_TEMPLATES } from "@/lib/agreements/constants";
import type { AgreementType } from "@/lib/agreements/constants";

export type TemplateMetadata = {
  templateKey: string;
  templateVersion: string;
  jurisdiction: "VIC";
  agreementType: AgreementType;
};

function fromVictorian(type: AgreementType): TemplateMetadata {
  const template = VICTORIAN_TEMPLATES[type];
  return {
    templateKey: template.key,
    templateVersion: template.version,
    jurisdiction: "VIC",
    agreementType: type,
  };
}

export const VIC_SHORT_FORM_TEMPLATE = fromVictorian("short_form");
export const VIC_FULL_STAGED_TEMPLATE = fromVictorian("full_staged");
