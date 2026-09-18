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
  FULL_STAGED_AGREEMENT_INTRO,
  FULL_STAGED_COVER_INTRO,
  FULL_STAGED_EXECUTION,
  FULL_STAGED_SECTIONS,
} from "@/lib/documents/templates/vic/wording";

function RateTable({ model }: { model: DocumentModel }) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader} wrap={false}>
        <Text style={[styles.cell, { width: "40%" }]}>Position</Text>
        <Text style={[styles.cellRight, { width: "30%" }]}>Hourly Rate ex GST</Text>
        <Text style={[styles.cellRight, { width: "30%" }]}>Hourly Rate incl GST</Text>
      </View>
      {model.chargeOutRates.map((row) => (
        <View key={row.position} style={styles.tableRow} wrap={false}>
          <Text style={[styles.cell, { width: "40%" }]}>{row.position}</Text>
          <Text style={[styles.cellRight, { width: "30%" }]}>
            {formatMoney(row.exclusiveCents)}
          </Text>
          <Text style={[styles.cellRight, { width: "30%" }]}>
            {formatMoney(row.inclusiveCents)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ConsultantTable({ model }: { model: DocumentModel }) {
  if (!model.consultants.length) {
    return null;
  }
  return (
    <View>
      <Text style={styles.heading}>Consultants</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader} wrap={false}>
          <Text style={[styles.cell, { width: "28%" }]}>Consultant</Text>
          <Text style={[styles.cellRight, { width: "36%" }]}>Hourly range</Text>
          <Text style={[styles.cellRight, { width: "36%" }]}>Daily range</Text>
        </View>
        {model.consultants.map((row) => (
          <View key={row.label} style={styles.tableRow} wrap={false}>
            <Text style={[styles.cell, { width: "28%" }]}>{row.label}</Text>
            <Text style={[styles.cellRight, { width: "36%" }]}>
              {formatMoney(row.hourlyMinCents)} – {formatMoney(row.hourlyMaxCents)}
            </Text>
            <Text style={[styles.cellRight, { width: "36%" }]}>
              {formatMoney(row.dailyMinCents)} – {formatMoney(row.dailyMaxCents)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StagedCostTable({ model }: { model: DocumentModel }) {
  return (
    <View>
      <Text style={styles.heading}>Staged cost estimates</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader} wrap={false} minPresenceAhead={48}>
          <Text style={[styles.cell, { width: "16%" }]}>Stage</Text>
          <Text style={[styles.cell, { width: "44%" }]}>Scope</Text>
          <Text style={[styles.cellRight, { width: "20%" }]}>Solicitor Cost Estimate</Text>
          <Text style={[styles.cellRight, { width: "20%" }]}>Other Consultants</Text>
        </View>
        {model.snapshot.stages.map((stage) => (
          <View key={stage.stageNumber} style={styles.stageBlock} wrap>
            <View style={{ flexDirection: "row" }}>
              <View style={{ width: "16%", paddingRight: 6 }}>
                <Text style={styles.stageTitle}>
                  Stage {stage.stageNumber}
                  {stage.title ? ` · ${stage.title}` : ""}
                </Text>
                {stage.timing ? <Text style={styles.notes}>{stage.timing}</Text> : null}
              </View>
              <View style={{ width: "44%", paddingRight: 6 }}>
                {stage.scopeItems.length ? (
                  stage.scopeItems.map((item, index) => (
                    <Text key={`${stage.stageNumber}-${index}`} style={{ marginBottom: 2 }}>
                      • {item}
                    </Text>
                  ))
                ) : (
                  <Text>—</Text>
                )}
              </View>
              <Text style={[styles.cellRight, { width: "20%" }]}>
                {formatMoney(stage.solicitorCostEstimateCents)}
              </Text>
              <Text style={[styles.cellRight, { width: "20%" }]}>
                {formatMoney(stage.consultantEstimateCents)}
              </Text>
            </View>
            {stage.notes ? <Text style={styles.notes}>{stage.notes}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export function VicFullStagedDocument({ model }: { model: DocumentModel }) {
  const { snapshot, staged } = model;
  if (!staged) {
    throw new Error("Full/staged document requires canonical staged pricing.");
  }

  return (
    <Document
      title={`Costs agreement — ${snapshot.matter.referenceNumber}`}
      author={snapshot.firm.legalEntityName}
      subject="Victorian full/staged costs agreement (UNDER LEGAL REVIEW)"
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
        <Paragraphs lines={FULL_STAGED_COVER_INTRO} />
        <Text style={styles.subheading}>Responsible practitioner</Text>
        <Text style={styles.paragraph}>{practitionerLine(model)}</Text>

        <Text style={styles.heading}>Costs agreement</Text>
        <Paragraphs lines={FULL_STAGED_AGREEMENT_INTRO} />
        <Labeled label="Law practice" value={snapshot.firm.legalEntityName} />
        <Text style={styles.paragraph}>{firmAddress(model) || "—"}</Text>
        <Labeled label="Client" value={snapshot.client.fullName} />

        <Text style={styles.heading}>Charge-out rates</Text>
        <RateTable model={model} />

        <Text style={styles.heading}>Scope of work</Text>
        {snapshot.generalScopeStatement ? (
          <Text style={styles.paragraph}>{snapshot.generalScopeStatement}</Text>
        ) : null}
        <NumberedList items={snapshot.scopeItems} />
        {snapshot.exclusions ? (
          <Text style={styles.paragraph}>Exclusions: {snapshot.exclusions}</Text>
        ) : null}

        <ConsultantTable model={model} />
        <StagedCostTable model={model} />

        <View style={{ marginTop: 10 }}>
          <TotalsRow label="Subtotal — solicitor estimates" value={formatMoney(staged.solicitorTotalCents)} />
          <TotalsRow label="Other consultants" value={formatMoney(staged.consultantTotalCents)} />
          <TotalsRow label="GST on solicitor estimates" value={formatMoney(staged.gstCents)} />
          <TotalsRow
            label="Disbursements"
            value={formatMoney(Number(snapshot.pricing.disbursementsCents ?? 0))}
          />
          <TotalsRow
            label="Miscellaneous fees"
            value={formatMoney(Number(snapshot.pricing.miscellaneousFeesCents ?? 0))}
          />
          <TotalsRow label="Grand total" value={formatMoney(staged.totalEstimateCents)} strong />
          <TotalsRow
            label="Amount requested upfront"
            value={formatMoney(staged.amountRequestedUpfrontCents)}
          />
        </View>

        {FULL_STAGED_SECTIONS.map((section) => (
          <View key={section.heading}>
            <Text style={styles.heading}>{section.heading}</Text>
            <Paragraphs lines={section.body} />
            {section.heading === "Trust Deposit Details" ? (
              <View>
                <Labeled label="Bank" value={displayOrDash(snapshot.firm.bankName)} />
                <Labeled label="Account name" value={displayOrDash(snapshot.firm.accountName)} />
                <Labeled label="BSB" value={displayOrDash(snapshot.firm.bsb)} />
                <Labeled label="Account number" value={displayOrDash(snapshot.firm.accountNumber)} />
                <Labeled label="Matter / reference number" value={paymentReference(model)} />
              </View>
            ) : null}
            {section.heading === "Cyber Crime Disclaimer" && snapshot.firm.cyberFraudContactPhone ? (
              <Labeled
                label="Verify payment details on"
                value={snapshot.firm.cyberFraudContactPhone}
              />
            ) : null}
          </View>
        ))}

        <ExecutionBlock wording={FULL_STAGED_EXECUTION} />
        <PageFooter model={model} />
      </Page>
    </Document>
  );
}
