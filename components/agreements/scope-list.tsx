"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AgreementDraft } from "@/lib/validations";
import { newScopeItem } from "@/lib/agreements/draft";

export function ScopeList({
  items,
  onChange,
}: {
  items: AgreementDraft["scopeItems"];
  onChange: (items: AgreementDraft["scopeItems"]) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={item.id} className="flex gap-2">
          <span className="mt-2 w-6 text-sm text-ink-muted">{index + 1}.</span>
          <Input
            value={item.body}
            onChange={(event) => {
              const next = items.map((entry) =>
                entry.id === item.id ? { ...entry, body: event.target.value } : entry,
              );
              onChange(next);
            }}
          />
          <Button
            variant="ghost"
            onClick={() => onChange(items.filter((entry) => entry.id !== item.id))}
            disabled={items.length === 1}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button variant="secondary" onClick={() => onChange([...items, newScopeItem()])}>
        Add item
      </Button>
    </div>
  );
}
