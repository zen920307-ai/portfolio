import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chapters } from "../src/data.js";
import { resolveContent } from "../src/content.js";

test("seventh chapter renders original IP dialogue, correct avatars and home destination", async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
  try {
    const { default: Page } = await server.ssrLoadModule("/src/components/IpEpilogue.jsx");
    const html = renderToStaticMarkup(React.createElement(Page));
    assert.equal(chapters.length, 7);
    assert.equal(chapters.at(-1).id, "dundun-pupu");
    assert.match(html, /data-chapter="6"/);
    assert.match(html, /https:\/\/dun.zenslab.top/);
    assert.equal((html.match(/class="ip-dialogue-row /g) || []).length, 4);
    assert.match(html, /ip-dundun-avatar.webp/);
    assert.match(html, /ip-pupu-avatar.webp/);
    assert.match(resolveContent({}).ipWorld[0].description, /随时犯困/);
  } finally { await server.close(); }
});
