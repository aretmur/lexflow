-- Native Lexflow electronic signing. Dropbox Sign remains available as a selectable provider.

alter table public.firms
  add column if not exists signing_provider text not null default 'native_lexflow',
  add column if not exists require_email_otp_for_qr boolean not null default false;

alter table public.firms
  drop constraint if exists firms_signing_provider_check;

alter table public.firms
  add constraint firms_signing_provider_check
  check (signing_provider in ('native_lexflow', 'dropbox_sign'));

comment on column public.firms.signing_provider is
  'Primary electronic-signing provider for this firm. native_lexflow is first-party capture; dropbox_sign remains available.';

comment on column public.firms.require_email_otp_for_qr is
  'When true, QR and same-device native signing also require email OTP before the client can sign.';

alter table public.generated_agreement_packs
  add column if not exists agreement_page_count integer,
  add column if not exists attachment_page_count integer;

comment on column public.generated_agreement_packs.agreement_page_count is
  'Page count of the generated costs agreement before the required attachment. Null on packs generated before this column existed. Do not backfill; packs are immutable.';

comment on column public.generated_agreement_packs.attachment_page_count is
  'Page count of the appended required attachment. Null on packs generated before this column existed. Do not backfill; packs are immutable.';

alter table public.signature_requests
  drop constraint if exists signature_requests_provider_check;

alter table public.signature_requests
  add constraint signature_requests_provider_check
  check (provider in ('dropbox_sign', 'native_lexflow'));

alter table public.signature_requests
  drop constraint if exists signature_requests_signing_mode_check;

alter table public.signature_requests
  add constraint signature_requests_signing_mode_check
  check (signing_mode in (
    'embedded_same_device',
    'embedded_qr',
    'email',
    'qr',
    'same_device'
  ));

alter table public.signature_requests
  add column if not exists email_verified_at timestamptz,
  add column if not exists otp_hash text,
  add column if not exists otp_expires_at timestamptz,
  add column if not exists otp_attempt_count integer not null default 0,
  add column if not exists last_otp_sent_at timestamptz,
  add column if not exists initialled_page_count integer not null default 0,
  add column if not exists consent_text_version text,
  add column if not exists consented_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists initiated_by_user_id uuid references public.users (id),
  add column if not exists signer_ip text,
  add column if not exists signer_user_agent text,
  add column if not exists generated_document_sha256 text,
  add column if not exists signed_document_sha256 text,
  add column if not exists execution_page integer,
  add column if not exists agreement_page_count integer,
  add column if not exists firm_display_name text;

update public.signature_requests
set initiated_by_user_id = coalesce(initiated_by_user_id, created_by)
where initiated_by_user_id is null;

create table if not exists public.signing_audit_records (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  costs_agreement_id uuid not null,
  agreement_version_id uuid not null,
  signature_request_id uuid not null unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, firm_id),
  constraint signing_audit_request_same_firm
    foreign key (signature_request_id, firm_id)
    references public.signature_requests (id, firm_id)
);

alter table public.signing_audit_records enable row level security;

drop policy if exists signing_audit_select on public.signing_audit_records;
create policy signing_audit_select
  on public.signing_audit_records for select
  to authenticated
  using (public.is_firm_member(firm_id));

drop policy if exists signing_audit_insert on public.signing_audit_records;
create policy signing_audit_insert
  on public.signing_audit_records for insert
  to authenticated
  with check (public.is_firm_member(firm_id));

create or replace function public.protect_signing_audit_record()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Signing audit records are immutable';
end;
$$;

drop trigger if exists signing_audit_protect on public.signing_audit_records;
create trigger signing_audit_protect
  before update or delete on public.signing_audit_records
  for each row execute function public.protect_signing_audit_record();

comment on table public.signing_audit_records is
  'Immutable electronic-signing audit records. Not appended to the costs agreement PDF.';
