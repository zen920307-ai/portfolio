import { companionChat } from "./companion-chat.js";
import companionKnowledge from "../src/companion-knowledge.md";

const CHAT_PATH = "/api/companion-chat";

function allowedOrigin(request, env) {
  const origin = request.headers.get("origin");
  const allowed = String(env.CHAT_ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
  return origin && allowed.includes(origin) ? origin : "";
}

function corsHeaders(origin) {
  return origin ? {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "vary": "Origin",
  } : {};
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== CHAT_PATH) return new Response("Not found", { status: 404 });

    const origin = allowedOrigin(request, env);
    if (request.headers.get("origin") && !origin) return Response.json({ error: "请从作品集内发起聊天。" }, { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });

    const response = await companionChat(request, env, async () => {
      return companionKnowledge;
    });
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders(origin)).forEach(([key, value]) => headers.set(key, value));
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
