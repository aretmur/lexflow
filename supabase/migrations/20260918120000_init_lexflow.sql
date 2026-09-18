-- Lexflow initial schema
-- Multi-tenant legal workflow: instructions → signed and funded.
-- Funding tables are workflow records only. They are not statutory trust ledgers.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_firm_member(_firm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.firm_memberships
    where firm_id = _firm_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.has_firm_role(_firm_id uuid, _roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.firm_memberships
    where firm_id = _firm_id
      and user_id = auth.uid()
      and role = any (_roles)
  );
$$;

create or replace function public.forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'This record is immutable';
end;
$$;

-- ---------------------------------------------------------------------------
-- firms
-- ---------------------------------------------------------------------------

create table public.firms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 200),
  practice_name text,
  abn text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  suburb text,
  state text,
  postcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger firms_set_updated_at
  before update on public.firms
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- users (app profile; auth identity lives in auth.users)
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- firm_memberships
-- ---------------------------------------------------------------------------

create table public.firm_memberships (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (firm_id, user_id)
);

create index firm_memberships_user_id_idx on public.firm_memberships (user_id);
create index firm_memberships_firm_id_idx on public.firm_memberships (firm_id);

-- ---------------------------------------------------------------------------
-- practitioners
-- ---------------------------------------------------------------------------

create table public.practitioners (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  full_name text not null check (char_length(trim(full_name)) between 1 and 200),
  email text,
  title text,
  practising_certificate_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, firm_id)
);

create trigger practitioners_set_updated_at
  before update on public.practitioners
  for each row execute function public.set_updated_at();

create index practitioners_firm_id_idx on public.practitioners (firm_id);

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 200),
  client_type text not null default 'individual'
    check (client_type in ('individual', 'company', 'other')),
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  suburb text,
  state text,
  postcode text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, firm_id)
);

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create index clients_firm_id_idx on public.clients (firm_id);
create index clients_firm_id_display_name_idx on public.clients (firm_id, display_name);

-- ---------------------------------------------------------------------------
-- matters
-- ---------------------------------------------------------------------------

create table public.matters (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  client_id uuid not null,
  responsible_practitioner_id uuid,
  matter_number text not null check (char_length(trim(matter_number)) between 1 and 50),
  matter_title text not null check (char_length(trim(matter_title)) between 1 and 300),
  matter_description text,
  jurisdiction text not null check (jurisdiction in (
    'VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT', 'CTH', 'OTHER'
  )),
  practice_area text,
  pricing_type text not null check (pricing_type in (
    'fixed_fee', 'staged_fixed_fee', 'hourly', 'estimate_range'
  )),
  agreed_or_estimated_cost_cents bigint not null default 0
    check (agreed_or_estimated_cost_cents >= 0),
  gst_treatment text not null check (gst_treatment in (
    'gst_inclusive', 'gst_exclusive', 'gst_free', 'not_applicable'
  )),
  status text not null default 'draft' check (status in (
    'draft',
    'awaiting_agreement',
    'agreement_sent',
    'agreement_signed',
    'awaiting_funds',
    'funded',
    'active',
    'closed'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, firm_id),
  unique (firm_id, matter_number),
  constraint matters_client_same_firm
    foreign key (client_id, firm_id) references public.clients (id, firm_id),
  constraint matters_practitioner_same_firm
    foreign key (responsible_practitioner_id, firm_id)
    references public.practitioners (id, firm_id)
);

create trigger matters_set_updated_at
  before update on public.matters
  for each row execute function public.set_updated_at();

create index matters_firm_id_status_idx on public.matters (firm_id, status);
create index matters_firm_id_client_id_idx on public.matters (firm_id, client_id);
create index matters_firm_id_practitioner_idx on public.matters (firm_id, responsible_practitioner_id);

comment on column public.matters.agreed_or_estimated_cost_cents is
  'Integer cents. Agreed fixed fee or current estimate. Never a floating-point value.';

-- ---------------------------------------------------------------------------
-- legal_templates
-- ---------------------------------------------------------------------------

create table public.legal_templates (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  template_name text not null,
  jurisdiction text not null check (jurisdiction in (
    'VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT', 'CTH', 'OTHER'
  )),
  version text not null,
  effective_date date,
  status text not null default 'under_legal_review' check (status in (
    'draft', 'under_legal_review', 'approved', 'retired'
  )),
  approved_by uuid references public.users (id),
  last_reviewed_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, firm_id),
  unique (firm_id, template_name, version)
);

