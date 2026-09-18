export const GENERATED_AGREEMENTS_BUCKET = "generated-agreements";

export function generatedPackStoragePath(input: {
  firmId: string;
  agreementId: string;
  versionNumber: number;
}): string {
  if (!Number.isInteger(input.versionNumber) || input.versionNumber < 1) {
    throw new Error("Generated pack version must be a positive integer");
  }
  return `${input.firmId}/${input.agreementId}/version-${input.versionNumber}/agreement-pack.pdf`;
}
