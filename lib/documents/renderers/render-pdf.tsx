import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentModel } from "@/lib/documents/document-types";
import { VicShortFormDocument } from "@/lib/documents/templates/vic/vic-short-form";
import { VicFullStagedDocument } from "@/lib/documents/templates/vic/vic-full-staged";

export async function renderAgreementPdf(model: DocumentModel): Promise<Buffer> {
  const document =
    model.snapshot.agreementType === "short_form" ? (
      <VicShortFormDocument model={model} />
    ) : (
      <VicFullStagedDocument model={model} />
    );
  return renderToBuffer(document);
}
