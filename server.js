const PORT = Number(Bun.env.PORT ?? 3000);
const BASE_URL = (
  Bun.env.BASE_URL ??
  (Bun.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${Bun.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${PORT}`)
).replace(/\/+$/, "");
const PUBLIC_DIR = Bun.env.PUBLIC_DIR ?? null;

const links = new Map();
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function makeCode() {
  let code;
  do {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    code = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
  } while (links.has(code));
  return code;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function linkResponse(code) {
  const link = links.get(code);
  return {
    code,
    url: link.url,
    shortUrl: `${BASE_URL}/${code}`,
    hits: link.hits,
    createdAt: link.createdAt,
  };
}

async function staticFile(pathname) {
  if (!PUBLIC_DIR || pathname.includes("..")) return null;
  const file = Bun.file(`${PUBLIC_DIR}${pathname === "/" ? "/index.html" : pathname}`);
  return (await file.exists()) ? new Response(file) : null;
}

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method === "POST" && pathname === "/api/links") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }

      const url = typeof body?.url === "string" ? body.url.trim() : "";
      if (!isHttpUrl(url)) {
        return json({ error: 'Provide a valid http(s) URL in { "url": ... }' }, 400);
      }

      const code = makeCode();
      links.set(code, { url, hits: 0, createdAt: new Date().toISOString() });
      return json(linkResponse(code), 201);
    }

    if (request.method === "GET" && pathname === "/api/links") {
      return json([...links.keys()].map(linkResponse));
    }

    if (request.method === "GET") {
      const asset = await staticFile(pathname);
      if (asset) return asset;
    }

    if (request.method === "GET" && /^\/[^/]+$/.test(pathname)) {
      const code = pathname.slice(1);
      const link = links.get(code);
      if (!link) return json({ error: "Unknown short code" }, 404);
      link.hits += 1;
      return new Response(null, {
        status: 302,
        headers: { Location: link.url, ...CORS },
      });
    }

    return json({ error: "Not found" }, 404);
  },
});

console.log(`Snip backend running on ${server.url.href.replace(/\/$/, "")}`);