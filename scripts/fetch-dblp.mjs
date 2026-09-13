// Fetches Anne-Marie George's publication list from DBLP and writes it to
// assets/data/publications.json. Runs headless Chromium (via Playwright)
// because dblp.org sits behind an Anubis bot-check that requires executing
// a small proof-of-work challenge in a real browser before it will serve
// content to non-interactive clients (plain curl/fetch gets refused).
import { chromium } from "playwright";
import { XMLParser } from "fast-xml-parser";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const DBLP_PID = "165/2974";
const PROFILE_URL = `https://dblp.org/pid/${DBLP_PID}.html`;
const XML_URL = `https://dblp.org/pid/${DBLP_PID}.xml`;
const OUTPUT_PATH = fileURLToPath(new URL("../assets/data/publications.json", import.meta.url));

function toArray(x) {
  return x === undefined || x === null ? [] : Array.isArray(x) ? x : [x];
}

function textOf(x) {
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  if (x && typeof x === "object" && "#text" in x) return String(x["#text"]);
  return undefined;
}

function classify(tag, venue) {
  if (tag === "phdthesis" || tag === "mastersthesis") return "thesis";
  if (tag === "article") return venue && /^CoRR$/i.test(venue) ? "preprint" : "journal";
  if (tag === "inproceedings" || tag === "incollection") return "conference";
  return "other";
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  });

  await page.goto(PROFILE_URL, { waitUntil: "networkidle", timeout: 60000 });

  // The Anubis challenge briefly shows "Making sure you're not a bot!" before
  // solving itself and reloading the real page. Wait that out.
  await page
    .waitForFunction(() => !document.title.includes("Making sure"), { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(1500);

  const xml = await page.evaluate(async (url) => {
    const res = await fetch(url, { credentials: "include" });
    return res.text();
  }, XML_URL);

  await browser.close();

  if (!xml || xml.includes("Making sure you") || xml.trim().toLowerCase().startsWith("<!doctype html")) {
    throw new Error("DBLP did not return XML data (still behind bot-check?)");
  }

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml);
  const records = toArray(parsed?.dblpperson?.r);

  const parsedEntries = records
    .map((r) => {
      const tag = Object.keys(r).find((k) => k !== "@_" && typeof r[k] === "object");
      const entry = tag && r[tag];
      if (!entry) return null;

      const authors = toArray(entry.author)
        .map((a) => textOf(a))
        .filter(Boolean);
      const title = textOf(entry.title)?.replace(/\.$/, "");
      const venue = textOf(entry.booktitle) || textOf(entry.journal) || textOf(entry.school) || textOf(entry.note) || null;
      const year = entry.year ? parseInt(textOf(entry.year), 10) : null;
      const ees = toArray(entry.ee).map((e) => textOf(e));
      const key = entry["@_key"];
      const url = ees[0] || (key ? `https://dblp.org/rec/${key}.html` : null);

      if (!title || !year) return null;

      return { title, authors, venue, year, type: classify(tag, venue), url };
    })
    .filter(Boolean);

  // DBLP lists both the arXiv preprint and the final peer-reviewed version of
  // a paper as separate records. Collapse exact-title duplicates, preferring
  // the peer-reviewed (non-preprint) entry.
  function normalizeTitle(title) {
    const words = title.toLowerCase().replace(/\s+/g, " ").trim().split(" ");
    // DBLP occasionally has a singular/plural mismatch between a preprint's
    // title and its later camera-ready version (e.g. "Market" vs "Markets") —
    // strip a trailing "s" from the last word so those still collapse.
    words[words.length - 1] = words[words.length - 1].replace(/s$/, "");
    return words.join(" ");
  }

  const byTitle = new Map();
  for (const pub of parsedEntries) {
    const norm = normalizeTitle(pub.title);
    const existing = byTitle.get(norm);
    if (!existing || (existing.type === "preprint" && pub.type !== "preprint")) {
      byTitle.set(norm, pub);
    }
  }

  const publications = Array.from(byTitle.values()).sort((a, b) => b.year - a.year);

  if (!publications.length) {
    throw new Error("Parsed 0 publications from DBLP XML — refusing to overwrite existing data.");
  }

  const output = {
    generated_at: new Date().toISOString(),
    source: PROFILE_URL,
    author_name: "Anne-Marie George",
    publications,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${publications.length} publications to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
