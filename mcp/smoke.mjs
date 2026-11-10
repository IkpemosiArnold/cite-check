// Starts server.mjs over stdio with the SDK's own client, lists tools, calls check_citations on the sample.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { claims, sources } from "../sample.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL("./server.mjs", import.meta.url))],
});
const client = new Client({ name: "cite-check-smoke", version: "0.1.0" });
await client.connect(transport);

const { tools } = await client.listTools();
console.log("tools:", tools.map((t) => t.name).join(", "));

const result = await client.callTool({ name: "check_citations", arguments: { claims, sources } });
const { summary, verdicts } = result.structuredContent;
const counts = {};
for (const v of verdicts) counts[v.status] = (counts[v.status] || 0) + 1;
console.log("text:", result.content[0].text.split("\n")[0]);
console.log("summary:", JSON.stringify(summary));
console.log("verdict counts:", JSON.stringify(counts));

await client.close();
const ok = summary.passed === 4 && summary.blocked === 2 && tools.length === 1;
console.log(ok ? "smoke ok" : "smoke FAILED");
process.exit(ok ? 0 : 1);
