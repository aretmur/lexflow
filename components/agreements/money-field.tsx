"use client";

import { useState } from "react";
import { centsToInputString, interpretMoneyFieldText } from "@/lib/money";
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

  function applyText(nextText: string, { blur }: { blur: boolean }) {
    const interpretation = interpretMoneyFieldText(nextText);
    if (interpretation.status === "valid") {
      setError(null);
      if (interpretation.cents !== valueCents) {
        onChange(interpretation.cents);
      }
      if (blur) {
        setText(centsToInputString(interpretation.cents));
      }
      return;
    }
    if (interpretation.status === "incomplete") {
      setError(null);
      return;
    }
    setError(interpretation.message);
  }

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
        value={focused || error ? text : centsToInputString(valueCents)}
        onFocus={() => {
          setText(centsToInputString(valueCents));
          setFocused(true);
        }}
        onChange={(event) => {
          const nextText = event.target.value;
          setText(nextText);
          applyText(nextText, { blur: false });
        }}
        onBlur={() => {
          setFocused(false);
          applyText(text, { blur: true });
        }}
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