create trigger legal_templates_set_updated_at
  before update on public.legal_templates
  for each row execute function public.set_updated_at();

create index legal_templates_firm_id_status_idx on public.legal_templates (firm_id, status);

comment on table public.legal_templates is
  'Deterministic legal templates. Do not treat wording as approved unless status = approved. Initial content is UNDER LEGAL REVIEW.';

-- ---------------------------------------------------------------------------
-- costs_agreements
-- ---------------------------------------------------------------------------

create table public.costs_agreements (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  matter_id uuid not null,
  template_id uuid,
  status text not null default 'draft' check (status in (
    'draft',
    'ready_to_send',
    'sent',
    'viewed',
    'signed',
    'declined',
    'superseded'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, firm_id),
  constraint costs_agreements_matter_same_firm
    foreign key (matter_id, firm_id) references public.matters (id, firm_id),
  constraint costs_agreements_template_same_firm
    foreign key (template_id, firm_id) references public.legal_templates (id, firm_id)
);

create trigger costs_agreements_set_updated_at
  before update on public.costs_agreements
  for each row execute function public.set_updated_at();

create index costs_agreements_firm_id_status_idx on public.costs_agreements (firm_id, status);
create index costs_agreements_firm_id_matter_id_idx on public.costs_agreements (firm_id, matter_id);

-- ---------------------------------------------------------------------------
-- agreement_versions
-- Executed (signed) versions are immutable. Changes require a new version.
-- ---------------------------------------------------------------------------

create table public.agreement_versions (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  costs_agreement_id uuid not null,
  version_number integer not null check (version_number >= 1),
  status text not null default 'draft' check (status in (
    'draft', 'issued', 'signed', 'superseded'
  )),
  snapshot jsonb not null default '{}'::jsonb,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, firm_id),
  unique (costs_agreement_id, version_number),
  constraint agreement_versions_agreement_same_firm
    foreign key (costs_agreement_id, firm_id)
    references public.costs_agreements (id, firm_id),
  constraint agreement_versions_signed_has_executed_at
    check (status <> 'signed' or executed_at is not null)
);

create index agreement_versions_firm_id_idx on public.agreement_versions (firm_id);
create index agreement_versions_agreement_id_idx on public.agreement_versions (costs_agreement_id);

create or replace function public.protect_executed_agreement_version()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'signed' or old.executed_at is not null then
      raise exception 'Executed agreement versions are immutable';
    end if;
    return old;
  end if;

  if old.status = 'signed' or old.executed_at is not null then
    raise exception 'Executed agreement versions are immutable';
  end if;

  return new;
end;
$$;

create trigger agreement_versions_protect_executed
  before update or delete on public.agreement_versions
  for each row execute function public.protect_executed_agreement_version();

comment on table public.agreement_versions is
  'Versioned agreement snapshots. Signed versions cannot be overwritten; create a new version instead.';

-- ---------------------------------------------------------------------------
-- funding_requests
-- ---------------------------------------------------------------------------

create table public.funding_requests (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  matter_id uuid not null,
  amount_requested_cents bigint not null check (amount_requested_cents > 0),
  date_requested date not null default (timezone('Australia/Melbourne', now()))::date,
  due_date date,
  description text,
  status text not null default 'draft' check (status in (
    'draft',
    'sent',
    'partially_received',
    'received',
    'cancelled'
  )),
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  unique (id, firm_id),
  constraint funding_requests_matter_same_firm
    foreign key (matter_id, firm_id) references public.matters (id, firm_id)
);

create index funding_requests_firm_id_status_idx on public.funding_requests (firm_id, status);
create index funding_requests_firm_id_matter_id_idx on public.funding_requests (firm_id, matter_id);

create or replace function public.protect_sent_funding_request_amount()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'draft' and new.amount_requested_cents is distinct from old.amount_requested_cents then
    raise exception 'Amount on a non-draft funding request cannot be changed';
  end if;
  return new;
end;
$$;

create trigger funding_requests_protect_amount
  before update on public.funding_requests
  for each row execute function public.protect_sent_funding_request_amount();

comment on table public.funding_requests is
  'Workflow record of funds asked of a client. Not a trust ledger.';

-- ---------------------------------------------------------------------------
-- funding_receipts
-- Historical receipts are insert-only. Do not silently modify them.
-- ---------------------------------------------------------------------------

