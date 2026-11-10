// Cite Check: deterministic citation checker. No model call, no dependencies.
// Works in the browser and in Node. Small sibling of the validator in ctaio-decision-room.

/** Fold whitespace, curly quotes and letter case. Nothing else is changed. */
export function normalize(s) {
  return String(s)
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const UNITS =
  "%|percent|[a-z]+\\/[a-z]+|mg|mcg|ug|g|kg|mmol|nmol|mol|ml|l|iu|years?|months?|weeks?|days?|hours?|minutes?|times|fold";
// "1 in 5" first, then a number with an optional unit.
const NUMBER_RE = new RegExp(
  "(?<![\\w.])(\\d+(?:[.,]\\d+)*)(?:\\s+in\\s+(\\d+(?:[.,]\\d+)*))?(?:\\s*(" + UNITS + ")(?![a-z]))?",
  "gi"
);

const cleanNum = (n) => n.replace(/,/g, "");
const unitKey = (u) => (u ? (u.toLowerCase() === "percent" ? "%" : u.toLowerCase().replace(/s$/, "")) : "");

/** Numbers in a text, each with its unit if any. Example: "50 mg/dL", "20%", "1 in 5". */
export function extractNumbers(text) {
  const out = [];
  for (const m of String(text).matchAll(NUMBER_RE)) {
    out.push({
      raw: m[0].trim(),
      value: cleanNum(m[1]),
      of: m[2] ? cleanNum(m[2]) : "",
      unit: m[2] ? "" : unitKey(m[3]),
    });
  }
  return out;
}

function numberInText(n, text) {
  const all = extractNumbers(text);
  return all.some(
    (q) => q.value === n.value && q.of === n.of && (n.unit === "" || q.unit === n.unit)
  );
}

export function splitSentences(text) {
  return String(text)
    .split(/(?<=[.!?]["')\]]?)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const words = (s) => String(s).split(/\s+/).filter(Boolean);
const plain = (w) => normalize(w).replace(/[^a-z0-9]/g, "");

/** Closest sentence by word overlap, with differing words marked on both sides. */
export function closestSentence(quote, sourceText) {
  const qWords = new Set(words(quote).map(plain).filter(Boolean));
  if (qWords.size === 0) return undefined;
  let best = null;
  for (const sentence of splitSentences(sourceText)) {
    const sWords = new Set(words(sentence).map(plain).filter(Boolean));
    let shared = 0;
    for (const w of qWords) if (sWords.has(w)) shared++;
    if (shared === 0) continue;
    const score = shared / qWords.size + shared / (qWords.size + sWords.size - shared) / 100;
    if (!best || score > best.score) best = { sentence, score };
  }
  if (!best) return undefined;
  return { sentence: best.sentence, diff: diffWords(quote, best.sentence) };
}

/** Word-level diff using the longest common run of words. Marks words that differ. */
export function diffWords(quote, sentence) {
  const a = words(quote);
  const b = words(sentence);
  // Compare words without their punctuation, so "(a)" and "(a)," count as the same word.
  const key = (w) => plain(w) || normalize(w);
  const na = a.map(key);
  const nb = b.map(key);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = na[i] === nb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const keepA = new Set();
  const keepB = new Set();
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (na[i] === nb[j]) { keepA.add(i); keepB.add(j); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  // Words of the sentence outside the matched stretch are context, not differences.
  const kb = [...keepB];
  const first = kb.length ? Math.min(...kb) : 0;
  const last = kb.length ? Math.max(...kb) : -1;
  return {
    quote: a.map((text, k) => ({ text, changed: !keepA.has(k) })),
    sentence: b.map((text, k) => ({ text, changed: k >= first && k <= last && !keepB.has(k) })),
  };
}

export function checkClaim(claim, sourceMap) {
  const id = claim && claim.sourceId != null ? String(claim.sourceId).trim() : "";
  const quote = claim && claim.quote != null ? String(claim.quote).trim() : "";
  if (!id || !quote) {
    return { status: "no_source", reason: "The claim has no source or no quote, so there is nothing to check." };
  }
  const source = sourceMap.get(id);
  if (!source) {
    return { status: "unknown_source", reason: `The claim cites "${id}", which is not in the sources provided.` };
  }
  const text = String(source.text ?? "");
  if (!normalize(text).includes(normalize(quote))) {
    const verdict = { status: "quote_not_found", reason: "The quote does not appear word for word in the source." };
    const closest = closestSentence(quote, text);
    if (closest) verdict.closest = closest;
    return verdict;
  }
  for (const n of extractNumbers(claim.text ?? "")) {
    if (!numberInText(n, quote)) {
      return { status: "number_not_in_quote", reason: `The number "${n.raw}" in the claim is not in the quote.` };
    }
  }
  return { status: "pass", reason: "The quote is in the source and every number in the claim is in the quote." };
}

/** Returns one verdict per claim, in order. Throws a plain Error on malformed input. */
export function checkAnswer({ claims, sources } = {}) {
  if (!Array.isArray(claims)) throw new Error("claims must be a list.");
  if (!Array.isArray(sources)) throw new Error("sources must be a list.");
  const sourceMap = new Map();
  for (const s of sources) if (s && s.id != null) sourceMap.set(String(s.id).trim(), s);
  return claims.map((c) => checkClaim(c, sourceMap));
}

export const STATUS_LABELS = {
  pass: "Pass",
  no_source: "Blocked: no source",
  unknown_source: "Blocked: unknown source",
  quote_not_found: "Blocked: quote not found",
  number_not_in_quote: "Blocked: number not in quote",
};

export function summarize(verdicts) {
  const passed = verdicts.filter((v) => v.status === "pass").length;
  return { total: verdicts.length, passed, blocked: verdicts.length - passed };
}
