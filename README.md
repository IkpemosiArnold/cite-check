# Cite Check

A link next to a sentence does not prove the source says what the sentence says. Cite Check tests, in plain code and with no model, that each quote in an AI answer is really in its source. It is a small sibling of the validator in the CTAIO Decision Room project.

The sample asks: "How do I interpret an elevated Lp(a) in a healthy 45-year-old?" The sample answer was written for this demo, and two errors were planted on purpose.

## The four checks

Run in this order. The first one that fails decides the verdict.

1. **No source.** The claim has no source id or no quote.
2. **Unknown source.** The source id is not in the source set.
3. **Quote not found.** The quote is not in that source word for word. Only whitespace, curly versus straight quotes and letter case are ignored. On failure the closest sentence in the source is shown, with the differing words marked.
4. **Number not in quote.** A number in the claim, with its unit if any (for example "50 mg/dL", "20%", "1 in 5"), does not appear in the quote.

If none fail, the claim passes.

## Run the tests

```
node --test
```

Needs Node 20 or later. No dependencies.

## Open the page locally

ES modules do not load from `file://`, so serve the folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000. Apart from loading two typefaces from Google Fonts, the page makes no network calls. Nothing you paste leaves the browser.

"Try your own" takes plain text. Separate blocks with a line of three dashes.

```
CLAIM: what the answer says
SOURCE: the source ID
QUOTE: words copied from the source
---
ID: the source ID
TITLE: page name
URL: https://example.gov/page
TEXT: the full source text
```

## MCP server

`mcp/server.mjs` exposes the same `checker.js` as one tool, `check_citations`, which takes `{claims, sources}` and returns the verdicts as structured output plus a short text summary.

```
cd mcp
npm install
node smoke.mjs
```

Claude Code:

```
claude mcp add cite-check -- node /full/path/to/cite-check/mcp/server.mjs
```

Claude Desktop, in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cite-check": {
      "command": "node",
      "args": ["/full/path/to/cite-check/mcp/server.mjs"]
    }
  }
}
```

Versions are pinned exactly in `mcp/package.json`: `@modelcontextprotocol/sdk` 1.32.2 and `zod` 4.6.7 (which the SDK requires).

## Sources, fetched 10 Nov 2026

Text was copied word for word from these US government pages.

- MedlinePlus, Lipoprotein (a) Blood Test: https://medlineplus.gov/lab-tests/lipoprotein-a-blood-test/ (8 sentences)
- NHLBI, Blood cholesterol diagnosis: https://www.nhlbi.nih.gov/health/blood-cholesterol/diagnosis (5 sentences)

## Limits

It proves the quote is in the source. It does not prove the claim follows from the quote, which still needs a clinician or a second check. Numbers written as words ("five") are not read.

## Provenance

Built on 10 Nov 2026 with AI coding agents, directed by Arnold Ikpemosi Adeyemi. Not medical advice.

## Licence

MIT. See `LICENSE`.
