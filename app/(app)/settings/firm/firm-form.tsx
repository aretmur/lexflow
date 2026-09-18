"use client";

import { useActionState } from "react";
import { createFirmAction, updateFirmAction } from "@/app/actions/firm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { JURISDICTIONS } from "@/lib/types/enums";
import type { Firm } from "@/lib/types/database";
import type { FormActionState } from "@/lib/validations";

const initialState: FormActionState = {};

export function FirmForm({ firm }: { firm: Firm | null }) {
  const action = firm ? updateFirmAction : createFirmAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Legal entity name</Label>
        <Input id="name" name="name" defaultValue={firm?.name ?? ""} required minLength={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="practiceName">Trading name</Label>
        <Input id="practiceName" name="practiceName" defaultValue={firm?.practice_name ?? ""} />
      </div>
      {firm ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="abn">ABN</Label>
            <Input id="abn" name="abn" defaultValue={firm.abn ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={firm.email ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={firm.phone ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input id="website" name="website" defaultValue={firm.website ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jurisdiction">Jurisdiction</Label>
            <Select id="jurisdiction" name="jurisdiction" defaultValue={firm.jurisdiction}>
              {JURISDICTIONS.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine1">Street / postal address</Label>
            <Input
              id="addressLine1"
              name="addressLine1"
              defaultValue={firm.address_line1 ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine2">Address line 2</Label>
            <Input
              id="addressLine2"
              name="addressLine2"
              defaultValue={firm.address_line2 ?? ""}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="suburb">Suburb</Label>
              <Input id="suburb" name="suburb" defaultValue={firm.suburb ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" defaultValue={firm.state ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode</Label>
              <Input id="postcode" name="postcode" defaultValue={firm.postcode ?? ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">Logo</Label>
            <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
            {firm.logo_path ? (
              <p className="text-xs text-ink-muted">A logo is on file. Upload a new file to replace it.</p>
            ) : null}
          </div>
        </>
      ) : null}
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-ink">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : firm ? "Save firm" : "Create firm"}
      </Button>
    </form>
  );
}
