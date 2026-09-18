"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoneyField } from "@/components/agreements/money-field";
import { ScopeList } from "@/components/agreements/scope-list";
import { newStage } from "@/lib/agreements/draft";
import type { AgreementDraft } from "@/lib/validations";

export function StageList({
  stages,
  onChange,
}: {
  stages: AgreementDraft["stages"];
  onChange: (stages: AgreementDraft["stages"]) => void;
}) {
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= stages.length) {
      return;
    }
    const next = [...stages];
    const [removed] = next.splice(index, 1);
    next.splice(target, 0, removed);
    onChange(next);
  }

  function duplicate(index: number) {
    const source = stages[index];
    const copy = {
      ...source,
      id: crypto.randomUUID(),
      title: source.title ? `${source.title} (copy)` : "",
      scopeItems: source.scopeItems.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      })),
    };
    const next = [...stages];
    next.splice(index + 1, 0, copy);
    onChange(next);
  }

  return (
    <div className="space-y-6">
      {stages.map((stage, index) => (
        <section key={stage.id} className="space-y-4 border border-rule p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">Stage {index + 1}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => move(index, -1)} disabled={index === 0}>
                Up
              </Button>
              <Button
                variant="ghost"
                onClick={() => move(index, 1)}
                disabled={index === stages.length - 1}
              >
                Down
              </Button>
              <Button variant="ghost" onClick={() => duplicate(index)}>
                Duplicate
              </Button>
              <Button
                variant="ghost"
                onClick={() => onChange(stages.filter((entry) => entry.id !== stage.id))}
                disabled={stages.length === 1}
              >
                Remove
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`stage-title-${stage.id}`}>Title</Label>
              <Input
                id={`stage-title-${stage.id}`}
                value={stage.title}
                onChange={(event) =>
                  onChange(
                    stages.map((entry) =>
                      entry.id === stage.id ? { ...entry, title: event.target.value } : entry,
                    ),
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`stage-timing-${stage.id}`}>Date / timing</Label>
              <Input
                id={`stage-timing-${stage.id}`}
                value={stage.timing}
                onChange={(event) =>
                  onChange(
                    stages.map((entry) =>
                      entry.id === stage.id ? { ...entry, timing: event.target.value } : entry,
                    ),
                  )
                }
              />
            </div>
          </div>
          <div>
            <Label>Scope items</Label>
            <div className="mt-2">
              <ScopeList
                items={stage.scopeItems}
                onChange={(scopeItems) =>
                  onChange(
                    stages.map((entry) =>
                      entry.id === stage.id ? { ...entry, scopeItems } : entry,
                    ),
                  )
                }
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField
              id={`stage-solicitor-${stage.id}`}
              label="Solicitor cost estimate"
              valueCents={stage.solicitorCostEstimateCents}
              onChange={(solicitorCostEstimateCents) =>
                onChange(
                  stages.map((entry) =>
                    entry.id === stage.id ? { ...entry, solicitorCostEstimateCents } : entry,
                  ),
                )
              }
            />
            <MoneyField
              id={`stage-consultant-${stage.id}`}
              label="Consultant estimate"
              valueCents={stage.consultantEstimateCents}
              onChange={(consultantEstimateCents) =>
                onChange(
                  stages.map((entry) =>
                    entry.id === stage.id ? { ...entry, consultantEstimateCents } : entry,
                  ),
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`stage-notes-${stage.id}`}>Notes</Label>
            <Textarea
              id={`stage-notes-${stage.id}`}
              value={stage.notes}
              onChange={(event) =>
                onChange(
                  stages.map((entry) =>
                    entry.id === stage.id ? { ...entry, notes: event.target.value } : entry,
                  ),
                )
              }
            />
          </div>
        </section>
      ))}
      <Button variant="secondary" onClick={() => onChange([...stages, newStage(stages.length)])}>
        Add stage
      </Button>
    </div>
  );
}
