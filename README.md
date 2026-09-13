# annemage.github.io

Personal academic website for Anne-Marie George, published via GitHub Pages.

## Structure

- `index.html` — the whole site (single scrolling page with section anchors)
- `assets/css/style.css` — styles
- `assets/js/main.js` — scroll-spy nav + publication list rendering
- `assets/data/publications.json` — publication list, refreshed automatically (see below)
- `assets/img/panorama.jpg` — footer photo
- `scripts/fetch-dblp.mjs` — pulls the publication list from DBLP
- `.github/workflows/update-publications.yml` — runs the fetch weekly and commits the result

## How the publication list stays up to date

`assets/data/publications.json` is regenerated automatically every Monday by
a GitHub Action, and can also be triggered manually from the
**Actions → Update publications from DBLP → Run workflow** button in GitHub.

It fetches from your DBLP profile: <https://dblp.org/pid/165/2974.html>.
Because dblp.org sits behind a bot-check (Anubis) that requires running a
small JavaScript challenge, the fetch script drives a real (headless)
Chromium browser via [Playwright](https://playwright.dev) rather than a
plain HTTP request — this is the one part of the pipeline most likely to
need attention if DBLP changes their setup.

If you publish a new paper, add it on DBLP as usual (or check
<https://dblp.org/faq/1474588.html> for how to add missing publications) —
it will appear on the site within a week, or immediately if you manually
run the workflow.

**Google Scholar is not scraped** — there is no official public API for it,
so the site just links out to your Scholar profile directly instead of
trying to pull data from it automatically.

## Updating content

- **Bio, research description, teaching, contact info:** edit the relevant
  `<section>` in `index.html` directly.
- **Panorama photo:** replace `assets/img/panorama.jpg` (keep it roughly
  2000–2400px wide, landscape orientation works best).
- **Manually correcting/adding a publication:** edit
  `assets/data/publications.json` directly — but note the next scheduled
  DBLP sync will overwrite anything not reflected on DBLP itself, so fix it
  at the source (DBLP) for anything permanent.

## Local preview

No build step — just serve the folder and open it in a browser (opening
`index.html` directly via `file://` will fail to load the publications list
due to browser CORS rules for local files):

```
npx serve .
```

## Publishing changes

This is a plain static site — commit and push to `main`, and GitHub Pages
serves the result at https://annemage.github.io/ within a minute or two.
