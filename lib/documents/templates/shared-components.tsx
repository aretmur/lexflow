import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { DocumentModel } from "@/lib/documents/document-types";
import { displayOrDash, joinAddress } from "@/lib/documents/formatters";
import { PRIVATE_AND_CONFIDENTIAL } from "@/lib/documents/templates/vic/wording";
import { DROPBOX_SIGN_TEXT_TAGS } from "@/lib/signatures/text-tags";

export const colors = {
  ink: "#1c1917",
  muted: "#57534e",
  rule: "#d6d3d1",
  wash: "#f5f5f4",
  accent: "#1e3a5f",
};

export const styles = StyleSheet.create({
  page: {
    fontFamily: "Times-Roman",
    fontSize: 10,
    color: colors.ink,
    paddingTop: 54,
    paddingBottom: 60,
    paddingHorizontal: 54,
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    paddingBottom: 10,
    marginBottom: 14,
  },
  logo: {
    width: 72,
    height: 72,
    objectFit: "contain",
  },
  firmBlock: {
    flexGrow: 1,
    paddingRight: 12,
  },
  firmName: {
    fontFamily: "Times-Bold",
    fontSize: 14,
    color: colors.accent,
  },
  confidential: {
    fontFamily: "Times-Bold",
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.muted,
    marginTop: 4,
  },
  banner: {
    fontFamily: "Helvetica",
    fontSize: 8,
    color: colors.muted,
    marginBottom: 12,
    lineHeight: 1.35,
  },
  heading: {
    fontFamily: "Times-Bold",
    fontSize: 13,
    marginTop: 14,
    marginBottom: 6,
  },
  subheading: {
    fontFamily: "Times-Bold",
    fontSize: 11,
    marginTop: 10,
    marginBottom: 4,
  },
  paragraph: {
    marginBottom: 6,
  },
  metaLine: {
    marginBottom: 2,
  },
  label: {
    fontFamily: "Times-Bold",
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 3,
    paddingRight: 8,
  },
  listNumber: {
    width: 18,
  },
  listBody: {
    flex: 1,
  },
  table: {
    marginTop: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.wash,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  cell: {
    padding: 6,
    fontSize: 9,
  },
  cellRight: {
    padding: 6,
    fontSize: 9,
    textAlign: "right",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  totalStrong: {
    fontFamily: "Times-Bold",
    marginTop: 4,
  },
  signatureLine: {
    marginTop: 8,
    fontFamily: "Helvetica",
    fontSize: 10,
  },
  signatureField: {
    marginTop: 8,
  },
  hiddenTag: {
    color: "#FFFFFF",
    fontFamily: "Helvetica",
    fontSize: 6,
    lineHeight: 1,
  },
  footer: {
    position: "absolute",
    left: 54,
    right: 54,
    bottom: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: colors.muted,
    fontFamily: "Helvetica",
  },
  stageBlock: {
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    padding: 6,
  },
  stageTitle: {
    fontFamily: "Times-Bold",
    fontSize: 9,
    marginBottom: 2,
  },
  notes: {
    fontSize: 8,
    color: colors.muted,
    marginTop: 4,
  },
});

function logoSource(bytes: Uint8Array | null): Buffer | null {
  if (!bytes?.byteLength) {
    return null;
  }
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!png && !jpg) {
    return null;
  }
  return Buffer.from(bytes);
}

export function DocumentHeader({ model }: { model: DocumentModel }) {
  const { snapshot, logoBytes } = model;
  const trading = snapshot.firm.tradingName
    ? `t/as ${snapshot.firm.tradingName}`
    : null;
  const logo = logoSource(logoBytes);
  return (
    <View style={styles.header} wrap={false}>
      <View style={styles.firmBlock}>
        <Text style={styles.firmName}>{snapshot.firm.legalEntityName}</Text>
        {trading ? <Text>{trading}</Text> : null}
        <Text style={styles.confidential}>{PRIVATE_AND_CONFIDENTIAL}</Text>
      </View>
      {logo ? (
        // react-pdf Image has no accessible alt; the firm name is already printed beside it.
        // eslint-disable-next-line jsx-a11y/alt-text -- PDF Image has no alt prop
        <Image src={logo} style={styles.logo} />
      ) : null}
    </View>
  );
}

export function PartyLines({
  name,
  address,
  extra,
}: {
  name: string;
  address: string;
  extra?: string;
}) {
  return (
    <View>
      <Text style={styles.metaLine}>{name}</Text>
      {address ? <Text style={styles.metaLine}>{address}</Text> : null}
      {extra ? <Text style={styles.metaLine}>{extra}</Text> : null}
    </View>
  );
}

export function Labeled({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.metaLine}>
      <Text style={styles.label}>{label}: </Text>
      {value}
    </Text>
  );
}

