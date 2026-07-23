# Soggy Ink Games — Investor Portal

This is the standalone investor portal for Soggy Ink Games. It is built with Astro, TypeScript, Tailwind CSS v4, and Supabase.

It is designed to be deployed to Netlify alongside your existing Gatsby site, acting as a secure, gated application under the `/investors` path.

## Core Features

- **Magic Link Authentication**: Passwordless login via Resend and Supabase Auth.
- **Role-Based Access Control (RBAC)**: Two tiers of access (`prospective` and `invested`), enforced at the database (RLS) and application (Middleware) levels.
- **Secure Document Delivery**: Documents are stored in a private Supabase bucket and served via short-lived signed URLs.
- **PDF Watermarking**: All PDFs are dynamically watermarked with the investor's email address and the current date before being served.
- **Engagement Tracking**: A founder dashboard (`/investors/admin`) tracks logins, page views, and document opens.
- **Brand Consistency**: Uses the Soggy Ink Games design tokens (Teal, Purple, Pink, Yellow, Syncopate font).

## 1. Local Development Setup

### Prerequisites
- Node.js (v22 recommended)
- pnpm
- A Supabase project
- A Resend account

### Installation

1. Clone the repository and install dependencies:
   ```bash
   pnpm install
   ```

2. Copy the environment variables template:
   ```bash
   cp .env.example .env.local
   ```

3. Fill in the `.env.local` values:
   - `SUPABASE_URL`: From your Supabase project settings.
   - `SUPABASE_ANON_KEY`: From your Supabase project settings.
   - `SUPABASE_SERVICE_ROLE_KEY`: From your Supabase project settings.
   - `RESEND_API_KEY`: From your Resend dashboard.
   - `RESEND_FROM_EMAIL`: E.g., `investors@soggyinkgames.com` (Must be a verified domain in Resend).
   - `PORTAL_BASE_URL`: `http://localhost:4321` for local dev.
   - `ADMIN_EMAIL`: Your founder email address.
   - `FOUNDER_NOTIFICATION_EMAIL`: Your founder email address.
   - `INVITE_SECRET`: Generate a strong random string.

### Database Setup

1. Go to the SQL Editor in your Supabase Dashboard.
2. Open `supabase/migrations/001_initial_schema.sql` from this repository.
3. Paste the contents into the SQL Editor and run it. This will create all tables, RLS policies, and the private storage bucket.

### Running the Dev Server

```bash
pnpm dev
```
The portal will be available at `http://localhost:4321/investors/`.

## 2. Deployment Guide (Netlify)

This portal is designed to be deployed as a separate Netlify site from your main Gatsby website.

1. Push this repository to GitHub.
2. In Netlify, click **Add new site** → **Import an existing project**.
3. Select the GitHub repository.
4. Netlify will automatically detect Astro. Ensure the build command is `pnpm build` and the publish directory is `dist`.
5. Under **Environment variables**, add all the variables from your `.env.local` file.
   - *Crucial:* Set `PORTAL_BASE_URL` to `https://www.soggyinkgames.com`.
6. Click **Deploy site**.

## 3. The Cutover Guide (Connecting to the Main Site)

To serve this portal under `soggyinkgames.com/investors` while keeping your main site on Gatsby, you will use Netlify's Proxy Rewrites.

1. Deploy the new Astro portal site on Netlify (e.g., it gets a URL like `https://soggyink-portal.netlify.app`).
2. In your **main Gatsby site's** `netlify.toml` file, add the following proxy rewrite rule at the bottom:

```toml
# Main Site netlify.toml

[[redirects]]
  from = "/investors/*"
  to = "https://soggyink-portal.netlify.app/investors/:splat"
  status = 200
  force = true
```

*(Replace `soggyink-portal.netlify.app` with the actual Netlify URL of your new portal).*

3. Deploy the main Gatsby site.
4. Now, any traffic to `soggyinkgames.com/investors/*` will be transparently proxied to the Astro application.

## 4. Managing Content & Investors

Because this is a bespoke application, content management is handled directly via Supabase Studio (the Supabase dashboard).

### Approving Investors
1. Go to Supabase → Table Editor → `investors`.
2. When a new request comes in, it will appear here with `approved = false`.
3. To grant access, edit the row and set `approved = true`. The investor can now log in via magic link.

### Upgrading Investors
1. In the `investors` table, change an investor's `role` from `prospective` to `invested`.
2. They will immediately gain access to the gated legal and results pages.

### Uploading Documents
1. Go to Supabase → Storage → `investor-documents`.
2. Upload your PDF.
3. Go to Table Editor → `documents`.
4. Add a new row:
   - `title`: "Q3 Pitch Deck"
   - `file_path`: The exact filename you just uploaded (e.g., `q3-deck.pdf`).
   - `category`: `deck`, `research`, `team`, or `legal`.
   - `access_level`: `prospective` or `invested`.

### Adding Milestones
1. Go to Table Editor → `milestones`.
2. Add rows for your company timeline.
3. Set `visibility` to `prospective` (everyone sees it) or `invested` (only invested investors see it).

### Adding Team Members
1. Go to Table Editor → `team_members`.
2. Add rows for your team. The `order_index` controls the display order.

## 5. Security Notes

- **Never** expose the `SUPABASE_SERVICE_ROLE_KEY` to the browser. It is used strictly in server-side API routes (like `/api/document/[id].ts`) to bypass RLS for tasks like fetching files to watermark.
- The `X-Robots-Tag: noindex, nofollow` header is injected globally via `BaseLayout.astro` and `netlify.toml` to ensure the portal is never indexed by search engines.
- PDF watermarking happens on the fly in memory; the watermarked file is never saved back to the database.
