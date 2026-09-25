alter table public.firms
  alter column require_page_initials set default false;

alter table public.signature_requests
  alter column require_page_initials set default false;
