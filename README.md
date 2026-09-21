# Lexflow

Australian legal-tech SaaS for taking a law firm from instructions to a signed and funded costs agreement.

Lexflow is not practice-management software. It does not provide calendars, document management, time recording, invoicing, trust accounting, or CRM.

Core workflow:

NEW CLIENT → CREATE MATTER → CREATE COSTS AGREEMENT → SEND AGREEMENT → CLIENT SIGNS / ACCEPTS → REQUEST FUNDS → RECORD FUNDS RECEIVED → TRACK OUTSTANDING FUNDING → UPDATE COSTS DISCLOSURE WHEN REQUIRED

## Stack

- Next.js App Router (TypeScript)
- Tailwind CSS
- PostgreSQL with Supabase Auth and Row Level Security
- Vercel-compatible deployment

Money is stored and calculated as integer cents. `$5,000.00` is `500000` cents.

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/aretmur/lexflow.git
cd lexflow
npm install
```

### 2. Create a Supabase project

In the [Supabase dashboard](https://supabase.com/dashboard):

1. Create a project.
2. Copy the project URL and publishable key (legacy name: anon key) from **Settings → API**.
3. Keep the service role key server-only. It is required for Dropbox Sign webhook processing and must never be prefixed with `NEXT_PUBLIC_`.

### 3. Environment variables

```bash
cp .env.example .env.local
```

Set:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (RLS-enforced). `NEXT_PUBLIC_SUPABASE_ANON_KEY` still works |
| `NEXT_PUBLIC_SITE_URL` | App origin for auth redirects (`http://localhost:3000` locally) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Webhook writes and signed-PDF ingest. Never `NEXT_PUBLIC_` |
| `DROPBOX_SIGN_API_KEY` | Server-only Dropbox Sign API key |
| `DROPBOX_SIGN_CLIENT_ID` | Server-only Dropbox Sign app client id |
| `DROPBOX_SIGN_TEST_MODE` | Set `true` only for test signature requests. Production must not set this |
| `SIGNING_REDIRECT_URL` | Optional. Defaults to `https://www.lexflow.com.au/signing-complete` |

### 4. Run the database migrations

Run these SQL files in order against the Supabase project (SQL editor or `supabase db push`):

1. `supabase/migrations/20260918120000_init_lexflow.sql`
2. `supabase/migrations/20260918140000_agreement_workflow.sql`
3. `supabase/migrations/20260918150000_generated_agreement_packs.sql`
4. `supabase/migrations/20260921100000_create_agreement_draft.sql`
5. `supabase/migrations/20260921120000_signature_requests.sql`

The first migration creates firm-scoped tables, integer-cent money columns, row-level security, and `create_firm`. The second adds agreement types, stages, pricing, snapshots, payment details, and the required-attachment store. The third adds immutable generated agreement packs and the private `generated-agreements` storage bucket. The fourth adds `create_agreement_draft`, which creates a placeholder client, matter, agreement and pricing row in one transaction. The fifth adds signature requests, webhook event idempotency, immutable signed documents, and the private `signed-agreements` storage bucket.

### 5. Auth settings

In Supabase **Authentication**:

- Enable Email provider.
- Add `http://localhost:3000/auth/callback` to redirect URLs.
- For production, add `https://<your-domain>/auth/callback`.

### 6. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, then create a firm at `/settings/firm`.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deploy on Vercel

1. Import the GitHub repository into Vercel.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DROPBOX_SIGN_API_KEY`, and `DROPBOX_SIGN_CLIENT_ID` in the Vercel project environment.
3. `NEXT_PUBLIC_SITE_URL` must be the production origin, for example `https://www.lexflow.com.au`.
4. Leave `DROPBOX_SIGN_TEST_MODE` unset in production.
5. Add the production `/auth/callback` URL in Supabase Auth redirect URLs.
6. In Dropbox Sign, point the app callback URL to `https://www.lexflow.com.au/api/webhooks/dropbox-sign`.
7. Deploy.

The Next.js app uses the App Router and `proxy.ts` for session refresh. No extra Vercel configuration is required.

## Trust accounting boundary

Lexflow may record that funds were received into trust as workflow information only. It does not maintain statutory trust ledgers, perform reconciliations, or replace compliant trust accounting software.

Displayed in the product:

> Lexflow funding records are workflow records only and do not replace the law practice's statutory trust accounting records.

## Legal templates

Templates are deterministic and versioned.
