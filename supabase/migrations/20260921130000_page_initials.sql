-- Per-page client initials on the final merged costs agreement pack.
-- Fields are placed by the signing provider at send time; the unsigned pack is unchanged.

alter table public.firms
  add column if not exists require_page_initials boolean not null default true;

comment on column public.firms.require_page_initials is
  'Default for new signature requests: require the client to initial every page of the final pack.';

alter table public.signature_requests
  add column if not exists require_page_initials boolean not null default true,
  add column if not exists initials_field_count integer not null default 0
    check (initials_field_count >= 0),
  add column if not exists page_count integer not null default 0
    check (page_count >= 0);

comment on column public.signature_requests.require_page_initials is
  'Whether this request required a client initials field on every page.';

comment on column public.signature_requests.initials_field_count is
  'Number of required initials fields sent to the signing provider.';

comment on column public.signature_requests.page_count is
  'Page count of the final merged pack at send time.';
