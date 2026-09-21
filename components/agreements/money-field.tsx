"use client";

import { useState } from "react";
import { centsToInputString, parseOptionalAudToCents } from "@/lib/money";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MoneyField({
  id,
  label,
  valueCents,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  valueCents: number;
  onChange: (cents: number) => void;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(centsToInputString(valueCents));
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        disabled={disabled}
        className={
          disabled ? "cursor-not-allowed bg-paper text-ink-muted" : undefined
        }
        value={focused ? text : centsToInputString(valueCents)}
        onFocus={() => {
          setText(centsToInputString(valueCents));
          setFocused(true);
        }}
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
        onBlur={() => {
          setFocused(false);
          try {
            const cents = parseOptionalAudToCents(text);
            onChange(cents);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Invalid amount");
          }
        }}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
