import { LEGAL_REVIEW_NOTICE } from "@/lib/constants";
import { Notice } from "@/components/ui/notice";

export function LegalReviewNotice() {
  return <Notice tone="warning">{LEGAL_REVIEW_NOTICE}</Notice>;
}
