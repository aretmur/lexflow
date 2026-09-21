"use client";

import { useActionState, useState } from "react";
import { updateSigningAction } from "@/app/actions/firm";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import type { FormActionState } from "@/lib/validations";

const initialState: FormActionState = {};

export function SigningForm({
  requirePageInitials,
}: {
  requirePageInitials: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateSigningAction, initialState);
  const [enabled, setEnabled] = useState(requirePageInitials);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <input type="hidden" name="requirePageInitials" value={enabled ? "true" : "false"} />
      <div className="space-y-2">
        <Label>Require client initials on every page</Label>
        <p className="text-sm text-ink-muted">
          When enabled, the client must initial every page of the agreement pack
          before completing the signature request.
        </p>
        <div className="inline-flex border border-rule-strong">
          {(
            [
              { value: true, label: "ON" },
              { value: false, label: "OFF" },
            ] as const
          ).map((option) => {
            const selected = enabled === option.value;
            return (
              <button
                key={option.label}
                type="button"
                className={cn(
                  "h-10 px-4 text-sm font-medium",
                  selected
                    ? "bg-accent text-paper-raised"
                    : "bg-paper-raised text-ink hover:border-ink",
                )}
                onClick={() => setEnabled(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-ink">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save signing settings"}
      </Button>
    </form>
  );
}
