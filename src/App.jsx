/*
README / Overview (placeholders included)

This single-file React component is a complete frontend for a "Daily Trending News Generator".
It is built to be deployed to Cloudflare Pages or Netlify and expects two serverless endpoints:

1) GET /api/trending
   - Returns JSON: { region: "world"|"in", items: [{ id, title, source, publishedAt, summary, url }] }
   - Implementation suggestion: Cloudflare Worker that queries GNews / Google Trends / scrapers or an AI.

2) POST /api/generate-image
   - Body: { prompt }
   - Returns: { imageUrl }
   - Implementation suggestion: Cloudflare Worker that proxies to Bing Image Creator, DeepSeek, or an open model.

3) (Optional) POST /api/generate-script
   - Body: { title, source, summary }
   - Returns: { shortScript, titleVariants, hashtags }
   - Can be implemented using an LLM (OpenAI / DeepSeek / Anthropic) or a lightweight local heuristic.

Security & Keys
- Do NOT embed API keys in the frontend. Store them in Cloudflare Worker secrets / Netlify env vars.

Files to add to your repo (suggested):
- /frontend/src/App.jsx  <-- this file
- /workers/trending-worker.js <-- serverless worker for /api/trending
- /workers/image-worker.js <-- serverless worker for /api/generate-image
- package.json, tailwind config, index.html, etc.

Below: the React component (default export). It uses Tailwind classes. It includes features:
- Select region
- Fetch trending items
- Generate copy (title + short script) locally or via API
- Generate image (calls POST /api/generate-image)
- Copy buttons and download for Kinemaster-friendly JSON

*/

import React, { useEffect, useState } from "react";

