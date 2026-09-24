"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { discardCostsAgreementAction } from "@/app/actions/agreements";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, Td, Th } from "@/components/ui/table";
import { canDiscardCostsAgreement } from "@/lib/agreements/list";

export type AgreementListRow = {
  id: string;
  clientName: string;
  matterLabel: string;
  typeLabel: string;
  status: string;
  createdAt: string;
};

export function AgreementsList({
  groups,
}: {
  groups: Array<{ key: string; label: string; items: AgreementListRow[] }>;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function discard(row: AgreementListRow) {
    const confirmed = window.confirm(
      `Delete this costs agreement for ${row.clientName}?\n\n${row.matterLabel}\n\nThis hides it from the list. Signed agreements cannot be deleted.`,
    );
    if (!confirmed) {
      return;
    }
    setPendingId(row.id);
    setError(null);
    const result = await discardCostsAgreementAction(row.id);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-10">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {groups.map((group) => (
        <section key={group.key} className="space-y-4">
          <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
            <h2 className="font-serif text-xl">{group.label}</h2>
            <p className="text-sm text-ink-muted">
              {group.items.length} {group.items.length === 1 ? "agreement" : "agreements"}
            </p>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Matter</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((agreement) => (
                <tr key={agreement.id}>
                  <Td>
                    <Link href={`/agreements/${agreement.id}`} className="hover:underline">
                      {agreement.clientName}
                    </Link>
                  </Td>
                  <Td>{agreement.matterLabel}</Td>
                  <Td>{agreement.typeLabel}</Td>
                  <Td>
                    <Badge>{agreement.status.replaceAll("_", " ")}</Badge>
                  </Td>
                  <Td className="text-right">
                    {canDiscardCostsAgreement(agreement.status) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2 text-sm text-danger hover:text-danger"
                        disabled={pendingId === agreement.id}
                        onClick={() => discard(agreement)}
                      >
                        {pendingId === agreement.id ? "Deleting…" : "Delete"}
                      </Button>
                    ) : (
                      <span className="text-sm text-ink-muted">Kept</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      ))}
    </div>
  );
}
