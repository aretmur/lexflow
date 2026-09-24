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
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Webhook writes, public signing-session lookup, and signed-PDF ingest. Never `NEXT_PUBLIC_` |
| `SIGNING_PROVIDER` | Optional. `native_lexflow` (default) or `dropbox_sign` |
| `SIGNING_TEST_MODE` | Set `true` only for native Lexflow test signature sessions. Production must not set this |
| `DROPBOX_SIGN_API_KEY` | Server-only Dropbox Sign API key. Required only if a firm uses Dropbox Sign |
| `DROPBOX_SIGN_CLIENT_ID` | Server-only Dropbox Sign app client id. Required only if a firm uses Dropbox Sign |
| `DROPBOX_SIGN_TEST_MODE` | Set `true` only for Dropbox Sign test signature requests. Production must not set this |
| `SIGNING_REDIRECT_URL` | Optional. Defaults to `https://www.lexflow.com.au/signing-complete` |
| `EMAIL_PROVIDER` | `microsoft_graph` (Octagon production), `resend` (optional), or `console` (local/test only). Never `NEXT_PUBLIC_` |
| `MICROSOFT_TENANT_ID` | Server-only Microsoft Entra directory (tenant) ID. Required when `EMAIL_PROVIDER=microsoft_graph` |
| `MICROSOFT_CLIENT_ID` | Server-only Entra application (client) ID. Required when `EMAIL_PROVIDER=microsoft_graph` |
| `MICROSOFT_CLIENT_SECRET` | Server-only Entra client secret value. Required when `EMAIL_PROVIDER=microsoft_graph` |
| `MICROSOFT_GRAPH_SENDER` | Authorised sending mailbox, for example `intake@octagonlegal.au`. Required when `EMAIL_PROVIDER=microsoft_graph` |
| `RESEND_API_KEY` | Server-only. Required only when `EMAIL_PROVIDER=resend`. Never `NEXT_PUBLIC_` |
| `EMAIL_FROM` | Required only when `EMAIL_PROVIDER=resend` |
| `EMAIL_REPLY_TO` | Optional Resend Reply-To |

### 4. Run the database migrations

Run these SQL files in order against the Supabase project (SQL editor or `supabase db push`):

1. `supabase/migrations/20260918120000_init_lexflow.sql`
2. `supabase/migrations/20260918140000_agreement_workflow.sql`
3. `supabase/migrations/20260918150000_generated_agreement_packs.sql`
4. `supabase/migrations/20260921100000_create_agreement_draft.sql`
5. `supabase/migrations/20260921120000_signature_requests.sql`
6. `supabase/migrations/20260921130000_page_initials.sql`
7. `supabase/migrations/20260921140000_embedded_signing.sql`
8. `supabase/migrations/20260921150000_native_signing.sql`
9. `supabase/migrations/20260921160000_email_delivery.sql`
10. `supabase/migrations/20260924120000_signed_document_deliveries.sql`
11. `supabase/migrations/20260924130000_discard_costs_agreements.sql`

The first migration creates firm-scoped tables, integer-cent money columns, row-level security, and `create_firm`. The second adds agreement types, stages, pricing, snapshots, payment details, and the required-attachment store. The third adds immutable generated agreement packs and the private `generated-agreements` storage bucket. The fourth adds `create_agreement_draft`, which creates a placeholder client, matter, agreement and pricing row in one transaction. The fifth adds signature requests, webhook event idempotency, immutable signed documents, and the private `signed-agreements` storage bucket. The sixth adds the firm default and per-request audit fields for requiring client initials on every page of the final pack. The seventh adds embedded signing modes, the provider signer id, and hashed short-lived signing-session tokens. The eighth adds native Lexflow signing as the default provider, optional email OTP for QR sessions, pack page-split columns, and an immutable signing audit table. Dropbox Sign remains selectable. The ninth adds firm signing-email identity and signature-request delivery metadata. The tenth records email delivery of the stored signed PDF to the client and firm. The eleventh adds a discard timestamp so incorrect unsigned agreements can be removed from the list without deleting signed records. Generated packs and signed documents remain immutable.

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
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. For the Octagon Legal pilot, set `EMAIL_PROVIDER=microsoft_graph`, `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, and `MICROSOFT_GRAPH_SENDER=intake@octagonlegal.au`. Do not set Resend variables. Never prefix Microsoft secrets with `NEXT_PUBLIC_`.
4. `NEXT_PUBLIC_SITE_URL` must be the production origin, for example `https://www.lexflow.com.au`.
5. Leave `SIGNING_TEST_MODE`, `DROPBOX_SIGN_TEST_MODE`, and `EMAIL_PROVIDER=console` unset in production.
6. Add the production `/auth/callback` URL in Supabase Auth redirect URLs.
7. Native Lexflow signing is the default. Clients open `/sign/{token}` with no Lexflow account. Email signing sends a one-time code before the pack can be reviewed.
8. Complete the Microsoft 365 email setup below, including mailbox scoping, then redeploy.
9. If using Dropbox Sign, create an API app, set `DROPBOX_SIGN_API_KEY` and `DROPBOX_SIGN_CLIENT_ID`, add the production domain for embedded signing, and point the app callback URL to `https://www.lexflow.com.au/api/webhooks/dropbox-sign`.
10. Deploy.

Native signing stamps the executed PDF in Lexflow and leaves the generated pack unchanged. Dropbox Sign remains available as a firm setting. Embedded Dropbox Sign Now uses `/signature_request/create_embedded` and mints a temporary `/embedded/sign_url/{signature_id}` only when the client opens `/sign/{token}`. Do not treat that URL as a permanent credential.

