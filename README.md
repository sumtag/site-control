# Site Control

Multi-user construction document-control app — Documents, Drawings (revisions
+ markup), RFIs, Submittals, Defect List, Correspondence, and a dashboard.
Rebuilt from a single-file HTML prototype into a real Next.js app with a
Postgres database, Entra ID auth, and (in later phases) Microsoft Graph email
and drawing transmittals.

See the phased build plan in project chat history for what's implemented so
far. This README covers day-to-day dev setup.

## Stack

- **Next.js 16** (App Router, TypeScript) — see `AGENTS.md` / `node_modules/next/dist/docs` before assuming anything about routing conventions; this version has real breaking changes from older Next.js.
- **Prisma 7** ORM + PostgreSQL, with a driver adapter (`@prisma/adapter-pg`) — Prisma 7 requires an explicit adapter, it no longer connects from `DATABASE_URL` alone.
- **Auth.js (next-auth v5)** — Microsoft Entra ID (Azure AD) as the primary sign-in provider, covering both Spiire staff and Entra B2B guest invites (contractors/clients invited into the tenant). Magic-link fallback for ad-hoc external users lands in a later phase.

## Local development

```bash
npm install
npx prisma dev -d          # starts a local Postgres instance (only needed once per machine boot)
npx prisma migrate dev      # applies migrations
npx prisma db seed          # seeds one demo project + 3 demo users (one per role)
npm run dev
```

Then open http://localhost:3000. Until Entra is configured (see below), the
login page shows three "Continue as demo &lt;role&gt;" buttons — a dev-only sign-in
path (`src/auth.ts`, gated on `NODE_ENV !== "production"`) that lets you
click through the app as a Superintendent, Contractor, or Client without a
real Microsoft account. It never activates in production.

`npx prisma dev` runs a local, disposable Postgres instance for development
only — it is not what production uses. Production points `DATABASE_URL` at
a real Azure Postgres Flexible Server (see Deployment below).

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Your Postgres connection string (local dev: printed by `npx prisma dev`) |
| `AUTH_SECRET` | Random value — `openssl rand -base64 32` |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Entra app registration → Application (client) ID |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Entra app registration → client secret value |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | `https://login.microsoftonline.com/<tenant-id>/v2.0/` |

If the Entra variables are blank, Microsoft sign-in is simply disabled (the
button is greyed out) rather than the app failing to start — useful while
the Azure-side setup below hasn't happened yet.

## Azure / Entra ID setup (manual — do this in the Azure portal)

Needed before real sign-in works. None of this can be done from code.

1. **Register the app** — Azure Portal → Microsoft Entra ID → App registrations → New registration.
   - Name: `Site Control` (or similar).
   - Supported account types: **Accounts in this organizational directory only** (single tenant) — this is what restricts sign-in to Spiire staff plus users you've explicitly invited as guests, rather than any Microsoft account.
   - Redirect URI: platform **Web**, value `http://localhost:3000/api/auth/callback/microsoft-entra-id` for local dev. Add the production URL's equivalent later (e.g. `https://<your-app-service>.azurewebsites.net/api/auth/callback/microsoft-entra-id`).
2. **Note the IDs** — on the app's Overview page, copy:
   - Application (client) ID → `AUTH_MICROSOFT_ENTRA_ID_ID`
   - Directory (tenant) ID → build the issuer URL: `https://login.microsoftonline.com/<tenant-id>/v2.0/` → `AUTH_MICROSOFT_ENTRA_ID_ISSUER`
3. **Create a client secret** — Certificates & secrets → New client secret. Copy the *value* (not the secret ID) immediately — it's only shown once → `AUTH_MICROSOFT_ENTRA_ID_SECRET`.
4. **API permissions** — API permissions → Add a permission → Microsoft Graph:
   - Delegated: `User.Read` (sign-in/profile — usually added by default).
   - Once Phase 3 (email notifications) lands, you'll also add an **Application** permission `Mail.Send` here and click **Grant admin consent** — flagged again when we get there, not needed yet.
5. **Enable B2B guest invites** (for contractor/client external users) — Microsoft Entra ID → External Identities → External collaboration settings. Confirm guest invite settings allow the roles who'll be inviting contractors (you, as Superintendent) to send invites. Guests you invite this way sign in through the same Entra provider above — no separate config needed.

Nothing else in Azure is required for Phase 1. Blob Storage and the Graph
`Mail.Send` app permission come later, flagged again when those phases start.

## Database

Schema lives in `prisma/schema.prisma`. After changing it:

```bash
npx prisma migrate dev --name <description>
```

`prisma/seed.ts` is idempotent (upserts) — safe to re-run.

## Project structure

```
src/
  app/
    login/                       sign-in page
    projects/                    project picker (lists the caller's memberships)
    projects/[projectId]/        per-project shell: sidebar nav + the 6 modules
  auth.ts                        Auth.js config (providers, session, callbacks)
  proxy.ts                       optimistic signed-out redirect (NOT the permission boundary)
  lib/authz.ts                   the real server-side permission boundary — every
                                  module route/action re-checks the caller's
                                  per-project role here, never trusts the UI
  lib/prisma.ts                  Prisma client singleton
  components/AppShell.tsx        sidebar/topbar chrome, ported from the prototype's design
```

Permissions are always enforced server-side against the caller's
`ProjectMember` row for that project — a user can be Contractor on one job
and have no access at all to another, and role checks happen per-request in
`lib/authz.ts`, not baked into the session token.
