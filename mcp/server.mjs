// Stdio MCP server exposing the Cite Check checker as one tool: check_citations.
// It imports the same checker.js the web page uses. No model call, no network.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkAnswer, summarize } from "../checker.js";

const server = new McpServer({ name: "cite-check", version: "0.1.0" });

const claimShape = z.object({
  text: z.string().describe("The claim as written in the answer."),
  sourceId: z.string().optional().describe("The id of the source the claim cites."),
  quote: z.string().optional().describe("Words the claim says it copied from that source."),
});
const sourceShape = z.object({
  id: z.string(),
  title: z.string().optional(),
  url: z.string().optional(),
  text: z.string().describe("The full source text the quote must appear in."),
});
const closestShape = z.object({
  sentence: z.string(),
  diff: z.object({
    quote: z.array(z.object({ text: z.string(), changed: z.boolean() })),
    sentence: z.array(z.object({ text: z.string(), changed: z.boolean() })),
  }),
});

server.registerTool(
  "check_citations",
  {
    title: "Check citations",
    description:
      "Checks, with plain code and no model, that each claim's quote appears word for word in its cited source and that every number in the claim appears in the quote. Returns one verdict per claim. It does not judge whether the claim follows from the quote.",
    inputSchema: {
      claims: z.array(claimShape),
      sources: z.array(sourceShape),
    },
    outputSchema: {
      summary: z.object({ total: z.number(), passed: z.number(), blocked: z.number() }),
      verdicts: z.array(
        z.object({
          status: z.enum(["pass", "no_source", "unknown_source", "quote_not_found", "number_not_in_quote"]),
          reason: z.string(),
          closest: closestShape.optional(),
        })
      ),
    },
  },
  async ({ claims, sources }) => {
    const verdicts = checkAnswer({ claims, sources });
    const summary = summarize(verdicts);
    const lines = verdicts.map((v, i) => `${i + 1}. ${v.status === "pass" ? "PASS" : "BLOCKED"}: ${v.reason}`);
    return {
      content: [
        { type: "text", text: `${summary.passed} of ${summary.total} claims pass. ${summary.blocked} blocked.\n${lines.join("\n")}` },
      ],
      structuredContent: { summary, verdicts },
    };
  }
);

await server.connect(new StdioServerTransport());
