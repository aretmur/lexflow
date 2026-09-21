import { clamp, INITIALS_FIELD_LAYOUT, type PageGeometry } from "@/lib/signatures/form-fields";

/** pdf-lib origin is bottom-left. Execution fields sit on the last agreement page. */
export const EXECUTION_LAYOUT = {
  signature: { x: 54, y: 196, width: 220, height: 42 },
  name: { x: 54, y: 158, width: 220, height: 16 },
  date: { x: 54, y: 122, width: 160, height: 16 },
} as const;

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
