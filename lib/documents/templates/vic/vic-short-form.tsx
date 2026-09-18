import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { DocumentModel } from "@/lib/documents/document-types";
import { displayOrDash, formatMoney } from "@/lib/documents/formatters";
import {
  DocumentHeader,
  ExecutionBlock,
  LegalBanner,
  Labeled,
  NumberedList,
  PageFooter,
  Paragraphs,
  PartyLines,
  TotalsRow,
  clientAddress,
  clientContact,
  firmAddress,
  paymentReference,
  practitionerLine,
  styles,
} from "@/lib/documents/templates/shared-components";
import {
  DISCLOSURE_HEADING,
  DISCLOSURE_INTRO,
  SHORT_FORM_BASIS_OF_COSTS,
  SHORT_FORM_EXECUTION,
  SHORT_FORM_INTRO,
  SHORT_FORM_RIGHTS,
} from "@/lib/documents/templates/vic/wording";

export function VicShortFormDocument({ model }: { model: DocumentModel }) {
  const { snapshot, shortForm } = model;
  if (!shortForm) {
    throw new Error("Short-form document requires canonical short-form pricing.");
  }

  return (
    <Document
      title={`Costs agreement — ${snapshot.matter.referenceNumber}`}
      author={snapshot.firm.legalEntityName}
      subject="Victorian short-form costs agreement (UNDER LEGAL REVIEW)"
    >
      <Page size="A4" style={styles.page} wrap>
        <DocumentHeader model={model} />
        <LegalBanner />

        <PartyLines
          name={snapshot.client.fullName}
          address={clientAddress(model)}
          extra={clientContact(model)}
        />
        <View style={{ marginTop: 10 }}>
          <Labeled label="Date" value={model.capturedDate} />
          <Labeled label="Our ref" value={snapshot.matter.referenceNumber} />
        </View>

        <Text style={styles.paragraph}>Dear {snapshot.client.fullName}</Text>
        <Text style={styles.subheading}>Re: {snapshot.matter.title}</Text>
        <Paragraphs lines={SHORT_FORM_INTRO} />

        <Text style={styles.subheading}>Responsible practitioner</Text>
        <Text style={styles.paragraph}>{practitionerLine(model)}</Text>

        <Text style={styles.heading}>{DISCLOSURE_HEADING}</Text>
        <Text style={styles.paragraph}>{DISCLOSURE_INTRO}</Text>
        <Labeled label="Date provided to client" value={model.capturedDate} />
        <Text style={styles.subheading}>Law practice</Text>
        <PartyLines
          name={snapshot.firm.legalEntityName}
          address={firmAddress(model)}
          extra={[
            snapshot.firm.abn ? `ABN ${snapshot.firm.abn}` : null,
            snapshot.firm.email,
            snapshot.firm.phone,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <Text style={styles.subheading}>Client</Text>
        <PartyLines
          name={snapshot.client.fullName}
          address={clientAddress(model)}
          extra={clientContact(model)}
        />

        <Text style={styles.heading}>What we will do for you</Text>
        {snapshot.generalScopeStatement ? (
          <Text style={styles.paragraph}>{snapshot.generalScopeStatement}</Text>
        ) : null}
        <NumberedList items={snapshot.scopeItems} />
        {snapshot.exclusions ? (
          <Text style={styles.paragraph}>Exclusions: {snapshot.exclusions}</Text>
        ) : null}

        <Text style={styles.heading}>Costs</Text>
        <Text style={styles.paragraph}>{SHORT_FORM_BASIS_OF_COSTS}</Text>
        <TotalsRow label="Hourly rate" value={formatMoney(Number(snapshot.pricing.hourlyRateCents ?? 0))} />
        <TotalsRow
          label="Estimated professional fees excluding GST"
          value={formatMoney(Number(snapshot.pricing.professionalFeesExGstCents ?? 0))}
        />
        <TotalsRow
          label="Discount"
          value={formatMoney(Number(snapshot.pricing.discountCents ?? 0))}
        />
        <TotalsRow label="Subtotal excluding GST" value={formatMoney(shortForm.subtotalExGstCents)} />
        <TotalsRow
          label="Disbursements"
          value={formatMoney(Number(snapshot.pricing.disbursementsCents ?? 0))}
        />
        <TotalsRow label="GST" value={formatMoney(shortForm.gstCents)} />
        <TotalsRow
          label="Estimated full amount including GST"
          value={formatMoney(shortForm.totalInclGstCents)}
          strong
        />
        <TotalsRow
          label="Deposit / funds requested upfront"
          value={formatMoney(shortForm.amountRequestedUpfrontCents)}
        />

        <Text style={styles.heading}>Payment</Text>
        <Labeled label="Bank" value={displayOrDash(snapshot.firm.bankName)} />
        <Labeled label="Account name" value={displayOrDash(snapshot.firm.accountName)} />
        <Labeled label="BSB" value={displayOrDash(snapshot.firm.bsb)} />
        <Labeled label="Account number" value={displayOrDash(snapshot.firm.accountNumber)} />
        <Labeled label="Matter / reference number" value={paymentReference(model)} />
        {snapshot.firm.cyberFraudContactPhone ? (
          <Labeled
            label="Verify payment details on"
            value={snapshot.firm.cyberFraudContactPhone}
          />
        ) : null}

        <Text style={styles.heading}>Your rights</Text>
        <Paragraphs lines={SHORT_FORM_RIGHTS} />

        <ExecutionBlock wording={SHORT_FORM_EXECUTION} />
        <PageFooter model={model} />
      </Page>
    </Document>
  );
}
