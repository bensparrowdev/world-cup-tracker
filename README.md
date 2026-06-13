# World Cup 2026 Live Tracker

A digital, self-updating World Cup wallchart. One page shows the current (or
most recent) match as a big scoreline at the top, and all 12 group tables at the
bottom with the top two qualifying teams highlighted green. The page refreshes
itself every 30 seconds so it behaves like a live poster.

Built with [React Router v7](https://reactrouter.com/) (framework mode) and
Tailwind CSS. Live data comes from the free
[football-data.org](https://www.football-data.org/) API.

## How it works

- The page data is loaded **server-side** in a route loader, so the API token
  never reaches the browser.
- Responses are held in a small **in-memory cache** (standings 60s, matches
  30s). Because every visitor reads the same cached copy, the number of API
  calls does not grow with traffic - we stay well under the free tier's
  10 requests/minute limit.
- The hero picks, in order: a live match, else the most recent finished match,
  else the next upcoming match.

```
app/
  lib/
    football-data.server.ts  # typed API client + in-memory cache
    world-cup.server.ts      # shapes raw API data into view models
    datetime.ts              # client-safe time formatting
  components/
    MatchHero.tsx            # big scoreline at the top
    GroupCard.tsx            # one group table (top two highlighted)
    TeamCrest.tsx, LocalTime.tsx
  routes/
    home.tsx                 # the live tracker page (+ auto-refresh)
    sweepstake.tsx           # stub for a future personal sweepstake page
```

## Getting started

1. Get a free API token at
   [football-data.org/client/register](https://www.football-data.org/client/register)
   (it is emailed to you instantly).
2. Create a `.env` file (see `.env.example`):

   ```
   FOOTBALL_DATA_TOKEN=your_token_here
   ```

3. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

   Open http://localhost:5173. Without a token the page shows a friendly
   "add your token" screen instead of crashing.

## Useful scripts

- `npm run dev` - start the development server
- `npm run typecheck` - generate route types and run TypeScript
- `npm run build` - production build
- `npm run start` - serve the production build

## Deploying for free (Render)

This app is designed to run as a **single always-on instance** so the shared
in-memory cache keeps one global API call count.

1. Push this repo to GitHub.
2. In Render, create a new **Web Service** from the repo (the included
   `render.yaml` configures a free, single-instance Node service).
3. Add the `FOOTBALL_DATA_TOKEN` environment variable in the Render dashboard.

> Note: Render's free tier sleeps after ~15 minutes of inactivity, so the first
> visit after idle has a few-second cold start. Avoid serverless hosts
> (Vercel/Cloudflare) here - multiple instances would each keep their own cache
> and multiply API calls during live matches.

## Roadmap

- **Sweepstake page** (`/sweepstake`) - currently a stub; will track a personal
  World Cup sweepstake in a future iteration.
