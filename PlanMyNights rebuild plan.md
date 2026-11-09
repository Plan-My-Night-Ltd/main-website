# PlanMyNights: rebuild from scratch

## Context

The Lovable export (~15,500 lines) is not worth keeping as a base. In summary:

- **The core feature doesn't work.** Recommendations are switched off (`USE_FILTER = false`). Hours, travel times and VIP prices are faked.
- **About a third of the code is dead weight.** That includes `londonVenues.ts` (3,272 lines), the deprecated Google function, the disabled cache, and scoring code that barely runs.
- **The UX is being replaced anyway.** UI is most of the frontend, so after a redesign almost no frontend code would survive.
- **The foundations are wrong for a tourist product.** It's a Vite single-page app, so Google can't index venue or area pages, and Google is where tourists will find you. The migrations can't rebuild the database. There's no git history, and auth and AI depend on Lovable.
- **What's actually reusable is generic boilerplate.** The shadcn/ui components can be regenerated in one command.

Fixing it would take longer than rebuilding, and you'd still have the wrong architecture at the end. **Decision: rebuild.** Keep a short list of reference material (below) and copy none of the app logic.

Decisions made: **every Foursquare venue in the 30 areas, imported monthly, with hand-checked details layered on top** (changed 9 Nov 2026 from "curated list first", so recommendations aren't limited to a short list) and **v1 = night plan + booking enquiry (no payments)**.

## What to salvage (as reference only, copied by hand)

| Item | Where | Use |
|---|---|---|
| London area coordinates (30 neighbourhoods) | `supabase/functions/discover-venues-foursquare/index.ts:28-62` | Seed the `areas` table |
| Foursquare's new API host (`places-api.foursquare.com`) and field notes | same file, top section | Foursquare fill function |
| Questions asked in the preference form | `src/components/PreferenceForm.tsx` | Starting list for the new questionnaire (the questions only, not the UI) |
| Candidate venues | `src/data/londonVenues.ts` | Shortlist for the curated seed, each one checked by hand before going in |
| Privacy / Terms copy | `src/pages/PrivacyPolicy.tsx`, `TermsOfService.tsx` | Draft to update, since there are no payments or accounts in v1 |

Everything else is discarded. **Rotate every API key.** The old keys live in Lovable's account and in the exported `.env`.

## New stack

- **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui** on your own Vercel. Venue and area pages are server-rendered, so they're indexable.
- **Supabase (your account)** for Postgres and storage. **No user accounts in v1.** A plan is shared by link, which is easier for tourists.
- **Claude (Haiku 5.5)**, server-side only, to rank shortlisted venues and write a one-line "why this fits you" for each.
- **Foursquare Places**, called only by the monthly import (`npm run import:venues`), never during a search.
- **Resend** for enquiry emails.
- **GitHub repo from day one.** Every database change is a migration that can rebuild the DB from empty.

## Phases

### 0. Setup
New GitHub repo, Vercel project, Supabase project, fresh keys in Vercel env vars. Create a new folder for the app and keep the old export alongside it, read-only.

### 1. Design and differentiation
- Study nightkey.co.uk for layout, type and mood: dark, premium, editorial.
- Differentiate for tourists. The site is open, not members-only, with copy like "Your London night, planned in a minute". Each venue shows the practical details a visitor needs: nearest Tube, dress code, door policy, price per head, how late it's open, and whether to book.
- Wireframe 4 screens, mobile-first: **Landing → Questionnaire → Your Night (itinerary) → Venue page**.
- Define design tokens (colours, type, spacing) before building.

### 2. Data model and curated content
Tables:
- `areas`: name, slug, lat/lng, blurb.
- `venues`: slug, name, type (restaurant / bar / club), area, address, lat/lng, price band, vibe tags, music, dress code, door policy, real opening hours per weekday, booking URL, photos, `source` (`curated` | `foursquare`), `published`.
- Imported venues also carry `rating`, `fsq_categories`, `fsq_tastes`, inferred `auto_vibe_tags` / `auto_music_tags`, `verified` and `last_seen_at`. The import never overwrites hand-set fields.
- `enquiries`: plan snapshot, name, email, phone, date, party size, status.

Venues arrive through the import. Checking a venue by hand (dress code, door policy, music, description, then `verified = true`) happens in the Supabase table editor at first; a simple `/admin` page comes later. Start checking the most-recommended venues in the busiest tourist areas (Soho, Mayfair, Covent Garden, Shoreditch, South Bank).

### 3. Matching engine (server-side, `/api/plan`)
1. **Hard filters in SQL**: open on the chosen night at the chosen time, area or radius, price band, night type (dinner, drinks, clubbing, or a combination).
2. **Score** what's left on structured tags (vibe, music, group type). These are tag fields, not keyword matching on free text.
3. **Shortlist in SQL** (`plan_candidates`): the best ~100 per stop out of every venue stored, so searches cost nothing in API calls. Unchecked venues are labelled as details from Foursquare.
4. **Claude reranks the top ~15** for each slot and returns the pick plus a reason, as strict JSON. If Claude fails, the step falls back to the scored order.
5. **Build the itinerary**: dinner → bar → club, with real walking or Tube times from coordinates.

Rate-limit by IP (e.g. Upstash or Vercel KV) so nobody can drain your API credits.

### 4. Frontend
- Questionnaire: 5–7 questions, one per screen, progress bar, under 60 seconds.
- "Your Night" page: a timeline of 2–3 stops. Each stop can be swapped for alternatives. The page has a shareable URL (`/plan/[id]`).
- Venue page `/venues/[slug]`, server-rendered.
- Enquiry form: the enquiry is **saved to the database first**, then emailed to you and to the guest, so an email failure never loses a booking.

### 5. SEO pages
`/areas/[slug]` (for example "Best nights out in Soho") and `/venues/[slug]`, both statically generated, with metadata and Open Graph images.

### 6. Launch
Custom domain, Vercel Analytics or PostHog funnel (landing → questionnaire done → plan viewed → enquiry sent), cookie notice, updated privacy page.

**Later (v2):** Stripe deposits via webhook, accounts and saved plans, multilingual, more cities.

## Verification

- `supabase db reset` rebuilds the full schema and seed data from empty.
- Unit tests for the matching filters and itinerary timing, with fixed venue fixtures covering closed venues, an empty area and venues with missing details.
- An API test where Claude returns bad output or times out still returns a valid plan.
- Manual end-to-end on a phone (questionnaire → plan → swap a venue → enquiry). Check the enquiry row exists, and that it still exists when Resend is given a bad key.
- Hit `/api/plan` repeatedly and check the rate limit triggers.
- Lighthouse and SEO check on a venue page: content renders without JavaScript.