create table public.funding_receipts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  matter_id uuid not null,
  funding_request_id uuid,
  amount_received_cents bigint not null check (amount_received_cents > 0),
  date_received date not null,
  recorded_by uuid not null references public.users (id),
  reference text,
  note text,
  destination_type text not null check (destination_type in ('trust', 'office', 'other')),
  created_at timestamptz not null default now(),
  constraint funding_receipts_matter_same_firm
    foreign key (matter_id, firm_id) references public.matters (id, firm_id),
  constraint funding_receipts_request_same_firm
    foreign key (funding_request_id, firm_id)
    references public.funding_requests (id, firm_id)
);

create index funding_receipts_firm_id_matter_id_idx on public.funding_receipts (firm_id, matter_id);
create index funding_receipts_request_id_idx on public.funding_receipts (funding_request_id);

create or replace function public.funding_receipt_matches_request()
returns trigger
language plpgsql
as $$
declare
  request_firm uuid;
  request_matter uuid;
begin
  if new.funding_request_id is null then
    return new;
  end if;

  select firm_id, matter_id
    into request_firm, request_matter
  from public.funding_requests
  where id = new.funding_request_id;

  if request_firm is null then
    raise exception 'Funding request not found';
  end if;

  if request_firm is distinct from new.firm_id
     or request_matter is distinct from new.matter_id then
    raise exception 'Funding receipt must belong to the same firm and matter as its request';
  end if;

  return new;
end;
$$;

create trigger funding_receipts_match_request
  before insert on public.funding_receipts
  for each row execute function public.funding_receipt_matches_request();

create trigger funding_receipts_forbid_update
  before update on public.funding_receipts
  for each row execute function public.forbid_mutation();

create trigger funding_receipts_forbid_delete
  before delete on public.funding_receipts
  for each row execute function public.forbid_mutation();

comment on table public.funding_receipts is
  'Workflow record of funds the firm has recorded as received. Destination type (trust/office/other) is informational only and does not replace statutory trust accounting.';

-- ---------------------------------------------------------------------------
-- audit_events
-- ---------------------------------------------------------------------------

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.firms (id) on delete cascade,
  actor_user_id uuid references public.users (id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_firm_id_created_at_idx
  on public.audit_events (firm_id, created_at desc);
create index audit_events_entity_idx
  on public.audit_events (firm_id, entity_type, entity_id);

create trigger audit_events_forbid_update
  before update on public.audit_events
  for each row execute function public.forbid_mutation();

create trigger audit_events_forbid_delete
  before delete on public.audit_events
  for each row execute function public.forbid_mutation();

-- ---------------------------------------------------------------------------
-- Tenancy bootstrap
-- ---------------------------------------------------------------------------

create or replace function public.create_firm(p_name text, p_practice_name text default null)
returns public.firms
language plpgsql
security definer
set search_path = public
as $$
declare
  new_firm public.firms;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if char_length(trim(p_name)) < 1 then
    raise exception 'Firm name is required';
  end if;

  insert into public.firms (name, practice_name)
  values (trim(p_name), nullif(trim(coalesce(p_practice_name, p_name)), ''))
  returning * into new_firm;

  insert into public.firm_memberships (firm_id, user_id, role)
  values (new_firm.id, auth.uid(), 'owner');

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
-- Row Level Security
-- Every business table is firm-scoped. Firm A cannot read Firm B.
-- ---------------------------------------------------------------------------

alter table public.firms enable row level security;
alter table public.users enable row level security;
alter table public.firm_memberships enable row level security;
alter table public.practitioners enable row level security;
alter table public.clients enable row level security;
alter table public.matters enable row level security;
alter table public.legal_templates enable row level security;
alter table public.costs_agreements enable row level security;
alter table public.agreement_versions enable row level security;
alter table public.funding_requests enable row level security;
alter table public.funding_receipts enable row level security;
alter table public.audit_events enable row level security;

create policy firms_select_member
  on public.firms for select
  to authenticated
  using (public.is_firm_member(id));

create policy firms_update_admin
  on public.firms for update
  to authenticated
  using (public.has_firm_role(id, array['owner', 'admin']::text[]))
  with check (public.has_firm_role(id, array['owner', 'admin']::text[]));

create policy users_select_self_or_firm
  on public.users for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.firm_memberships me
      join public.firm_memberships them
        on them.firm_id = me.firm_id
      where me.user_id = auth.uid()
        and them.user_id = users.id
    )
  );

