"use client";

import { useActionState } from "react";
import { savePractitionerAction } from "@/app/actions/firm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centsToInputString } from "@/lib/money";
import type { Practitioner } from "@/lib/types/database";
import type { FormActionState } from "@/lib/validations";

const initialState: FormActionState = {};

export function PractitionerForm({
  practitioner,
}: {
  practitioner?: Pick<
    Practitioner,
    | "id"
    | "full_name"
    | "title"
    | "email"
    | "mobile"
    | "default_hourly_rate_cents"
    | "is_active"
  >;
}) {
  const [state, formAction, pending] = useActionState(
    savePractitionerAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-4 border border-rule p-5">
      {practitioner ? <input type="hidden" name="id" value={practitioner.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`fullName-${practitioner?.id ?? "new"}`}>Full name</Label>
          <Input
            id={`fullName-${practitioner?.id ?? "new"}`}
            name="fullName"
            defaultValue={practitioner?.full_name ?? ""}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`title-${practitioner?.id ?? "new"}`}>Title</Label>
          <Input
            id={`title-${practitioner?.id ?? "new"}`}
            name="title"
            defaultValue={practitioner?.title ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`email-${practitioner?.id ?? "new"}`}>Email</Label>
          <Input
            id={`email-${practitioner?.id ?? "new"}`}
            name="email"
            type="email"
            defaultValue={practitioner?.email ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`mobile-${practitioner?.id ?? "new"}`}>Mobile</Label>
          <Input
            id={`mobile-${practitioner?.id ?? "new"}`}
            name="mobile"
            defaultValue={practitioner?.mobile ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`rate-${practitioner?.id ?? "new"}`}>Default hourly rate</Label>
          <Input
            id={`rate-${practitioner?.id ?? "new"}`}
            name="defaultHourlyRate"
            defaultValue={centsToInputString(practitioner?.default_hourly_rate_cents ?? 0)}
          />
        </div>
        <label className="mt-6 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={practitioner?.is_active ?? true}
          />
          Active
        </label>
      </div>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-ink">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : practitioner ? "Save" : "Add practitioner"}
      </Button>
    </form>
  );
}
