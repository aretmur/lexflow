"use client";

import { useActionState, useState } from "react";
import { createAgreementDraftAction } from "@/app/actions/agreements";
import { Button } from "@/components/ui/button";
import type { FormActionState } from "@/lib/validations";

const initialState: FormActionState = {};

export function NewAgreementChooser() {
  const [state, formAction, pending] = useActionState(
    createAgreementDraftAction,
    initialState,
  );
  const [clicked, setClicked] = useState<"short_form" | "full_staged" | null>(
    null,
  );

  const busy = pending;

  return (
    <div className="space-y-6">
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <div className="grid gap-6 md:grid-cols-2">
        <form action={formAction} className="space-y-4 border border-rule p-6">
          <input type="hidden" name="agreementType" value="short_form" />
          <h2 className="font-serif text-2xl">Short form</h2>
          <p className="text-sm leading-6 text-ink-muted">
            Hourly or fixed professional fees, GST and an amount requested
            upfront.
          </p>
          <Button
            type="submit"
            disabled={busy}
            onClick={() => setClicked("short_form")}
          >
            {busy && clicked === "short_form" ? "Creating…" : "Use short form"}
          </Button>
        </form>
        <form action={formAction} className="space-y-4 border border-rule p-6">
          <input type="hidden" name="agreementType" value="full_staged" />
          <h2 className="font-serif text-2xl">Full / staged</h2>
          <p className="text-sm leading-6 text-ink-muted">
            Rates, multiple stages, consultant ranges and a total estimate.
          </p>
          <Button
            type="submit"
            disabled={busy}
            onClick={() => setClicked("full_staged")}
          >
            {busy && clicked === "full_staged" ? "Creating…" : "Use full / staged"}
          </Button>
        </form>
      </div>
    </div>
  );
}
