import { checkAnswer, summarize, STATUS_LABELS } from "./checker.js";
import { parseAnswer, parseSources, formatAnswer, formatSources } from "./parse.js";
import * as sample from "./sample.js";

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** Words with the differing ones wrapped in <mark>. Built with textContent only. */
function marked(parts) {
  const frag = document.createDocumentFragment();
  parts.forEach((w, i) => {
    if (i) frag.append(" ");
    if (w.changed) frag.append(el("mark", null, w.text));
    else frag.append(w.text);
  });
  return frag;
}

const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");

function section(card, title, node) {
  card.append(el("h3", null, title), node);
}

function renderCard(claim, verdict, sourceMap) {
  const ok = verdict.status === "pass";
  const li = el("li");
  const d = el("details", "card " + (ok ? "pass" : "blocked"));
  const s = el("summary");
  s.append(el("span", "mark", ok ? "✓ PASS" : "✗ BLOCKED"), el("span", "claim", claim.text));
  d.append(s);

  const body = el("div", "detail");
  section(body, "Why", el("p", null, `${STATUS_LABELS[verdict.status]}. ${verdict.reason}`));
  if (claim.quote) {
    const q = el("p", "quote");
    if (verdict.closest) q.append(marked(verdict.closest.diff.quote));
    else q.textContent = claim.quote;
    section(body, "Quote cited", q);
  }
  if (verdict.closest) {
    const p = el("p", "quote");
    p.append(marked(verdict.closest.diff.sentence));
    section(body, "Closest sentence in the source", p);
    body.append(el("p", "hint", "Marked words differ between the quote and the source."));
  }
  const src = sourceMap.get(String(claim.sourceId || "").trim());
  if (src) {
    const href = safeUrl(src.url);
    if (href) {
      const a = el("a", "link", src.title || src.id);
      a.href = href;
      a.rel = "noopener noreferrer";
      a.target = "_blank";
      section(body, "Source", a);
    } else {
      section(body, "Source", el("p", null, src.title || src.id));
    }
  } else if (claim.sourceId) {
    section(body, "Source", el("p", null, `"${claim.sourceId}" is not in the sources.`));
  } else {
    section(body, "Source", el("p", null, "None given."));
  }
  d.append(body);
  li.append(d);
  return li;
}

function render(claims, sources, isSample) {
  const verdicts = checkAnswer({ claims, sources });
  const { total, passed, blocked } = summarize(verdicts);
  const map = new Map(sources.map((s) => [String(s.id).trim(), s]));
  $("summary").textContent = `${passed} of ${total} claims pass. ${blocked} blocked.`;
  $("sample-note").hidden = !isSample;
  $("question").hidden = !isSample;
  const list = $("cards");
  list.replaceChildren(...claims.map((c, i) => renderCard(c, verdicts[i], map)));
}

function fillSample() {
  $("answer-in").value = formatAnswer(sample.claims);
  $("sources-in").value = formatSources(sample.sources);
}

function showError(msg) {
  const e = $("error");
  e.textContent = msg;
  e.hidden = !msg;
}

function runOwn() {
  try {
    const claims = parseAnswer($("answer-in").value);
    const sources = parseSources($("sources-in").value);
    showError("");
    render(claims, sources, false);
    $("summary").scrollIntoView({ block: "start" });
  } catch (err) {
    showError(err && err.message ? err.message : "Something in the input could not be read.");
  }
}

$("question").textContent = "Question: " + sample.question;
fillSample();
render(sample.claims, sample.sources, true);
$("check").addEventListener("click", runOwn);
$("reset").addEventListener("click", () => {
  fillSample();
  showError("");
  render(sample.claims, sample.sources, true);
});
