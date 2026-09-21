import { companionChat } from "./companion-chat.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/companion-chat") return companionChat(request, env, async () => {
      const knowledge = await env.ASSETS.fetch(new Request(new URL("/companion-knowledge.md", request.url)));
      if (!knowledge.ok) throw new Error("Knowledge unavailable");
      return await knowledge.text();
    });
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
    const isAdmin = request.headers.get("authorization") === `Bearer ${env.ADMIN_TOKEN}`;
    if (url.pathname === "/api/portfolio-content") {
      if (request.method === "GET") return json((await env.PORTFOLIO_CONTENT?.get("content", "json")) || {});
      if (request.method === "PUT") {
        if (!isAdmin) return json({ error: "Unauthorized" }, 401);
        if (!env.PORTFOLIO_CONTENT) return json({ error: "Missing PORTFOLIO_CONTENT KV binding" }, 503);
        await env.PORTFOLIO_CONTENT.put("content", JSON.stringify(await request.json()));
        return json({ ok: true });
      }
      return json({ error: "Method not allowed" }, 405);
    }
    if (url.pathname === "/api/portfolio-media" && request.method === "POST") {
      if (!isAdmin) return json({ error: "Unauthorized" }, 401);
      if (!env.PORTFOLIO_MEDIA) return json({ error: "Missing PORTFOLIO_MEDIA R2 binding" }, 503);
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File) || !file.type.startsWith("image/")) return json({ error: "An image file is required" }, 400);
      const group = String(form.get("group") || "works").replace(/[^a-zA-Z0-9_-]/g, "");
      const key = `portfolio/${group}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      await env.PORTFOLIO_MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
      return json({ url: `/api/portfolio-media/${key}` });
    }
    if (url.pathname.startsWith("/api/portfolio-media/") && request.method === "GET") {
      const object = await env.PORTFOLIO_MEDIA?.get(decodeURIComponent(url.pathname.replace("/api/portfolio-media/", "")));
      return object ? new Response(object.body, { headers: { "content-type": object.httpMetadata?.contentType || "application/octet-stream", "cache-control": "public, max-age=31536000, immutable" } }) : new Response("Not found", { status: 404 });
    }
    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      return response;
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
