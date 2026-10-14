# Don't Kill the DJ

Live song requests and crowd energy for DJs. Dark nightlife UI, PostgreSQL + Prisma, Auth.js credentials for the DJ dashboard.

## Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- PostgreSQL 16 (Docker Compose) + Prisma
- Auth.js (Credentials, JWT session)
- In-process realtime bus + SSE (with polling fallback)
- Motion, Lucide, Zod, QR codes, Vitest

## Prerequisites

- Node.js 20+ (Node 24 is fine)
- Docker Desktop (or another Docker engine) for local Postgres — PostgreSQL is not required on the host

## Local setup

```bash
# 1. Environment
cp .env.example .env

# 2. Postgres 16
docker compose up -d

# 3. Install and migrate
npm install
npx prisma migrate dev
npm run db:seed

# 4. App
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Keep the Docker Postgres URL from `.env.example` unless you change Compose credentials. Set `AUTH_SECRET` to a long random string before using login in a shared environment.

### Demo login

| Field    | Value              |
|----------|--------------------|
| Email    | `dj@neonroom.local` |
| Password | `crowdcontrol`     |

Seed creates **DJ Vega** at venue **Neon Room** and a live event **Friday Night Live**.

### Public text-line page

The crowd joins by SMS. The public page only shows the number and what to text:

```text
http://localhost:3000/e/neon-room-friday
```

DJ dashboard (web, including a phone browser): sign in → open the event. The QR code points at that same `/e/[slug]` page. Temperature, sentiment, and song requests update over SSE; if the stream drops, the board polls every 2s.

### Tests

```bash
npm test
```

Vitest covers song-key normalization, duplicate request → upvote, and rejecting requests when the event is not live.

## What’s in this slice

- DJ credentials login, create event, start session
- DJ dashboard on the web: live song board, room-temperature gauge, sentiment bar
- Song requests and crowd checks arrive by SMS (`HOT` / `COLD` / `1–5`, a sentence, `REQUEST Title - Artist`)
- Public `/e/[slug]` page shows the text line. It does not take requests in the browser.
- Song-request service with per-event dedupe (`title|artist` normalized key)

Texts hit `POST /api/twilio/sms`. The webhook returns 503 until `TWILIO_AUTH_TOKEN` is set, and it checks the Twilio signature. Free-text SMS uses a local word reader. Set `OPENAI_API_KEY` when you want that reader to call a model instead. One live event receives texts automatically; with several live events, guests text `JOIN <slug>`.

## Coming next

**Voice** and **Stripe** (tips / priority) arrive in later phases. Leave those env vars unset locally — missing provider keys must never fake a successful payment or message.

## Design tokens

| Token      | Value     | Role            |
|------------|-----------|-----------------|
| background | `#09090F` | App canvas      |
| surface    | `#151520` | Panels / cards  |
| neon       | `#A855F7` | Primary / focus |
| pink       | `#FF3CAC` | Accent          |
| cyan       | `#22D3EE` | Live / secondary|

Exposed as CSS variables (`--background`, `--surface`, `--neon`, `--pink`, `--cyan`) and Tailwind colors (`bg-surface`, `text-neon`, etc.).
