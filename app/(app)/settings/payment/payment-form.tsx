"use client";

import { useActionState } from "react";
import { updatePaymentAction } from "@/app/actions/firm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Firm } from "@/lib/types/database";
import type { FormActionState } from "@/lib/validations";

const initialState: FormActionState = {};

export function PaymentForm({ firm }: { firm: Firm }) {
  const [state, formAction, pending] = useActionState(updatePaymentAction, initialState);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <div className="space-y-2">
        <Label htmlFor="bankName">Bank name</Label>
        <Input id="bankName" name="bankName" defaultValue={firm.bank_name ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="accountName">Account name</Label>
        <Input id="accountName" name="accountName" defaultValue={firm.account_name ?? ""} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bsb">BSB</Label>
          <Input id="bsb" name="bsb" defaultValue={firm.bsb ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="accountNumber">Account number</Label>
          <Input
            id="accountNumber"
            name="accountNumber"
            defaultValue={firm.account_number ?? ""}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="paymentReferencePrefix">Payment / reference prefix</Label>
        <Input
          id="paymentReferencePrefix"
          name="paymentReferencePrefix"
          defaultValue={firm.payment_reference_prefix ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cyberFraudContactPhone">Cyber-fraud warning contact phone</Label>
        <Input
          id="cyberFraudContactPhone"
          name="cyberFraudContactPhone"
          defaultValue={firm.cyber_fraud_contact_phone ?? ""}
        />
      </div>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-ink">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save payment details"}
      </Button>
    </form>
  );
}
