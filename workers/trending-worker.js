// workers/trending-worker.js
/**
 * Cloudflare Worker to proxy GNews top-headlines endpoint.
 * Expects a secret named GNEWS_KEY configured for the worker.
 *
 * Endpoint:
 *   GET /api/trending?region=<region>
 *
 * region options:
 *   world (default) | in | us | gb | ca | au | de | fr | it | es | tech | entertainment
 *
 * Caching: uses Cloudflare cache for `CACHE_TTL` seconds to avoid hitting GNews rate limits.
 */

const CACHE_TTL = 300; // seconds (5 minutes). Change as needed.

async function fetchFromGNews(gnewsKey, region) {
  let base = `https://gnews.io/api/v4/top-headlines?token=${encodeURIComponent(gnewsKey)}&lang=en&max=30`;
  const countryCodes = ["us","in","gb","ca","au","de","fr","it","es"];
  if (countryCodes.includes(region)) {
    base += `&country=${region}`;
  } else if (region === "tech") {
    base += `&topic=technology`;
  } else if (region === "entertainment") {
    base += `&topic=entertainment`;
  } else {
    // world -> no country filter
  }

  const res = await fetch(base, { cf: { cacheEverything: false }});
  return res;
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const region = (url.searchParams.get("region") || "world").toLowerCase();

      // Validate key
      const gnewsKey = env.GNEWS_KEY;
      if (!gnewsKey) {
        return new Response(JSON.stringify({ error: "GNEWS_KEY not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Cloudflare cache lookup
      const cache = caches.default;
      const cacheKey = new Request(`${url.origin}${url.pathname}?region=${region}`, requestInitForCache());
      const cached = await cache.match(cacheKey);
      if (cached) {
        // Serve cached response
        return cached;
      }

      // Not cached -> fetch from GNews
      const gnewsRes = await fetchFromGNews(gnewsKey, region);
      if (!gnewsRes.ok) {
        const text = await gnewsRes.text();
        return new Response(JSON.stringify({ error: "GNews error", status: gnewsRes.status, details: text }), {
          status: 502,
          headers: { "Content-Type": "application/json" }
        });
      }

      const j = await gnewsRes.json();
      const items = (j.articles || []).map((a, idx) => ({
        id: a.url || `gnews-${idx}`,
        title: a.title,
        source: a.source?.name || "GNews",
        publishedAt: a.publishedAt,
        summary: a.description || a.content || "",
        url: a.url,
      }));

      const body = JSON.stringify({ items });
      const response = new Response(body, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${CACHE_TTL}`
        }
      });

      // Put in Cloudflare cache
      ctx.waitUntil(cache.put(cacheKey, response.clone()));

      return response;
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};

function requestInitForCache() {
  return {
    method: "GET",
    headers: { "Accept": "application/json" }
  };
}