create policy users_update_self
  on public.users for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy memberships_select
  on public.firm_memberships for select
  to authenticated
  using (user_id = auth.uid() or public.is_firm_member(firm_id));

create policy practitioners_select
  on public.practitioners for select
  to authenticated
  using (public.is_firm_member(firm_id));

create policy practitioners_insert
  on public.practitioners for insert
  to authenticated
  with check (public.has_firm_role(firm_id, array['owner', 'admin']::text[]));

create policy practitioners_update
  on public.practitioners for update
  to authenticated
  using (public.has_firm_role(firm_id, array['owner', 'admin']::text[]))
  with check (public.has_firm_role(firm_id, array['owner', 'admin']::text[]));

create policy clients_select
  on public.clients for select
  to authenticated
  using (public.is_firm_member(firm_id));

create policy clients_insert
  on public.clients for insert
  to authenticated
  with check (public.is_firm_member(firm_id));

create policy clients_update
  on public.clients for update
  to authenticated
  using (public.is_firm_member(firm_id))
  with check (public.is_firm_member(firm_id));

create policy matters_select
  on public.matters for select
  to authenticated
  using (public.is_firm_member(firm_id));

create policy matters_insert
  on public.matters for insert
  to authenticated
  with check (public.is_firm_member(firm_id));

create policy matters_update
  on public.matters for update
  to authenticated
  using (public.is_firm_member(firm_id))
  with check (public.is_firm_member(firm_id));

create policy legal_templates_select
  on public.legal_templates for select
  to authenticated
  using (public.is_firm_member(firm_id));

create policy legal_templates_write_admin
  on public.legal_templates for insert
  to authenticated
  with check (public.has_firm_role(firm_id, array['owner', 'admin']::text[]));

create policy legal_templates_update_admin
  on public.legal_templates for update
  to authenticated
  using (public.has_firm_role(firm_id, array['owner', 'admin']::text[]))
  with check (public.has_firm_role(firm_id, array['owner', 'admin']::text[]));

create policy costs_agreements_select
  on public.costs_agreements for select
  to authenticated
  using (public.is_firm_member(firm_id));

create policy costs_agreements_insert
  on public.costs_agreements for insert
  to authenticated
  with check (public.is_firm_member(firm_id));

create policy costs_agreements_update
  on public.costs_agreements for update
  to authenticated
  using (public.is_firm_member(firm_id))
  with check (public.is_firm_member(firm_id));

create policy agreement_versions_select
  on public.agreement_versions for select
  to authenticated
  using (public.is_firm_member(firm_id));

create policy agreement_versions_insert
  on public.agreement_versions for insert
  to authenticated
  with check (public.is_firm_member(firm_id));

-- Updates allowed only for unsigned versions; trigger enforces immutability.
create policy agreement_versions_update_unsigned
  on public.agreement_versions for update
  to authenticated
  using (public.is_firm_member(firm_id) and status <> 'signed' and executed_at is null)
  with check (public.is_firm_member(firm_id));

create policy funding_requests_select
  on public.funding_requests for select
  to authenticated
  using (public.is_firm_member(firm_id));

create policy funding_requests_insert
  on public.funding_requests for insert
  to authenticated
  with check (
    public.is_firm_member(firm_id)
    and created_by = auth.uid()
  );

create policy funding_requests_update
  on public.funding_requests for update
  to authenticated
  using (public.is_firm_member(firm_id))
  with check (public.is_firm_member(firm_id));

create policy funding_receipts_select
  on public.funding_receipts for select
  to authenticated
  using (public.is_firm_member(firm_id));

create policy funding_receipts_insert
  on public.funding_receipts for insert
  to authenticated
  with check (
    public.is_firm_member(firm_id)
    and recorded_by = auth.uid()
  );

create policy audit_events_select
  on public.audit_events for select
  to authenticated
  using (public.is_firm_member(firm_id));

create policy audit_events_insert
  on public.audit_events for insert
  to authenticated
  with check (
    public.is_firm_member(firm_id)
    and (actor_user_id is null or actor_user_id = auth.uid())
  );

revoke all on function public.create_firm(text, text) from public, anon;
grant execute on function public.create_firm(text, text) to authenticated;

revoke all on function public.is_firm_member(uuid) from public, anon;
grant execute on function public.is_firm_member(uuid) to authenticated;

revoke all on function public.has_firm_role(uuid, text[]) from public, anon;
grant execute on function public.has_firm_role(uuid, text[]) to authenticated;