export function Paragraphs({ lines }: { lines: string[] }) {
  return (
    <View>
      {lines.map((line) => (
        <Text key={line.slice(0, 48)} style={styles.paragraph}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export function NumberedList({ items }: { items: string[] }) {
  if (!items.length) {
    return <Text style={styles.paragraph}>None recorded.</Text>;
  }
  return (
    <View>
      {items.map((item, index) => (
        <View key={`${index}-${item.slice(0, 24)}`} style={styles.listItem}>
          <Text style={styles.listNumber}>{index + 1}.</Text>
          <Text style={styles.listBody}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function TotalsRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.totalsRow} wrap={false}>
      <Text style={strong ? styles.totalStrong : undefined}>{label}</Text>
      <Text style={strong ? styles.totalStrong : undefined}>{value}</Text>
    </View>
  );
}

export function ExecutionBlock({ wording }: { wording: string }) {
  return (
    <View>
      <Text style={styles.heading}>Execution</Text>
      <Text style={styles.paragraph}>{wording}</Text>
      <View style={styles.signatureField} wrap={false}>
        <Text style={styles.signatureLine}>Signature: ______________________</Text>
        <Text style={styles.hiddenTag}>{DROPBOX_SIGN_TEXT_TAGS.signature}</Text>
      </View>
      <View style={styles.signatureField} wrap={false}>
        <Text style={styles.signatureLine}>Name: __________________________</Text>
        <Text style={styles.hiddenTag}>{DROPBOX_SIGN_TEXT_TAGS.name}</Text>
      </View>
      <Text style={styles.signatureLine}>Capacity: _______________________</Text>
      <View style={styles.signatureField} wrap={false}>
        <Text style={styles.signatureLine}>Date: ___________________________</Text>
        <Text style={styles.hiddenTag}>{DROPBOX_SIGN_TEXT_TAGS.date}</Text>
      </View>
    </View>
  );
}

export function PageFooter({ model }: { model: DocumentModel }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        {model.metadata.templateKey} · {model.metadata.templateVersion}
      </Text>
      <Text
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

export function clientAddress(model: DocumentModel): string {
  return joinAddress([
    model.snapshot.client.addressLine1,
    model.snapshot.client.addressLine2,
    model.snapshot.client.suburb,
    model.snapshot.client.state,
    model.snapshot.client.postcode,
  ]);
}

export function firmAddress(model: DocumentModel): string {
  return joinAddress([
    model.snapshot.firm.addressLine1,
    model.snapshot.firm.addressLine2,
    model.snapshot.firm.suburb,
    model.snapshot.firm.state,
    model.snapshot.firm.postcode,
  ]);
}

export function clientContact(model: DocumentModel): string {
  return [model.snapshot.client.email, model.snapshot.client.phone]
    .filter(Boolean)
    .join(" · ");
}

export function practitionerLine(model: DocumentModel): string {
  const practitioner = model.snapshot.practitioner;
  if (!practitioner) {
    return "—";
  }
  return [practitioner.fullName, practitioner.title, practitioner.email, practitioner.mobile]
    .filter(Boolean)
    .join(" · ");
}

export function paymentReference(model: DocumentModel): string {
  const prefix = model.snapshot.firm.paymentReferencePrefix?.trim();
  const matter = model.snapshot.matter.referenceNumber;
  return prefix ? `${prefix} ${matter}` : matter;
}

export { displayOrDash };
