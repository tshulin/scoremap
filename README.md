# Grademax

A cleaner way for students to see their StudentVUE grades, attendance, and
documents — with live "what if" grade math.

This repository is the **web app** (React + Vite), deployed to GitHub Pages by
the workflow in `.github/workflows/`. Everything that touches your data runs
**in your browser** — including signing in to StudentVUE. A tiny **blind relay**
is the only server-side piece, and it can't read anything.

## What runs where

- **In your browser (this app)** — all UI, the grade engine (`src/calc/`), and
  the whole StudentVUE client: it runs a TLS 1.3 client (`subtls`) itself
  (`src/transport/`), logs in, and scrapes/parses the PXP2 portal
  (`src/portal/`, `src/extract/`) into the domain shapes in `src/domain/`.
- **On the server** — a ~150-line WebSocket↔TCP **relay** (a separate repo/deploy;
  not in this app). TLS terminates in your browser, so the relay only ever pipes
  ciphertext to `*.edupoint.com:443`. It never sees your password, cookies, or
  grades.

## Trust

- Your password is encrypted **in your browser** and sent straight to StudentVUE;
  the relay passes along bytes it can't read.
- Your password is never sent to our servers, stored, or logged. Only the
  short-lived portal session cookie is kept (in `sessionStorage`), never the
  password.
- The code that handles your password is this public repo, served by GitHub
  Pages — changing it would require a public commit.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
```

Run a relay locally (see the relay project) and point the app at it with
`VITE_RELAY_URL` (defaults to `ws://localhost:8080`). Production builds set
`VITE_RELAY_URL=wss://<your-relay-domain>`.

---

StudentVUE is a registered trademark of Edupoint Educational Systems LLC.
Grademax is an independent, unofficial tool and is not affiliated with or
endorsed by Edupoint Educational Systems LLC.
