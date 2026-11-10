import test from "node:test";
import assert from "node:assert/strict";
import { checkAnswer, extractNumbers, normalize, summarize } from "./checker.js";
import { parseAnswer, parseSources, formatAnswer, formatSources } from "./parse.js";
import { claims as sampleClaims, sources as sampleSources } from "./sample.js";

const sources = [
  {
    id: "a",
    title: "Source A",
    url: "https://example.org/a",
    text: "The panel is routine. Patients often have a level of 50 mg/dL after treatment. About 1 in 5 adults report it. The rate fell by 20% in the study. It is “curly” and it’s fine.",
  },
];
const one = (claim) => checkAnswer({ claims: [claim], sources })[0];

test("pass: quote is in the source and numbers are in the quote", () => {
  const v = one({ text: "The panel is routine.", sourceId: "a", quote: "The panel is routine." });
  assert.equal(v.status, "pass");
  assert.ok(v.reason.length > 0);
  assert.equal(v.closest, undefined);
});

test("no source: missing sourceId or missing quote", () => {
  assert.equal(one({ text: "x", quote: "The panel is routine." }).status, "no_source");
  assert.equal(one({ text: "x", sourceId: "a" }).status, "no_source");
  assert.equal(one({ text: "x", sourceId: "a", quote: "   " }).status, "no_source");
  assert.equal(one({ text: "x", sourceId: "  ", quote: "q" }).status, "no_source");
});

test("unknown source: id not in the set", () => {
  const v = one({ text: "x", sourceId: "zzz", quote: "The panel is routine." });
  assert.equal(v.status, "unknown_source");
  assert.match(v.reason, /zzz/);
});

test("unknown source is reported before quote is looked for", () => {
  assert.equal(one({ text: "x", sourceId: "zzz", quote: "not anywhere" }).status, "unknown_source");
});

test("normalisation: whitespace and letter case are ignored", () => {
  const v = one({ text: "x", sourceId: "a", quote: "  the   PANEL\n is   routine. " });
  assert.equal(v.status, "pass");
});

test("normalisation: curly and straight quotes are treated the same", () => {
  assert.equal(one({ text: "x", sourceId: "a", quote: 'It is "curly" and it\'s fine.' }).status, "pass");
  assert.equal(normalize("“Hi” ‘there’"), "\"hi\" 'there'");
});

test("normalisation does not forgive other changes: a changed word fails", () => {
  const v = one({ text: "x", sourceId: "a", quote: "The panel is optional." });
  assert.equal(v.status, "quote_not_found");
});

test("normalisation does not forgive punctuation changes", () => {
  assert.equal(one({ text: "x", sourceId: "a", quote: "The panel is routine" }).status, "pass");
  assert.equal(one({ text: "x", sourceId: "a", quote: "The, panel is routine" }).status, "quote_not_found");
});

test("quote not found: returns the closest sentence and marks differing words", () => {
  const v = one({
    text: "The rate fell by 25%.",
    sourceId: "a",
    quote: "The rate fell by 25% in the study.",
  });
  assert.equal(v.status, "quote_not_found");
  assert.equal(v.closest.sentence, "The rate fell by 20% in the study.");
  const changedSentence = v.closest.diff.sentence.filter((w) => w.changed).map((w) => w.text);
  const changedQuote = v.closest.diff.quote.filter((w) => w.changed).map((w) => w.text);
  assert.deepEqual(changedSentence, ["20%"]);
  assert.deepEqual(changedQuote, ["25%"]);
});

test("closest sentence: a phrase quote marks only the differing word, not the rest of the sentence", () => {
  const v = one({ text: "x", sourceId: "a", quote: "Patients often have a level of 60 mg/dL" });
  assert.equal(v.status, "quote_not_found");
  assert.match(v.closest.sentence, /^Patients often have a level of 50 mg\/dL/);
  const changed = v.closest.diff.sentence.filter((w) => w.changed).map((w) => w.text);
  assert.deepEqual(changed, ["50"]);
});

test("closest sentence: none when nothing overlaps", () => {
  const v = one({ text: "x", sourceId: "a", quote: "zebra giraffe okapi" });
  assert.equal(v.status, "quote_not_found");
  assert.equal(v.closest, undefined);
});

test("number not in quote: bare number", () => {
  const v = one({ text: "The panel is routine for 30 patients.", sourceId: "a", quote: "The panel is routine." });
  assert.equal(v.status, "number_not_in_quote");
  assert.match(v.reason, /30/);
});

