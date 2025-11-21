# News Trending Generator

Frontend: React + Tailwind (Vite).  
Workers: trending-worker (GNews) and image-worker (placeholder).

## Setup (local)

1. Install:
npm install

markdown
Copy code

2. Run dev:
npm run dev

markdown
Copy code

3. Build:
npm run build

markdown
Copy code

## Deploy (Cloudflare Pages + Workers)

1. Create a Cloudflare Pages site linked to this repo (or deploy via `wrangler`).
2. Create two workers:
- trending-worker (copy workers/trending-worker.js)
- image-worker (copy workers/image-worker.js)
3. Set Worker secret:
- `GNEWS_KEY` (your GNews API key)
4. Configure a route: `/api/*` to route to the correct worker:
- e.g. `/api/trending` -> trending-worker
- `/api/generate-image` -> image-worker

Alternatively, use Pages Functions (recommended) and add `workers` as Functions.

## Notes
- Do NOT store API keys in frontend.
- GNews free tier has rate limits — consider caching.
