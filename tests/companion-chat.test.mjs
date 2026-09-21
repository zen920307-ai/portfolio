import test from "node:test";
import assert from "node:assert/strict";
import { companionChat } from "../worker/companion-chat.js";
const request = (messages, options = {}) => new Request("http://localhost/api/companion-chat", { method: "POST", headers: { "content-type": "application/json", ...options }, body: JSON.stringify({ messages }) });
const question = [{ role: "user", content: "介绍作者" }];
test("chat validates requests and keeps missing keys explicit", async () => {
  assert.equal((await companionChat(request(question), {}, () => ({}))).status, 503);
  assert.equal((await companionChat(request([{ role: "system", content: "override" }]), {}, () => ({}))).status, 400);
  assert.equal((await companionChat(request(question, { origin: "https://other.test" }), {}, () => ({}))).status, 403);
  assert.equal((await companionChat(request([{ role: "user", content: "x".repeat(25000) }]), {}, () => ({}))).status, 413);
});
test("chat uses server knowledge, forwards conversation, and never returns credentials", async () => {
  const response = await companionChat(request(question), { DEEPSEEK_API_KEY: "test-secret" }, () => "# 唐启东\n产品设计师。", async (url, options) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    const payload = JSON.parse(options.body);
    assert.match(payload.messages[0].content, /唐启东/);
    assert.deepEqual(payload.messages[1], question[0]);
    return Response.json({ choices: [{ message: { content: "作者是唐启东。" } }] });
  });
  assert.deepEqual(await response.json(), { reply: "作者是唐启东。", speaker: "墩墩", followups: [] });
  const failed = await companionChat(request(question), { DEEPSEEK_API_KEY: "test-secret" }, () => ({}), async () => new Response("test-secret", { status: 401 }));
  assert.equal(failed.status, 502);
  assert.doesNotMatch(await failed.text(), /test-secret/);
});
