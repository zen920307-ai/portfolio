import { execFileSync } from "node:child_process";

const gh = "C:\\PROGRA~1\\GITHUB~1\\gh.exe";
const body = {
  message: "Remove design.zenslab.top CNAME for portfolio migration",
  sha: "bf92c18513e37446d0a981f745a4ca13966ff667",
  branch: "main",
};

const result = execFileSync(
  gh,
  ["api", "-X", "DELETE", "repos/zen920307-ai/tqd-design-lab/contents/CNAME", "--input", "-"],
  { input: JSON.stringify(body), encoding: "utf8" },
);
console.log(result);
