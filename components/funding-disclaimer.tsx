import { FUNDING_WORKFLOW_DISCLAIMER } from "@/lib/constants";
import { Notice } from "@/components/ui/notice";

export function FundingDisclaimer() {
  return <Notice>{FUNDING_WORKFLOW_DISCLAIMER}</Notice>;
}
