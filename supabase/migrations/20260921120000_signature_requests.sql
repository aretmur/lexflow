-- Electronic signature requests and immutable signed agreement documents.
-- Clients sign via a signature provider (Dropbox Sign) and do not need a Lexflow account.

-- ---------------------------------------------------------------------------
-- signature_requests
-- ---------------------------------------------------------------------------

create table if not exists public.signature_requests (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  costs_agreement_id uuid not null,
  agreement_version_id uuid not null,
  generated_pack_id uuid not null,
  provider text not null check (provider in ('dropbox_sign')),
  provider_request_id text,
  signer_name text not null check (char_length(trim(signer_name)) between 1 and 200),
  signer_email text not null check (char_length(trim(signer_email)) between 3 and 320),
  status text not null check (status in (
    'pending',
    'sent',
    'viewed',
    'signed',
    'declined',
    'cancelled',
    'expired',
    'failed'
  )),
  test_mode boolean not null default false,
  last_error text,
  last_webhook_event_id text,
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  declined_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, firm_id),
  constraint signature_requests_agreement_same_firm
    foreign key (costs_agreement_id, firm_id)
    references public.costs_agreements (id, firm_id),
  constraint signature_requests_version_same_firm
    foreign key (agreement_version_id, firm_id)
    references public.agreement_versions (id, firm_id),
  constraint signature_requests_pack_same_firm
    foreign key (generated_pack_id, firm_id)
    references public.generated_agreement_packs (id, firm_id)
);

create unique index if not exists signature_requests_provider_request_uidx
  on public.signature_requests (provider, provider_request_id)
  where provider_request_id is not null;

create unique index if not exists signature_requests_one_active_uidx
  on public.signature_requests (costs_agreement_id)
  where status in ('pending', 'sent', 'viewed');

create index if not exists signature_requests_firm_agreement_idx
  on public.signature_requests (firm_id, costs_agreement_id, created_at desc);

create trigger signature_requests_set_updated_at
  before update on public.signature_requests
  for each row execute function public.set_updated_at();

comment on table public.signature_requests is
  'Provider-backed signature requests. Clients sign from the provider link and do not need a Lexflow account.';

-- ---------------------------------------------------------------------------
-- signature_webhook_events (idempotency)
-- ---------------------------------------------------------------------------

create table if not exists public.signature_webhook_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  signature_request_id uuid not null,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  unique (id, firm_id),
  unique (provider, provider_event_id),
  constraint signature_webhook_events_request_same_firm
    foreign key (signature_request_id, firm_id)
    references public.signature_requests (id, firm_id)
);

create index if not exists signature_webhook_events_request_idx
  on public.signature_webhook_events (signature_request_id, processed_at desc);

comment on table public.signature_webhook_events is
  'Idempotency log of signature-provider webhook events. Duplicate event ids are rejected.';

-- ---------------------------------------------------------------------------
-- signed_agreement_documents (immutable)
-- ---------------------------------------------------------------------------

create table if not exists public.signed_agreement_documents (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  costs_agreement_id uuid not null,
  agreement_version_id uuid not null,
  signature_request_id uuid not null,
  storage_path text not null,
  sha256 text not null check (char_length(sha256) = 64),
  page_count integer not null check (page_count >= 1),
  byte_size integer not null check (byte_size > 0),
  signed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (id, firm_id),
  unique (signature_request_id),
  unique (firm_id, storage_path),
  constraint signed_docs_agreement_same_firm
    foreign key (costs_agreement_id, firm_id)
    references public.costs_agreements (id, firm_id),
  constraint signed_docs_version_same_firm
    foreign key (agreement_version_id, firm_id)
    references public.agreement_versions (id, firm_id),
  constraint signed_docs_request_same_firm
    foreign key (signature_request_id, firm_id)
    references public.signature_requests (id, firm_id)
);

create index if not exists signed_docs_firm_agreement_idx
  on public.signed_agreement_documents (firm_id, costs_agreement_id);

comment on table public.signed_agreement_documents is
  'Immutable signed costs-agreement PDFs. Never overwrite the unsigned generated pack.';

create or replace function public.protect_signed_agreement_document()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Signed agreement documents are immutable';
end;
$$;

drop trigger if exists signed_docs_protect on public.signed_agreement_documents;
create trigger signed_docs_protect
  before update or delete on public.signed_agreement_documents
  for each row execute function public.protect_signed_agreement_document();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.signature_requests enable row level security;
alter table public.signature_webhook_events enable row level security;
alter table public.signed_agreement_documents enable row level security;

drop policy if exists signature_requests_select on public.signature_requests;
create policy signature_requests_select
  on public.signature_requests for select
  to authenticated
  using (public.is_firm_member(firm_id));

drop policy if exists signature_requests_insert on public.signature_requests;
create policy signature_requests_insert
  on public.signature_requests for insert
  to authenticated
  with check (
    public.is_firm_member(firm_id)
    and created_by = auth.uid()
  );

drop policy if exists signature_requests_update on public.signature_requests;
create policy signature_requests_update
  on public.signature_requests for update
  to authenticated
  using (public.is_firm_member(firm_id))
  with check (public.is_firm_member(firm_id));

drop policy if exists signature_webhook_events_select on public.signature_webhook_events;
create policy signature_webhook_events_select
  on public.signature_webhook_events for select
  to authenticated
  using (public.is_firm_member(firm_id));

drop policy if exists signed_docs_select on public.signed_agreement_documents;
create policy signed_docs_select
  on public.signed_agreement_documents for select
  to authenticated
  using (public.is_firm_member(firm_id));

drop policy if exists signed_docs_insert on public.signed_agreement_documents;
create policy signed_docs_insert
  on public.signed_agreement_documents for insert
  to authenticated
  with check (public.is_firm_member(firm_id));

-- ---------------------------------------------------------------------------
-- Storage: signed-agreements
-- Path: {firm_id}/{agreement_id}/version-{n}/signed-agreement.pdf
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'signed-agreements',
  'signed-agreements',
  false,
  26214400,
  array['application/pdf']::text[]
)
on conflict (id) do nothing;

drop policy if exists signed_agreements_select on storage.objects;
create policy signed_agreements_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'signed-agreements'
    and public.is_firm_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists signed_agreements_insert on storage.objects;
create policy signed_agreements_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'signed-agreements'
    and public.is_firm_member(((storage.foldername(name))[1])::uuid)
  );
