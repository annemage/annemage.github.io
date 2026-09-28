// Renders the website as a CV and writes it to cv.pdf. Serves the repo over
// a throwaway local HTTP server (the publication list is loaded with fetch(),
// which doesn't work from file://), waits for the publications to render,
// then prints the page with the print stylesheet in assets/css/style.css.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUTPUT_PATH = join(ROOT, "cv.pdf");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};

function startServer() {
  const server = createServer(async (req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const filePath = normalize(join(ROOT, urlPath === "/" ? "index.html" : urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(filePath);
      res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function main() {
  const server = await startServer();
  const { port } = server.address();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    await page.waitForSelector("#pub-list .pub-item", { timeout: 15000 });
    await page.emulateMedia({ media: "print" });

    const updated = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const footer =
      '<div style="font-size:8px;color:#62615d;width:100%;padding:0 16mm;display:flex;justify-content:space-between;">' +
      `<span>Anne-Marie George — CV, updated ${updated}</span>` +
      '<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>';

    await page.pdf({
      path: OUTPUT_PATH,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: footer,
    });
    console.log(`Wrote ${OUTPUT_PATH}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
