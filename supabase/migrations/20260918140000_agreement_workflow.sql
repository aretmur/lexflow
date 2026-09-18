-- Lexflow agreement workflow: firm setup, Victorian short-form / staged
-- agreements, snapshots, and required PDF attachment.
-- Legal template wording remains UNDER LEGAL REVIEW.

-- ---------------------------------------------------------------------------
-- firms: details reused in generated agreements
-- ---------------------------------------------------------------------------

alter table public.firms
  add column if not exists website text,
  add column if not exists jurisdiction text not null default 'VIC',
  add column if not exists logo_path text,
  add column if not exists bank_name text,
  add column if not exists account_name text,
  add column if not exists bsb text,
  add column if not exists account_number text,
  add column if not exists payment_reference_prefix text,
  add column if not exists cyber_fraud_contact_phone text;

alter table public.firms drop constraint if exists firms_jurisdiction_check;
alter table public.firms
  add constraint firms_jurisdiction_check
  check (jurisdiction in (
    'VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT', 'CTH', 'OTHER'
  ));

-- ---------------------------------------------------------------------------
-- practitioners
-- ---------------------------------------------------------------------------

alter table public.practitioners
  add column if not exists mobile text,
  add column if not exists default_hourly_rate_cents bigint not null default 0,
  add column if not exists is_active boolean not null default true;

alter table public.practitioners drop constraint if exists practitioners_rate_non_negative;
alter table public.practitioners
  add constraint practitioners_rate_non_negative
  check (default_hourly_rate_cents >= 0);

-- ---------------------------------------------------------------------------
-- matters
-- ---------------------------------------------------------------------------

alter table public.matters
  add column if not exists instructions_date date;

-- ---------------------------------------------------------------------------
-- costs_agreements: type, Victorian template identity, statuses
-- ---------------------------------------------------------------------------

alter table public.costs_agreements
  add column if not exists agreement_type text not null default 'short_form',
  add column if not exists jurisdiction text not null default 'VIC',
  add column if not exists template_key text not null default 'vic_short_form',
  add column if not exists template_version text not null default '2026-09-under-legal-review',
  add column if not exists snapshot_frozen_at timestamptz,
  add column if not exists required_attachment_id uuid;

update public.costs_agreements
  set status = 'ready'
  where status = 'ready_to_send';

alter table public.costs_agreements drop constraint if exists costs_agreements_status_check;
alter table public.costs_agreements
  add constraint costs_agreements_status_check
  check (status in (
    'draft',
    'ready',
    'generated',
    'sent',
    'viewed',
    'signed',
    'declined',
    'cancelled',
    'superseded'
  ));

alter table public.costs_agreements drop constraint if exists costs_agreements_type_check;
alter table public.costs_agreements
  add constraint costs_agreements_type_check
  check (agreement_type in ('short_form', 'full_staged'));

alter table public.costs_agreements drop constraint if exists costs_agreements_jurisdiction_check;
alter table public.costs_agreements
  add constraint costs_agreements_jurisdiction_check
  check (jurisdiction in (
    'VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT', 'CTH', 'OTHER'
  ));

-- ---------------------------------------------------------------------------
-- required_attachments (one active PDF per firm for the signing pack)
-- ---------------------------------------------------------------------------

create table if not exists public.required_attachments (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  title text not null,
  version integer not null check (version >= 1),
  storage_path text not null,
  original_filename text not null,
  content_type text not null default 'application/pdf',
  byte_size integer not null check (byte_size > 0),
  is_active boolean not null default true,
  uploaded_by uuid not null references public.users (id),
  uploaded_at timestamptz not null default now(),
  used_at timestamptz,
  unique (id, firm_id),
  unique (firm_id, version)
);

create index if not exists required_attachments_firm_active_idx
  on public.required_attachments (firm_id, is_active);

comment on table public.required_attachments is
  'Firm-uploaded statutory information sheet. Immutable once referenced by a generated/ready agreement. PDF merge into the signing pack is deferred.';