export default function NewsGeneratorApp() {
  const [region, setRegion] = useState("world");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchTrending();
  }, [region]);

  async function fetchTrending() {
    setLoading(true);
    try {
      const res = await fetch(`/api/trending?region=${region}`);
      if (!res.ok) throw new Error("Failed to fetch trending");
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      console.error(e);
      // Fallback: minimal client-side mock when API not available
      setItems([{
        id: "mock-1",
        title: "Sample: Configure /api/trending worker",
        source: "local-fallback",
        publishedAt: new Date().toISOString(),
        summary: "No backend configured. Add /workers/trending-worker.js to your repo and deploy to Cloudflare Workers.",
        url: ""
      }]);
    }
    setLoading(false);
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    // small visual feedback could be added
  }

  async function generateScript(item) {
    setScriptLoading(true);
    // Preferred: call server-side LLM. Fallback: create a short script locally
    try {
      const res = await fetch(`/api/generate-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: item.title, summary: item.summary, source: item.source })
      });
      if (res.ok) {
        const data = await res.json();
        const entry = { ...item, ...data };
        setSelected(entry);
        setHistory(h => [entry, ...h].slice(0, 50));
      } else {
        // fallback local generation
        const shortScript = localShortScript(item);
        const titleVariants = [item.title, makeShortTitle(item.title)];
        const hashtags = makeHashtags(item.title);
        const entry = { ...item, shortScript, titleVariants, hashtags };
        setSelected(entry);
        setHistory(h => [entry, ...h].slice(0, 50));
      }
    } catch (e) {
      console.error(e);
      const shortScript = localShortScript(item);
      const titleVariants = [item.title, makeShortTitle(item.title)];
      const hashtags = makeHashtags(item.title);
      const entry = { ...item, shortScript, titleVariants, hashtags };
      setSelected(entry);
      setHistory(h => [entry, ...h].slice(0, 50));
    }
    setScriptLoading(false);
  }

  function localShortScript(item) {
    // careful: keep under 200 chars for shorts overlay
    const summary = item.summary || "";
    const s = `${item.title}. ${summary.split(".")[0] || summary}`;
    return s.length > 220 ? s.slice(0, 217) + "..." : s;
  }

  function makeShortTitle(title) {
    if (!title) return "";
    if (title.length <= 45) return title;
    const words = title.split(" ").slice(0, 7).join(" ");
    return words + "...";
  }

  function makeHashtags(title) {
    if (!title) return "#news";
    const tags = title
      .toLowerCase()
      .replace(/[\W_]+/g, " ")
      .split(" ")
      .filter(w => w.length > 3)
      .slice(0, 5);
    return "#" + tags.join(" #");
  }

  async function generateImage(prompt) {
    setImageLoading(true);
    try {
      const res = await fetch(`/api/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      if (!res.ok) throw new Error("Image API failed");
      const data = await res.json();
      setSelected(s => ({ ...s, imageUrl: data.imageUrl }));
    } catch (e) {
      console.error(e);
      // fallback: open a Bing image search in new tab with the prompt
      window.open(`https://www.bing.com/images/search?q=${encodeURIComponent(prompt)}`, "_blank");
    }
    setImageLoading(false);
  }

  function downloadKinemasterJSON(item) {
    // sample format: export title, script, imageUrl in a small JSON suitable to import / copy to mobile editor
    const payload = {
      title: item.titleVariants ? item.titleVariants[0] : item.title,
      script: item.shortScript || item.summary,
      image: item.imageUrl || "",
      tags: item.hashtags || makeHashtags(item.title),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `short_${(item.id || 'news').replace(/[^a-z0-9]/gi,'_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold">Daily Trending News Generator</h1>
          <p className="text-sm text-slate-600 mt-1">Generate titles, short scripts and images for YouTube Shorts. Free stack ready.</p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-2">
            <div className="flex items-center gap-3 mb-3">
              <label className="text-sm">Region:</label>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="border rounded px-2 py-1"
              >
                <option value="world">World</option>
                <option value="in">India</option>
                <option value="us">USA</option>
                <option value="tech">Tech</option>
                <option value="entertainment">Entertainment</option>
              </select>

              <button
                onClick={fetchTrending}
                className="ml-auto bg-indigo-600 text-white px-3 py-1 rounded"
              >{loading ? 'Refreshing...' : 'Refresh'}</button>
            </div>

            <div className="space-y-3">
              {items.map(item => (
                <article key={item.id} className="p-3 border rounded bg-white flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-baseline gap-3">
                      <h3 className="font-semibold">{item.title}</h3>
                      <span className="text-xs text-slate-500">{item.source}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 line-clamp-3">{item.summary}</p>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => generateScript(item)} className="text-sm px-2 py-1 border rounded">Generate Script</button>
                      <button onClick={() => { copyToClipboard(item.title); }} className="text-sm px-2 py-1 border rounded">Copy Title</button>
                      <a href={item.url || '#'} target="_blank" rel="noreferrer" className="text-sm px-2 py-1 border rounded">Open Source</a>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{new Date(item.publishedAt).toLocaleString()}</div>
                  </div>
                </article>
              ))}
            </div>

          </div>

          <aside className="p-4 bg-white border rounded">
            <h4 className="font-semibold mb-2">Selected / Output</h4>

            {selected ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Title</div>
                <div className="text-base font-semibold">{selected.titleVariants ? selected.titleVariants[0] : selected.title}</div>
                <div className="text-sm text-slate-600">{selected.hashtags}</div>

                <div className="mt-2">
                  <div className="text-sm font-medium">Short Script</div>
                  <textarea className="w-full border rounded p-2 text-sm" rows={4} value={selected.shortScript} readOnly />
                </div>

                <div className="flex gap-2 mt-2">
                  <button onClick={() => copyToClipboard(selected.shortScript)} className="px-2 py-1 border rounded">Copy Script</button>
                  <button onClick={() => downloadKinemasterJSON(selected)} className="px-2 py-1 border rounded">Download JSON</button>
                </div>

                <div className="mt-3">
                  <div className="text-sm font-medium">Image</div>
                  {selected.imageUrl ? (
                    <img src={selected.imageUrl} alt="gen" className="w-full h-36 object-cover rounded mt-2" />
                  ) : (
                    <div className="text-xs text-slate-500 mt-1">No image yet</div>
                  )}

                  <div className="flex gap-2 mt-2">
                    <input defaultValue={`${selected.title} news`} className="flex-1 border rounded px-2 py-1 text-sm" id="imgprompt" />
                    <button onClick={() => {
                      const p = document.getElementById('imgprompt').value;
                      generateImage(p);
                    }} className="px-2 py-1 border rounded">{imageLoading ? 'Generating...' : 'Generate Image'}</button>
                  </div>

                </div>

              </div>
            ) : (
              <div className="text-sm text-slate-500">Select an item and click "Generate Script" to start.</div>
            )}

            <hr className="my-3" />

            <div>
              <h5 className="text-sm font-medium">History</h5>
              <div className="space-y-2 mt-2 max-h-64 overflow-auto">
                {history.map((h, idx) => (
                  <div key={idx} className="text-xs p-2 border rounded">
                    <div className="font-medium">{h.titleVariants ? h.titleVariants[0] : h.title}</div>
                    <div className="text-slate-500">{h.hashtags}</div>
                  </div>
                ))}
              </div>
            </div>

          </aside>
        </section>

        <footer className="mt-6 text-sm text-slate-500">
          <div>Deploy notes: configure /api endpoints in Workers and set secrets. Then point Cloudflare Pages to this repo.</div>
        </footer>
      </div>
    </div>
  );
}

/*

--- cloudflare worker: /workers/trending-worker.js (suggested)

add to your repo as /workers/trending-worker.js and deploy to cloudflare workers. Example skeleton:

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const region = url.searchParams.get('region') || 'world';

    // Example: use GNews (requires API key stored in env.GNEWS_KEY)
    // const gnewsUrl = `https://gnews.io/api/v4/top-headlines?token=${env.GNEWS_KEY}&lang=en&country=${region === 'in' ? 'in' : 'us'}`;
    // const r = await fetch(gnewsUrl);
    // const j = await r.json();
    // map j.articles to { id, title, summary, source, publishedAt, url }

    // For quick demo return a static payload
    return new Response(JSON.stringify({ items: [{ id: 'demo', title: 'Deploy your worker and configure a news API', summary: 'This is a demo item.', source: 'demo', publishedAt: new Date().toISOString(), url: '' }] }), { headers: { 'Content-Type': 'application/json' } });
  }
};

--- cloudflare worker: /workers/image-worker.js (suggested)

// POST /api/generate-image -> proxies to an image API. Keep keys as secrets in Cloudflare.

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    const body = await request.json();
    const prompt = body.prompt || 'news illustration';

    // Example: call Bing Image Creator / DeepSeek here using env keys
    // return JSON { imageUrl }

    return new Response(JSON.stringify({ imageUrl: 'https://via.placeholder.com/640x360.png?text=Add+image+worker' }), { headers: { 'Content-Type': 'application/json' } });
  }
};

*/

