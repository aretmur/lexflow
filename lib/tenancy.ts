export function assertSameFirm(sessionFirmId: string, rowFirmId: string | null | undefined) {
  if (!rowFirmId || rowFirmId !== sessionFirmId) {
    throw new Error("Record not found");
  }
}

export function scopedFirmId<T extends { firm_id: string }>(
  sessionFirmId: string,
  rows: T[] | null | undefined,
): T[] {
  return (rows ?? []).filter((row) => row.firm_id === sessionFirmId);
}
