-- Immutable generated agreement packs: rendered PDF + frozen required attachment.
-- Legal template wording remains UNDER LEGAL REVIEW.

-- ---------------------------------------------------------------------------
-- generated_agreement_packs
-- ---------------------------------------------------------------------------

create table if not exists public.generated_agreement_packs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  costs_agreement_id uuid not null,
  agreement_version_id uuid not null,
  version_number integer not null check (version_number >= 1),
  generated_at timestamptz not null default now(),
  generated_by uuid not null references public.users (id),
  template_key text not null,
  template_version text not null,
  required_attachment_id uuid not null,
  storage_path text not null,
  sha256 text not null check (char_length(sha256) = 64),
  page_count integer not null check (page_count >= 1),
  byte_size integer not null check (byte_size > 0),
  unique (id, firm_id),
  unique (costs_agreement_id, agreement_version_id),
  unique (firm_id, storage_path),
  constraint generated_packs_agreement_same_firm
    foreign key (costs_agreement_id, firm_id)
    references public.costs_agreements (id, firm_id),
  constraint generated_packs_version_same_firm
    foreign key (agreement_version_id, firm_id)
    references public.agreement_versions (id, firm_id),
  constraint generated_packs_attachment_same_firm
    foreign key (required_attachment_id, firm_id)
    references public.required_attachments (id, firm_id)
);

create index if not exists generated_packs_firm_agreement_idx
  on public.generated_agreement_packs (firm_id, costs_agreement_id);

comment on table public.generated_agreement_packs is
  'Immutable generated agreement packs. Never overwrite; a material change requires a new frozen version.';

create or replace function public.protect_generated_agreement_pack()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Generated agreement packs are immutable';
  end if;
  raise exception 'Generated agreement packs are immutable';
end;
$$;

drop trigger if exists generated_packs_protect on public.generated_agreement_packs;
create trigger generated_packs_protect
  before update or delete on public.generated_agreement_packs
  for each row execute function public.protect_generated_agreement_pack();

alter table public.generated_agreement_packs enable row level security;

drop policy if exists generated_packs_select on public.generated_agreement_packs;
create policy generated_packs_select
  on public.generated_agreement_packs for select
  to authenticated
  using (public.is_firm_member(firm_id));

drop policy if exists generated_packs_insert on public.generated_agreement_packs;
create policy generated_packs_insert
  on public.generated_agreement_packs for insert
  to authenticated
  with check (
    public.is_firm_member(firm_id)
    and generated_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Storage: generated-agreements
-- Path: {firm_id}/{agreement_id}/version-{n}/agreement-pack.pdf
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'generated-agreements',
  'generated-agreements',
  false,
  26214400,
  array['application/pdf']::text[]
)
on conflict (id) do nothing;

drop policy if exists generated_agreements_select on storage.objects;
create policy generated_agreements_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'generated-agreements'
    and public.is_firm_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists generated_agreements_insert on storage.objects;
create policy generated_agreements_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'generated-agreements'
    and public.is_firm_member(((storage.foldername(name))[1])::uuid)
  );
