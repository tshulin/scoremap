# Grademax

A cleaner way for students to see their StudentVUE grades, attendance, and
documents — with live "what if" grade math.

This repository is the **web app** (React + Vite), deployed to GitHub Pages by
the workflow in `.github/workflows/`. It talks to a small backend API that
signs in to StudentVUE server-side and scrapes the modern PXP2 portal; the
backend is deployed separately and is not part of this repository's tip
(its history is preserved in this repo's log).

## What runs where

- **In your browser (this app)** — all UI, plus the grade engine
  (`src/calc/`): course grades, weighted-category math, per-assignment grade
  impact, and hypothetical-score recalculation. The API data shapes it
  computes over live in `src/domain/`.
- **On the server** — only what a browser cannot do: logging in to
  StudentVUE, holding the session, and scraping/parsing portal pages.

## Development

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api to localhost:3000
```

The dev proxy expects the backend on port 3000. Build with
`VITE_API_BASE=<backend url>/api npm run build` to point a production build at
a hosted backend.

---

StudentVUE is a registered trademark of Edupoint Educational Systems LLC.
Grademax is an independent, unofficial tool and is not affiliated with or
endorsed by Edupoint Educational Systems LLC.
