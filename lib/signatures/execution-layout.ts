import { clamp, INITIALS_FIELD_LAYOUT, type PageGeometry } from "@/lib/signatures/form-fields";

/** pdf-lib origin is bottom-left. Execution lines are pinned above the footer. */
export const EXECUTION_LAYOUT = {
  insetX: 54,
  labelWidth: 72,
  pagePaddingBottom: 72,
  blockBottom: 52,
  signature: { x: 126, y: 112, width: 240, height: 36 },
  name: { x: 126, y: 94, width: 280, height: 12 },
  capacity: { x: 126, y: 76, width: 280, height: 12 },
  date: { x: 126, y: 58, width: 220, height: 12 },
} as const;

export function executionValueX() {
  return EXECUTION_LAYOUT.insetX + EXECUTION_LAYOUT.labelWidth;
}

export function executionPageNumber(agreementPageCount: number, totalPages: number) {
  const page = Math.max(1, Math.min(agreementPageCount, totalPages));
  return page;
}

export function initialsPlacement(page: PageGeometry) {
  const width = Math.min(INITIALS_FIELD_LAYOUT.width, page.width);
  const height = Math.min(INITIALS_FIELD_LAYOUT.height, page.height);
  const maxX = Math.max(0, page.width - width);
  const maxY = Math.max(0, page.height - height);
  return {
    x: clamp(page.width - INITIALS_FIELD_LAYOUT.rightInset - width, 0, maxX),
    y: clamp(INITIALS_FIELD_LAYOUT.bottomOffset, 0, maxY),
    width,
    height,
  };
}
