-- Soft-discard incorrect costs agreements without deleting immutable packs or signed PDFs.

alter table public.costs_agreements
  add column if not exists discarded_at timestamptz,
  add column if not exists discarded_by uuid references public.users (id);

create index if not exists costs_agreements_firm_created_idx
  on public.costs_agreements (firm_id, created_at desc)
  where discarded_at is null;

comment on column public.costs_agreements.discarded_at is
  'When set, the agreement is hidden from the firm list. Signed agreements cannot be discarded.';
