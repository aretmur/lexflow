"use client";

import { useActionState, useState } from "react";
import { updateSigningAction } from "@/app/actions/firm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import type { SignatureProviderName } from "@/lib/types/enums";
import type { FormActionState } from "@/lib/validations";

const initialState: FormActionState = {};

export function SigningForm({
  requirePageInitials,
  requireEmailOtpForQr,
  signingProvider,
  signingSenderName,
  signingSenderEmail,
  signingReplyToEmail,
}: {
  requirePageInitials: boolean;
  requireEmailOtpForQr: boolean;
  signingProvider: SignatureProviderName;
  signingSenderName: string;
  signingSenderEmail: string;
  signingReplyToEmail: string;
}) {
  const [state, formAction, pending] = useActionState(updateSigningAction, initialState);
  const [enabled, setEnabled] = useState(requirePageInitials);
  const [otpForQr, setOtpForQr] = useState(requireEmailOtpForQr);
  const [provider, setProvider] = useState<SignatureProviderName>(signingProvider);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <input type="hidden" name="requirePageInitials" value={enabled ? "true" : "false"} />
      <input type="hidden" name="requireEmailOtpForQr" value={otpForQr ? "true" : "false"} />
      <input type="hidden" name="signingProvider" value={provider} />
      <div className="space-y-2">
        <Label>Signing provider</Label>
        <p className="text-sm text-ink-muted">
          Lexflow signing captures consent, initials and a signature in the
          agreement pack. Dropbox Sign remains available if this firm already
          uses it.
        </p>
        <Toggle
          value={provider === "native_lexflow"}
          onChange={(native) => setProvider(native ? "native_lexflow" : "dropbox_sign")}
          onLabel="Lexflow"
          offLabel="Dropbox Sign"
        />
      </div>
      <div className="space-y-2">
        <Label>Require client initials on every page</Label>
        <p className="text-sm text-ink-muted">
          When enabled, the client must initial every page of the agreement pack
          before completing the signature request.
        </p>
        <Toggle value={enabled} onChange={setEnabled} />
      </div>
      {provider === "native_lexflow" ? (
        <div className="space-y-2">
          <Label>Require email code for QR and same-device signing</Label>
          <p className="text-sm text-ink-muted">
            Email signing always requires a one-time code. Turn this on to also
            require that code when the client scans a QR code or signs on this
            device.
          </p>
          <Toggle value={otpForQr} onChange={setOtpForQr} />
        </div>
      ) : null}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>SIGNING EMAIL</Label>
          <p className="text-sm text-ink-muted">
            Clients receive signing links and verification emails using these
            details.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="signingSenderName">Sender name</Label>
          <Input
            id="signingSenderName"
            name="signingSenderName"
            defaultValue={signingSenderName}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signingSenderEmail">Sender email</Label>
          <Input
            id="signingSenderEmail"
            name="signingSenderEmail"
            type="email"
            defaultValue={signingSenderEmail}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signingReplyToEmail">Reply-to email</Label>
          <Input
            id="signingReplyToEmail"
            name="signingReplyToEmail"
            type="email"
            defaultValue={signingReplyToEmail}
          />
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

function Toggle({
  value,
  onChange,
  onLabel = "ON",
  offLabel = "OFF",
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <div className="inline-flex border border-rule-strong">
      {(
        [
          { selected: true, label: onLabel },
          { selected: false, label: offLabel },
        ] as const
      ).map((option) => {
        const selected = value === option.selected;
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
            onClick={() => onChange(option.selected)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
