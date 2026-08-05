import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const accountId = "05a63bcc45a9e8ddc291649b1251b417";
const project = "portfolio";
const domain = "design.zenslab.top";

const configPath = path.join(
  process.env.XDG_CONFIG_HOME || path.join(homedir(), "AppData", "Roaming", "xdg.config"),
  ".wrangler",
  "config",
  "default.toml",
);

const toml = readFileSync(configPath, "utf8");
const oauth = toml.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];
const apiToken = process.env.CLOUDFLARE_API_TOKEN || oauth;
if (!apiToken) throw new Error(`No Cloudflare token found in ${configPath}`);

const headers = {
  Authorization: `Bearer ${apiToken}`,
  "Content-Type": "application/json",
};

async function cf(method, urlPath, body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    console.error(method, urlPath, JSON.stringify(json.errors || json, null, 2));
    throw new Error(`Cloudflare API failed: ${method} ${urlPath}`);
  }
  return json.result;
}

const action = process.argv[2] || "add-domain";

if (action === "add-domain") {
  const result = await cf("POST", `/accounts/${accountId}/pages/projects/${project}/domains`, {
    name: domain,
  });
  console.log("Domain attached:", JSON.stringify(result, null, 2));
} else if (action === "list-domains") {
  const result = await cf("GET", `/accounts/${accountId}/pages/projects/${project}/domains`);
  console.log(JSON.stringify(result, null, 2));
} else if (action === "list-zones") {
  const result = await cf("GET", `/zones?name=zenslab.top`);
  console.log(JSON.stringify(result, null, 2));
} else if (action === "list-dns") {
  const zones = await cf("GET", `/zones?name=zenslab.top`);
  const zoneId = zones[0]?.id;
  if (!zoneId) throw new Error("Zone zenslab.top not found");
  const records = await cf("GET", `/zones/${zoneId}/dns_records?name=${domain}`);
  console.log(JSON.stringify(records, null, 2));
} else if (action === "project") {
  const result = await cf("GET", `/accounts/${accountId}/pages/projects/${project}`);
  console.log(JSON.stringify(result, null, 2));
} else {
  throw new Error(`Unknown action: ${action}`);
}
