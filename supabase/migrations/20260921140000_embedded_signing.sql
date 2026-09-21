-- On-the-spot embedded signing sessions (QR / same-device) plus email fallback.
-- Tokens are stored hashed. Temporary Dropbox Sign URLs are never persisted.

alter table public.signature_requests
  add column if not exists signing_mode text not null default 'email'
    check (signing_mode in ('embedded_same_device', 'embedded_qr', 'email')),
  add column if not exists provider_signature_id text,
  add column if not exists signing_token_hash text,
  add column if not exists signing_token_expires_at timestamptz;

create unique index if not exists signature_requests_signing_token_hash_uidx
  on public.signature_requests (signing_token_hash)
  where signing_token_hash is not null;

comment on column public.signature_requests.signing_mode is
  'How the client was asked to sign: in-person QR, same device, or emailed link.';

comment on column public.signature_requests.provider_signature_id is
  'Dropbox Sign signature_id for the client signer. Used to mint a temporary sign_url. Not the signature_request_id.';

comment on column public.signature_requests.signing_token_hash is
  'SHA-256 hash of the single-use Lexflow signing-session token. Raw tokens are never stored.';

comment on column public.signature_requests.signing_token_expires_at is
  'When the current Lexflow signing-session token becomes unusable.';