alter table public.costs_agreements drop constraint if exists costs_agreements_attachment_same_firm;
alter table public.costs_agreements
  add constraint costs_agreements_attachment_same_firm
  foreign key (required_attachment_id, firm_id)
  references public.required_attachments (id, firm_id);

create or replace function public.protect_used_required_attachment()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.used_at is not null then
      raise exception 'Required attachments used in an agreement cannot be deleted';
    end if;
    return old;
  end if;

  if old.used_at is not null then
    if new.storage_path is distinct from old.storage_path
       or new.version is distinct from old.version
       or new.title is distinct from old.title
       or new.original_filename is distinct from old.original_filename
       or new.byte_size is distinct from old.byte_size then
      raise exception 'Required attachments used in an agreement are immutable';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists required_attachments_protect_used on public.required_attachments;
create trigger required_attachments_protect_used
  before update or delete on public.required_attachments
  for each row execute function public.protect_used_required_attachment();

-- ---------------------------------------------------------------------------
-- agreement_pricing
-- ---------------------------------------------------------------------------

create table if not exists public.agreement_pricing (
  costs_agreement_id uuid primary key,
  firm_id uuid not null,
  hourly_rate_cents bigint not null default 0 check (hourly_rate_cents >= 0),
  professional_fees_ex_gst_cents bigint not null default 0 check (professional_fees_ex_gst_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  disbursements_cents bigint not null default 0 check (disbursements_cents >= 0),
  miscellaneous_fees_cents bigint not null default 0 check (miscellaneous_fees_cents >= 0),
  amount_requested_upfront_cents bigint not null default 0 check (amount_requested_upfront_cents >= 0),
  subtotal_ex_gst_cents bigint not null default 0 check (subtotal_ex_gst_cents >= 0),
  gst_cents bigint not null default 0 check (gst_cents >= 0),
  total_incl_gst_cents bigint not null default 0 check (total_incl_gst_cents >= 0),
  total_estimate_cents bigint not null default 0 check (total_estimate_cents >= 0),
  principal_lawyer_rate_cents bigint not null default 0 check (principal_lawyer_rate_cents >= 0),
  special_counsel_rate_cents bigint not null default 0 check (special_counsel_rate_cents >= 0),
  senior_lawyer_rate_cents bigint not null default 0 check (senior_lawyer_rate_cents >= 0),
  lawyer_rate_cents bigint not null default 0 check (lawyer_rate_cents >= 0),
  paralegal_rate_cents bigint not null default 0 check (paralegal_rate_cents >= 0),
  senior_counsel_hourly_min_cents bigint not null default 0 check (senior_counsel_hourly_min_cents >= 0),
  senior_counsel_hourly_max_cents bigint not null default 0 check (senior_counsel_hourly_max_cents >= 0),
  senior_counsel_daily_min_cents bigint not null default 0 check (senior_counsel_daily_min_cents >= 0),
  senior_counsel_daily_max_cents bigint not null default 0 check (senior_counsel_daily_max_cents >= 0),
  junior_counsel_hourly_min_cents bigint not null default 0 check (junior_counsel_hourly_min_cents >= 0),
  junior_counsel_hourly_max_cents bigint not null default 0 check (junior_counsel_hourly_max_cents >= 0),
  junior_counsel_daily_min_cents bigint not null default 0 check (junior_counsel_daily_min_cents >= 0),
  junior_counsel_daily_max_cents bigint not null default 0 check (junior_counsel_daily_max_cents >= 0),
  general_scope_statement text,
  exclusions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agreement_pricing_agreement_same_firm
    foreign key (costs_agreement_id, firm_id)
    references public.costs_agreements (id, firm_id) on delete cascade
);

create trigger agreement_pricing_set_updated_at
  before update on public.agreement_pricing
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- agreement_stages
-- ---------------------------------------------------------------------------

create table if not exists public.agreement_stages (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  costs_agreement_id uuid not null,
  position integer not null check (position >= 0),
  stage_number integer not null check (stage_number >= 1),
  title text not null default '',
  timing text,
  solicitor_cost_estimate_cents bigint not null default 0 check (solicitor_cost_estimate_cents >= 0),
  consultant_estimate_cents bigint not null default 0 check (consultant_estimate_cents >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, firm_id),
  constraint agreement_stages_agreement_same_firm
    foreign key (costs_agreement_id, firm_id)
    references public.costs_agreements (id, firm_id) on delete cascade
);

create trigger agreement_stages_set_updated_at
  before update on public.agreement_stages
  for each row execute function public.set_updated_at();

create index if not exists agreement_stages_agreement_idx
  on public.agreement_stages (firm_id, costs_agreement_id, position);

-- ---------------------------------------------------------------------------
-- agreement_scope_items
-- ---------------------------------------------------------------------------

create table if not exists public.agreement_scope_items (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null,
  costs_agreement_id uuid not null,
  stage_id uuid,
  position integer not null check (position >= 0),
  body text not null default '',
  created_at timestamptz not null default now(),
  unique (id, firm_id),
  constraint agreement_scope_agreement_same_firm
    foreign key (costs_agreement_id, firm_id)
    references public.costs_agreements (id, firm_id) on delete cascade,
  constraint agreement_scope_stage_same_firm
    foreign key (stage_id, firm_id)
    references public.agreement_stages (id, firm_id) on delete cascade
);

create index if not exists agreement_scope_agreement_idx
  on public.agreement_scope_items (firm_id, costs_agreement_id, position);

-- ---------------------------------------------------------------------------
-- Issued snapshots are immutable (except supersede)
-- ---------------------------------------------------------------------------

create or replace function public.protect_executed_agreement_version()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status in ('issued', 'signed') or old.executed_at is not null then
      raise exception 'Issued agreement versions are immutable';
    end if;
    return old;
  end if;

  if old.status in ('issued', 'signed') or old.executed_at is not null then
    if new.status = 'superseded'
       and new.snapshot is not distinct from old.snapshot
       and new.version_number is not distinct from old.version_number then
      return new;
    end if;
    raise exception 'Issued agreement versions are immutable';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_firm: owner membership + a default practitioner
-- ---------------------------------------------------------------------------

create or replace function public.create_firm(p_name text, p_practice_name text default null)
returns public.firms
language plpgsql
security definer
set search_path = public
as $$
declare
  new_firm public.firms;
  actor public.users;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(trim(p_name)) < 1 then
    raise exception 'Firm name is required';
  end if;

  select * into actor from public.users where id = auth.uid();

  insert into public.firms (name, practice_name, jurisdiction)
  values (
    trim(p_name),
    nullif(trim(coalesce(p_practice_name, p_name)), ''),
    'VIC'
  )
  returning * into new_firm;

  insert into public.firm_memberships (firm_id, user_id, role)
  values (new_firm.id, auth.uid(), 'owner');

  insert into public.practitioners (
    firm_id, user_id, full_name, email, title, is_active
  )
  values (
    new_firm.id,
    auth.uid(),
    coalesce(nullif(trim(actor.full_name), ''), split_part(actor.email, '@', 1), 'Principal'),
    actor.email,
    'Principal',
    true
  );

  insert into public.audit_events (
    firm_id, actor_user_id, entity_type, entity_id, action, payload
  )
  values (
    new_firm.id,
    auth.uid(),
    'firm',
    new_firm.id,
    'created',
    jsonb_build_object('name', new_firm.name)
  );

  return new_firm;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.required_attachments enable row level security;
alter table public.agreement_pricing enable row level security;
alter table public.agreement_stages enable row level security;
alter table public.agreement_scope_items enable row level security;

drop policy if exists required_attachments_select on public.required_attachments;
create policy required_attachments_select
  on public.required_attachments for select
  to authenticated
  using (public.is_firm_member(firm_id));

drop policy if exists required_attachments_insert on public.required_attachments;
create policy required_attachments_insert
  on public.required_attachments for insert
  to authenticated
  with check (
    public.has_firm_role(firm_id, array['owner', 'admin']::text[])
    and uploaded_by = auth.uid()
  );

drop policy if exists required_attachments_update on public.required_attachments;
create policy required_attachments_update
  on public.required_attachments for update
  to authenticated
  using (public.has_firm_role(firm_id, array['owner', 'admin']::text[]))
  with check (public.has_firm_role(firm_id, array['owner', 'admin']::text[]));

drop policy if exists agreement_pricing_select on public.agreement_pricing;
create policy agreement_pricing_select
  on public.agreement_pricing for select
  to authenticated
  using (public.is_firm_member(firm_id));

drop policy if exists agreement_pricing_insert on public.agreement_pricing;
create policy agreement_pricing_insert
  on public.agreement_pricing for insert
  to authenticated
  with check (public.is_firm_member(firm_id));

drop policy if exists agreement_pricing_update on public.agreement_pricing;
create policy agreement_pricing_update
  on public.agreement_pricing for update
  to authenticated
  using (public.is_firm_member(firm_id))
  with check (public.is_firm_member(firm_id));

drop policy if exists agreement_pricing_delete on public.agreement_pricing;
create policy agreement_pricing_delete
  on public.agreement_pricing for delete
  to authenticated
  using (public.is_firm_member(firm_id));

drop policy if exists agreement_stages_select on public.agreement_stages;
create policy agreement_stages_select
  on public.agreement_stages for select
  to authenticated
  using (public.is_firm_member(firm_id));

drop policy if exists agreement_stages_insert on public.agreement_stages;
create policy agreement_stages_insert
  on public.agreement_stages for insert
  to authenticated
  with check (public.is_firm_member(firm_id));

drop policy if exists agreement_stages_update on public.agreement_stages;
create policy agreement_stages_update
  on public.agreement_stages for update
  to authenticated
  using (public.is_firm_member(firm_id))
  with check (public.is_firm_member(firm_id));

drop policy if exists agreement_stages_delete on public.agreement_stages;
create policy agreement_stages_delete
  on public.agreement_stages for delete
  to authenticated
  using (public.is_firm_member(firm_id));

drop policy if exists agreement_scope_select on public.agreement_scope_items;
create policy agreement_scope_select
  on public.agreement_scope_items for select
  to authenticated
  using (public.is_firm_member(firm_id));

drop policy if exists agreement_scope_insert on public.agreement_scope_items;
create policy agreement_scope_insert
  on public.agreement_scope_items for insert
  to authenticated
  with check (public.is_firm_member(firm_id));

drop policy if exists agreement_scope_update on public.agreement_scope_items;
create policy agreement_scope_update
  on public.agreement_scope_items for update
  to authenticated
  using (public.is_firm_member(firm_id))
  with check (public.is_firm_member(firm_id));

drop policy if exists agreement_scope_delete on public.agreement_scope_items;
create policy agreement_scope_delete
  on public.agreement_scope_items for delete
  to authenticated
  using (public.is_firm_member(firm_id));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'firm-assets',
    'firm-assets',
    false,
    2097152,
    array['image/png', 'image/jpeg', 'image/webp']::text[]
  ),
  (
    'required-attachments',
    'required-attachments',
    false,
    15728640,
    array['application/pdf']::text[]
  )
on conflict (id) do nothing;

drop policy if exists firm_assets_select on storage.objects;
create policy firm_assets_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('firm-assets', 'required-attachments')
    and public.is_firm_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists firm_assets_insert on storage.objects;
create policy firm_assets_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('firm-assets', 'required-attachments')
    and public.has_firm_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin']::text[])
  );

drop policy if exists firm_assets_update on storage.objects;
create policy firm_assets_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('firm-assets', 'required-attachments')
    and public.has_firm_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin']::text[])
  )
  with check (
    bucket_id in ('firm-assets', 'required-attachments')
    and public.has_firm_role(((storage.foldername(name))[1])::uuid, array['owner', 'admin']::text[])
  );
