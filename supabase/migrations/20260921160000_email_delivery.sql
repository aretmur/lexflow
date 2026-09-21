-- Firm-level signing email identity and signature-request delivery metadata.
-- Generated packs and signed documents remain immutable and are not updated.

alter table public.firms
  add column if not exists signing_sender_name text,
  add column if not exists signing_sender_email text,
  add column if not exists signing_reply_to_email text;

comment on column public.firms.signing_sender_name is
  'Display name used in signing emails. The technical From address remains EMAIL_FROM.';

comment on column public.firms.signing_sender_email is
  'Firm signing contact email shown in settings. Does not replace the authorised EMAIL_FROM sender.';

comment on column public.firms.signing_reply_to_email is
  'Reply-To address for signing emails when set.';

alter table public.signature_requests
  add column if not exists email_provider text,
  add column if not exists email_message_id text,
  add column if not exists email_sent_at timestamptz;

comment on column public.signature_requests.email_provider is
  'Email provider that accepted the signing-link message, for example resend. Acceptance is not proof of inbox delivery.';

comment on column public.signature_requests.email_message_id is
  'Provider message id for the last accepted signing email.';

comment on column public.signature_requests.email_sent_at is
  'When the email provider accepted the signing-link message.';