test("number with a unit: right number, wrong unit is caught", () => {
  const quote = "Patients often have a level of 50 mg/dL after treatment.";
  assert.equal(one({ text: "Level of 50 mg/dL.", sourceId: "a", quote }).status, "pass");
  assert.equal(one({ text: "Level of 50 mmol/L.", sourceId: "a", quote }).status, "number_not_in_quote");
  assert.equal(one({ text: "Level of 60 mg/dL.", sourceId: "a", quote }).status, "number_not_in_quote");
});

test("number with a unit: percent sign and the word percent match", () => {
  assert.equal(one({ text: "It fell by 20 percent.", sourceId: "a", quote: "The rate fell by 20% in the study." }).status, "pass");
  assert.equal(one({ text: "It fell by 20%.", sourceId: "a", quote: "The rate fell by 20% in the study." }).status, "pass");
});

test("number with a unit: '1 in 5' is read as one figure", () => {
  assert.deepEqual(extractNumbers("About 1 in 5 adults").map((n) => n.raw), ["1 in 5"]);
  assert.equal(one({ text: "1 in 5 adults.", sourceId: "a", quote: "About 1 in 5 adults report it." }).status, "pass");
  assert.equal(one({ text: "1 in 4 adults.", sourceId: "a", quote: "About 1 in 5 adults report it." }).status, "number_not_in_quote");
});

test("numbers: 5 does not match inside 15", () => {
  const v = one({ text: "At age 5.", sourceId: "a", quote: "The panel is routine." });
  assert.equal(v.status, "number_not_in_quote");
  assert.deepEqual(extractNumbers("45-year-old").map((n) => n.raw), ["45"]);
});

test("numbers: a claim with no numbers passes on the quote alone", () => {
  assert.equal(one({ text: "Routine panel.", sourceId: "a", quote: "The panel is routine." }).status, "pass");
});

test("checks run in order: quote failure is reported before number failure", () => {
  const v = one({ text: "Level of 99 mg/dL.", sourceId: "a", quote: "A made up sentence." });
  assert.equal(v.status, "quote_not_found");
});

test("one verdict per claim, in order, and malformed input throws a plain error", () => {
  const out = checkAnswer({
    claims: [
      { text: "a", sourceId: "a", quote: "The panel is routine." },
      { text: "b", quote: "x" },
    ],
    sources,
  });
  assert.deepEqual(out.map((v) => v.status), ["pass", "no_source"]);
  assert.throws(() => checkAnswer({ claims: "nope", sources }), /claims must be a list/);
  assert.throws(() => checkAnswer({ claims: [], sources: null }), /sources must be a list/);
  assert.throws(() => checkAnswer(), /claims must be a list/);
});

test("sample: 4 pass, 2 blocked, with the two planted errors", () => {
  const v = checkAnswer({ claims: sampleClaims, sources: sampleSources });
  assert.deepEqual(summarize(v), { total: 6, passed: 4, blocked: 2 });
  assert.equal(v[4].status, "quote_not_found");
  assert.match(v[4].closest.sentence, /^By age 5,/);
  assert.deepEqual(v[4].closest.diff.sentence.filter((w) => w.changed).map((w) => w.text), ["5,"]);
  assert.equal(v[5].status, "unknown_source");
});

test("sample sources: each links to a US government (.gov) page", () => {
  for (const s of sampleSources) assert.ok(s.url.startsWith("https://") && s.url.includes(".gov"));
});

test("parse: answer and sources round trip through the plain-text format", () => {
  const a = parseAnswer(formatAnswer(sampleClaims));
  const s = parseSources(formatSources(sampleSources));
  assert.deepEqual(a, sampleClaims);
  assert.deepEqual(s, sampleSources);
});

test("parse: bad input gives a plain message", () => {
  assert.throws(() => parseAnswer("   "), /empty/);
  assert.throws(() => parseAnswer("SOURCE: a\nQUOTE: b"), /no CLAIM/);
  assert.throws(() => parseSources("TITLE: x\nTEXT: y"), /no ID/);
  assert.throws(() => parseSources("ID: x"), /no TEXT/);
});

test("parse: a claim with no SOURCE line is read, then blocked by the checker", () => {
  const claims = parseAnswer("CLAIM: Something.");
  assert.equal(checkAnswer({ claims, sources })[0].status, "no_source");
});

test("parse: a wrapped line continues the previous field", () => {
  const [c] = parseAnswer("CLAIM: first part\nsecond part\nSOURCE: a\nQUOTE: q");
  assert.equal(c.text, "first part second part");
});
