-- Atomic draft creation: client + matter + costs_agreement + agreement_pricing.
-- Firm membership is derived from auth.uid(); no service-role key.

create or replace function public.create_agreement_draft(p_agreement_type text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid;
  actor_firm_id uuid;
  new_client_id uuid;
  new_matter_id uuid;
  new_agreement_id uuid;
  draft_key text;
  template_key text;
  template_version text;
  pricing_type text;
begin
  actor_id := auth.uid();
  if actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_agreement_type is null or p_agreement_type not in ('short_form', 'full_staged') then
    raise exception 'Choose an agreement type.';
  end if;

  select firm_id
    into actor_firm_id
  from public.firm_memberships
  where user_id = actor_id
  order by created_at
  limit 1;

  if actor_firm_id is null or not public.is_firm_member(actor_firm_id) then
    raise exception 'Firm membership is required';
  end if;

  if p_agreement_type = 'short_form' then
    template_key := 'vic_short_form';
    template_version := '2026-09-under-legal-review';
    pricing_type := 'hourly';
  else
    template_key := 'vic_full_staged';
    template_version := '2026-09-under-legal-review';
    pricing_type := 'staged_fixed_fee';
  end if;

  draft_key := 'DRAFT-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.clients (
    firm_id, display_name, client_type, state
  )
  values (
    actor_firm_id, 'New client', 'individual', 'VIC'
  )
  returning id into new_client_id;

  insert into public.matters (
    firm_id,
    client_id,
    matter_number,
    matter_title,
    matter_description,
    responsible_practitioner_id,
    practice_area,
    jurisdiction,
    pricing_type,
    gst_treatment,
    status,
    agreed_or_estimated_cost_cents
  )
  values (
    actor_firm_id,
    new_client_id,
    draft_key,
    'New matter',
    null,
    null,
    null,
    'VIC',
    pricing_type,
    'gst_exclusive',
    'draft',
    0
  )
  returning id into new_matter_id;

  insert into public.costs_agreements (
    firm_id,
    matter_id,
    agreement_type,
    jurisdiction,
    template_key,
    template_version,
    status
  )
  values (
    actor_firm_id,
    new_matter_id,
    p_agreement_type,
    'VIC',
    template_key,
    template_version,
    'draft'
  )
  returning id into new_agreement_id;

  insert into public.agreement_pricing (
    costs_agreement_id,
    firm_id
  )
  values (
    new_agreement_id,
    actor_firm_id
  );

  return new_agreement_id;
end;
$$;

revoke all on function public.create_agreement_draft(text) from public, anon;
grant execute on function public.create_agreement_draft(text) to authenticated;

comment on function public.create_agreement_draft(text) is
  'Creates a placeholder client, matter, costs agreement and pricing row in one transaction for the caller''s firm.';
