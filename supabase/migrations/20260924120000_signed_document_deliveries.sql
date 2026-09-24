-- Immutable signed-PDF email delivery records.
-- Generated packs and signed documents remain immutable and are not updated.

create table if not exists public.signed_document_deliveries (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  signed_document_id uuid not null,
  signature_request_id uuid not null,
  recipient_role text not null check (recipient_role in ('client', 'firm')),
  recipient_email text not null check (char_length(trim(recipient_email)) between 3 and 320),
  provider text,
  provider_message_id text,
  status text not null check (status in ('pending', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, firm_id),
  unique (signed_document_id, recipient_role),
  constraint signed_deliveries_document_same_firm
    foreign key (signed_document_id, firm_id)
    references public.signed_agreement_documents (id, firm_id),
  constraint signed_deliveries_request_same_firm
    foreign key (signature_request_id, firm_id)
    references public.signature_requests (id, firm_id)
);

create index if not exists signed_deliveries_firm_document_idx
  on public.signed_document_deliveries (firm_id, signed_document_id);

create trigger signed_deliveries_set_updated_at
  before update on public.signed_document_deliveries
  for each row execute function public.set_updated_at();

comment on table public.signed_document_deliveries is
  'Email delivery of an already-stored signed PDF. Delivery failure never invalidates the signature.';

alter table public.signed_document_deliveries enable row level security;

drop policy if exists signed_deliveries_select on public.signed_document_deliveries;
create policy signed_deliveries_select
  on public.signed_document_deliveries for select
  to authenticated
  using (public.is_firm_member(firm_id));
