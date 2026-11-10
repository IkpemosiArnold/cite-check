// Plain-text format for the "Try your own" boxes. Blocks are separated by a line with ---.
// Answer block:  CLAIM: ...   SOURCE: id   QUOTE: ...
// Source block:  ID: ...      TITLE: ...   URL: ...   TEXT: ...

function blocks(input) {
  return String(input ?? "")
    .split(/^\s*---\s*$/m)
    .map((b) => b.trim())
    .filter(Boolean);
}

function fields(block, keys) {
  const out = {};
  let current = null;
  const re = new RegExp("^(" + keys.join("|") + ")\\s*:\\s*(.*)$", "i");
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(re);
    if (m) {
      current = m[1].toLowerCase();
      out[current] = m[2].trim();
    } else if (current && line.trim()) {
      out[current] += " " + line.trim();
    }
  }
  return out;
}

export function parseAnswer(input) {
  const list = blocks(input);
  if (list.length === 0) throw new Error("The answer box is empty. Add at least one claim.");
  return list.map((b, i) => {
    const f = fields(b, ["claim", "source", "quote"]);
    if (!f.claim) throw new Error(`Answer block ${i + 1} has no CLAIM line.`);
    return { text: f.claim, sourceId: f.source || "", quote: f.quote || "" };
  });
}

export function parseSources(input) {
  const list = blocks(input);
  if (list.length === 0) throw new Error("The sources box is empty. Add at least one source.");
  return list.map((b, i) => {
    const f = fields(b, ["id", "title", "url", "text"]);
    if (!f.id) throw new Error(`Source block ${i + 1} has no ID line.`);
    if (!f.text) throw new Error(`Source "${f.id}" has no TEXT line.`);
    return { id: f.id, title: f.title || f.id, url: f.url || "", text: f.text };
  });
}

const one = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

export function formatAnswer(claims) {
  return claims
    .map((c) => `CLAIM: ${one(c.text)}\nSOURCE: ${one(c.sourceId)}\nQUOTE: ${one(c.quote)}`)
    .join("\n---\n");
}

export function formatSources(sources) {
  return sources
    .map((s) => `ID: ${one(s.id)}\nTITLE: ${one(s.title)}\nURL: ${one(s.url)}\nTEXT: ${one(s.text)}`)
    .join("\n---\n");
}
