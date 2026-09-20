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
3. Disable public service-role use in the app. The service role key must not be added to this Next.js project.

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

### 4. Run the database migrations

Run these SQL files in order against the Supabase project (SQL editor or `supabase db push`):

1. `supabase/migrations/20260918120000_init_lexflow.sql`
2. `supabase/migrations/20260918140000_agreement_workflow.sql`
3. `supabase/migrations/20260918150000_generated_agreement_packs.sql`

The first migration creates firm-scoped tables, integer-cent money columns, row-level security, and `create_firm`. The second adds agreement types, stages, pricing, snapshots, payment details, and the required-attachment store. The third adds immutable generated agreement packs and the private `generated-agreements` storage bucket.

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
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL` in the Vercel project environment.
3. `NEXT_PUBLIC_SITE_URL` must be the production origin, for example `https://lexflow.vercel.app`.
4. Add the production `/auth/callback` URL in Supabase Auth redirect URLs.
5. Deploy.

The Next.js app uses the App Router and `proxy.ts` for session refresh. No extra Vercel configuration is required.

## Trust accounting boundary

Lexflow may record that funds were received into trust as workflow information only. It does not maintain statutory trust ledgers, perform reconciliations, or replace compliant trust accounting software.

Displayed in the product:

> Lexflow funding records are workflow records only and do not replace the law practice's statutory trust accounting records.

## Legal templates

Templates are deterministic and versioned. Wording in this foundation is marked **UNDER LEGAL REVIEW**. Lexflow does not treat stored templates as approved Victorian (or other Australian) legal content.
