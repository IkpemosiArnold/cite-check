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

const SVG = "http://www.w3.org/2000/svg";
/** A 16px glyph from the sprite in index.html. */
function glyph(id, cls) {
  const s = document.createElementNS(SVG, "svg");
  s.setAttribute("class", cls);
  s.setAttribute("aria-hidden", "true");
  s.setAttribute("focusable", "false");
  const u = document.createElementNS(SVG, "use");
  u.setAttribute("href", "#" + id);
  s.append(u);
  return s;
}

/** Words with each run of differing words wrapped in one <mark>. Punctuation around a word stays outside the mark. Built with textContent only. */
function marked(parts) {
  const frag = document.createDocumentFragment();
  let run = null;
  parts.forEach((w, i) => {
    const [, lead, core, tail] = w.text.match(/^([("'\[]*)(.*?)([.,;:!?)"'\]]*)$/s);
    const changed = w.changed && core !== "";
    if (changed && run && !lead) {
      run.textContent += " " + core;
    } else {
      if (i) frag.append(" ");
      if (changed) {
        if (lead) frag.append(lead);
        run = el("mark", null, core);
        frag.append(run);
      } else {
        run = null;
        frag.append(w.text);
        return;
      }
    }
    if (tail) {
      frag.append(tail);
      run = null;
    }
  });
  return frag;
}

const safeUrl = (u) => (/^https?:\/\//i.test(u || "") ? u : "");

/** The source as its web address, short enough to read at a glance; the page title stays for screen readers. */
function sourceLink(src) {
  const label = src.title || src.id;
  const href = safeUrl(src.url);
  if (!href) return el("span", "cite", label);
  let host = "";
  try { host = new URL(href).hostname.replace(/^www\./, ""); } catch { /* keep the title */ }
  const a = el("a", "cite", host || label);
  a.href = href;
  a.rel = "noopener noreferrer";
  a.target = "_blank";
  a.title = label;
  a.append(el("span", "sr", (host ? `, ${label}` : "") + " (opens in a new tab)"));
  return a;
}

/** One label and value pair in the evidence list. */
function evRow(label, ...nodes) {
  const row = el("div", "ev-row");
  const dd = el("dd");
  dd.append(...nodes);
  row.append(el("dt", null, label), dd);
  return row;
}

/** The verdict in words: the failed check in ink, the checker's reason in grey. */
function why(verdict) {
  const p = el("p", "why");
  if (verdict.status === "quote_not_found") {
    p.append(el("span", "lead", "Quote not found word for word."));
    return p;
  }
  if (verdict.status !== "pass") {
    const label = STATUS_LABELS[verdict.status].replace(/^Blocked:\s*/, "");
    p.append(el("span", "lead", label.charAt(0).toUpperCase() + label.slice(1) + "."), " ");
  }
  p.append(verdict.reason);
  return p;
}

function renderRow(claim, verdict, sourceMap, i) {
  const ok = verdict.status === "pass";
  const li = el("li", "row " + (ok ? "is-pass" : "is-fail"));
  li.style.setProperty("--i", i);

  const head = el("button", "row-head");
  head.type = "button";
  head.id = `row-${i}`;
  head.setAttribute("aria-expanded", "false");
  head.setAttribute("aria-controls", `ev-${i}`);
  const status = el("span", "verdict");
  status.append(glyph(ok ? "g-pass" : "g-fail", "glyph"), el("span", null, ok ? "Holds" : "Blocked"));
  head.append(status, el("span", "claim", claim.text), glyph("g-chev", "chev"));

  const body = el("div", "evidence");
  body.id = `ev-${i}`;
  body.setAttribute("role", "region");
  body.setAttribute("aria-labelledby", head.id);
  body.hidden = true;

  const dl = el("dl", "ev");
  const src = sourceMap.get(String(claim.sourceId || "").trim());
  if (claim.quote) {
    const q = el("p", "quote");
    if (verdict.closest) q.append(marked(verdict.closest.diff.quote));
    else q.textContent = claim.quote;
    dl.append(evRow("Quote", q));
  }
  if (verdict.closest) {
    const s = el("p", "quote");
    s.append(marked(verdict.closest.diff.sentence));
    dl.append(evRow("Source", s, ...(src ? [sourceLink(src)] : [])));
  } else if (verdict.status === "quote_not_found") {
    const none = el("p", "none", "No matching sentence in the source.");
    dl.append(evRow("Source", none, ...(src ? [sourceLink(src)] : [])));
  } else if (src) {
    dl.append(evRow("Source", sourceLink(src)));
  }
  dl.append(evRow("Why", why(verdict)));
  body.append(dl);

  li.append(head, body);
  return li;
}

/* Open state. Phone: each row opens on its own. From 960px: one row at a time, evidence pinned right. */
const wide = matchMedia("(min-width: 960px)");
const rows = () => [...$("cards").children];

function setOpen(li, open) {
  li.classList.toggle("is-open", open);
  li.querySelector(".row-head").setAttribute("aria-expanded", String(open));
  li.querySelector(".evidence").hidden = !open;
}

function fitToWidth() {
  const all = rows();
  if (!wide.matches || !all.length) return;
  const keep = all.find((r) => r.classList.contains("is-open")) || all[0];
  all.forEach((r) => setOpen(r, r === keep));
}

$("cards").addEventListener("click", (e) => {
  const head = e.target.closest(".row-head");
  if (!head) return;
  const li = head.parentElement;
  const open = li.classList.contains("is-open");
  if (wide.matches) {
    if (!open) rows().forEach((r) => setOpen(r, r === li));
  } else {
    setOpen(li, !open);
  }
});
wide.addEventListener("change", fitToWidth);

function render(claims, sources, isSample, animate) {
  const verdicts = checkAnswer({ claims, sources });
  const { total, passed, blocked } = summarize(verdicts);
  const map = new Map(sources.map((s) => [String(s.id).trim(), s]));

  const summary = $("summary");
  summary.replaceChildren(el("span", "hold", `${passed} of ${total} ${passed === 1 ? "holds" : "hold"}`));
  if (blocked) summary.append(el("span", "sr", ". "), el("span", "blocked", `${blocked} blocked`));
  $("sample-note").hidden = !isSample;

  // Blocked claims first, each group in the answer's own order.
  const order = claims
    .map((_, i) => i)
    .sort((a, b) => (verdicts[a].status === "pass") - (verdicts[b].status === "pass") || a - b);
  const list = $("cards");
  list.classList.toggle("enter", !!animate);
  list.style.setProperty("--n", order.length);
  list.replaceChildren(...order.map((k, i) => renderRow(claims[k], verdicts[k], map, i)));

  const first = list.firstElementChild;
  if (first && (wide.matches || first.classList.contains("is-fail"))) setOpen(first, true);
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
    render(claims, sources, false, true);
    $("summary").scrollIntoView({ block: "start" });
  } catch (err) {
    showError(err && err.message ? err.message : "Something in the input could not be read.");
  }
}

$("question").textContent = `The boxes start with the sample: an answer to “${sample.question}” and the pages it cites. Paste your own over them.`;
fillSample();
$("cards").classList.add("undrawn");
render(sample.claims, sample.sources, true, false);
$("check").addEventListener("click", runOwn);
$("reset").addEventListener("click", () => {
  fillSample();
  showError("");
  render(sample.claims, sample.sources, true, true);
});

// Motion starts after the first paint, so nothing animates on load except the one underline draw.
const settle = new Promise((r) => setTimeout(r, 1200));
Promise.race([document.fonts ? document.fonts.ready : settle, settle]).then(() => {
  document.documentElement.classList.add("ready");
  setTimeout(() => requestAnimationFrame(() => $("cards").classList.remove("undrawn")), 250);
});