Production never logs signing emails to the console. If `EMAIL_PROVIDER=microsoft_graph` and a Microsoft variable is missing, email delivery fails with `Microsoft 365 email delivery is not configured.` QR and same-device signing do not require Microsoft Graph or Resend unless the firm turns on email OTP for those modes.

The Next.js app uses the App Router and `proxy.ts` for session refresh. No extra Vercel configuration is required.

## Microsoft 365 email setup

Octagon Legal production sending uses Microsoft Graph application-only authentication against the existing mailbox `intake@octagonlegal.au`. Lexflow does not use interactive Microsoft sign-in, username/password SMTP, or `/me/sendMail`.

This Microsoft tenant configuration is for the Octagon pilot. It does not provision email for every future Lexflow customer. Other firms may later use Lexflow-managed transactional email, their own Microsoft 365 tenant, or another approved provider.

### Lexflow application safeguards versus Microsoft tenant permissions

Lexflow:

- Sends only from `MICROSOFT_GRAPH_SENDER` using `POST /v1.0/users/{sender}/sendMail`.
- Refuses a firm `signing_sender_email` that does not match that mailbox.
- Keeps tenant id, client id, client secret, and access tokens on the server.
- Treats HTTP 202 as provider acceptance, not inbox delivery.
- Does not read mailboxes (`Mail.Read` / `Mail.ReadWrite` are not used).

Lexflow does **not** restrict what the Entra application can do inside Microsoft 365. `Mail.Send` as an application permission can otherwise allow sending as other users in the tenant. The Microsoft 365 administrator must scope the app to `intake@octagonlegal.au` in Exchange Online.

### 1. Create the Entra app registration

1. Open the [Microsoft Entra admin centre](https://entra.microsoft.com/).
2. Go to **Identity → Applications → App registrations → New registration**.
3. Name it `Lexflow Email Delivery`.
4. Register a single-tenant app for the Octagon directory.
5. Record **Directory (tenant) ID** and **Application (client) ID**.
6. Open **Certificates & secrets → New client secret**. Copy the secret **Value** immediately. Store it only in Vercel / `.env.local`.
7. Open **API permissions → Add a permission → Microsoft Graph → Application permissions**.
8. Add **only** `Mail.Send`.
9. Click **Grant admin consent** for the Octagon tenant.

Do not grant `Mail.Read`, `Mail.ReadWrite`, `Directory.Read.All`, or `User.Read.All`.

### 2. Restrict the app to the intake mailbox (Exchange Online)

Use Microsoft's current **RBAC for Applications in Exchange Online** (this replaces legacy Application Access Policies). Connect to Exchange Online PowerShell as an administrator with the Exchange Administrator / Organization Management role.

The Enterprise Application **Object ID** is not the Object ID shown on the App registrations page. Use the Object ID from **Enterprise applications** for this app (Microsoft also calls this the service principal id).

```powershell
Connect-ExchangeOnline

New-ServicePrincipal -AppId "<MICROSOFT_CLIENT_ID>" -ObjectId "<ENTERPRISE_APP_OBJECT_ID>" -DisplayName "Lexflow Email Delivery"

New-ManagementScope -Name "Lexflow Intake Mailbox" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'intake@octagonlegal.au'"

New-ManagementRoleAssignment -App "<MICROSOFT_CLIENT_ID>" -Role "Application Mail.Send" -CustomResourceScope "Lexflow Intake Mailbox"

Test-ServicePrincipalAuthorization -Identity "<MICROSOFT_CLIENT_ID>" -Resource "intake@octagonlegal.au"
```

`Test-ServicePrincipalAuthorization` should show `Application Mail.Send` in scope for `intake@octagonlegal.au`. Test a different mailbox as `-Resource` and confirm it is not in scope.

Microsoft Entra application permissions and Exchange RBAC assignments are separate, additive grants. An unscoped tenant-wide Entra `Mail.Send` consent can still allow sending outside the Exchange scope. Follow Microsoft's current Application RBAC documentation after assigning the scoped role, and verify with `Test-ServicePrincipalAuthorization`. Role assignment changes can take up to two hours to apply to Graph calls.

Intended Octagon mailbox: `intake@octagonlegal.au`.

### 3. Vercel environment

Set:

```bash
EMAIL_PROVIDER=microsoft_graph
MICROSOFT_TENANT_ID=<Directory tenant ID>
MICROSOFT_CLIENT_ID=<Application client ID>
MICROSOFT_CLIENT_SECRET=<client secret value>
MICROSOFT_GRAPH_SENDER=intake@octagonlegal.au
```

Keep `SUPABASE_SERVICE_ROLE_KEY` set. Do not set `RESEND_API_KEY` or `EMAIL_FROM` for the Octagon Graph configuration. Redeploy after saving the variables.

In Lexflow **Settings → Signing → SIGNING EMAIL**, save:

- Sender name: `Octagon Legal`
- Sender email: `intake@octagonlegal.au`
- Reply-to email: `intake@octagonlegal.au`

If a firm's sender email does not match `MICROSOFT_GRAPH_SENDER`, Lexflow will not send through Octagon's mailbox.

### Optional Resend provider

Resend remains in the codebase. Select it only with `EMAIL_PROVIDER=resend` plus `RESEND_API_KEY` and `EMAIL_FROM`. The Octagon pilot does not require a Resend account.

## Trust accounting boundary

Lexflow may record that funds were received into trust as workflow information only. It does not maintain statutory trust ledgers, perform reconciliations, or replace compliant trust accounting software.

Displayed in the product:

> Lexflow funding records are workflow records only and do not replace the law practice's statutory trust accounting records.

## Legal templates

Templates are deterministic and versioned.
