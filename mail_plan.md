# Mail Fix — Execution Plan

> **Status (2026-07-27): DONE, live-verified.** Track A shipped (`5a3321c`).
> Track B shipped across `1642c6f` → `560b409`.
>
> **B0 resolved the hard way — the original premise was wrong.** Synergy Mail is
> not scrapable at all: `PXP2_Messages.aspx` is a shell for a knockout app, so
> there is no `dataSource` grid to parse and no page capture would have helped.
> The real source is a JSON service, discovered by reading the portal's own
> `/js/PXP/PXP_SMBundle.js` and `CallOAuthService` in `/js/PXP/PXPPlugins.js`:
> `POST /st_api/ST.Messaging/{GetMessages,GetMessage}?PORTAL=3`, cookie-authed
> with a constant `Bearer authorized`, answering with JSON wrapped in an HTML
> `<div id="json-result">`. Attachments: `FileDownload.aspx?fdID=…&dbID=3`.
> The full field contract is in the `grademax-mail-status` memory.
>
> Live run against a real account: 50 messages, 0 unreadable, all dates ISO,
> bodies reduced to plain text, lazy-load and a 3.7 MB PDF attachment download
> both working, 3.5 s. Bodies are absent from the list response, so the sync
> prefetches 8 (4 concurrent — each browser request is its own relay TLS
> connection) and the reader loads the rest on open. `markAsRead` is always
> false so reading here never alters the real inbox.
>
> Sections 3-B0 and the `messages` capture entries below are obsolete, kept
> only as the record of how this was approached.

Goal: make Mail a real feature instead of a hardcoded placeholder, and restyle the
list to the Gmail-style card design in `Gmail-style mail design.pdf`. All work happens
in the non-test folders: `github/` (frontend, the deployed repo) and `local/` (capture
tooling). `github_test/` is not touched.

---

## 1. Where mail stands today

- **`github/src/pages/Mail.jsx`** hardcodes a 7-message `MAIL` array and renders an
  unconditional banner: *"Sample messages — Mail is not connected to StudentVUE yet."*
  `MailDetail.jsx` imports the same array to resolve `/mail/:mailId`. Nothing is synced.
- Mail is the **only section with no data path**. Every other section flows:
  `portal/pages/*` (in-browser PXP2 scraper over the blind relay) → Zod schema in
  `domain/` → `data/api.js` getter → `data/studentvue.js` `sync()` → snapshot →
  `SyncProvider` hook → page. Mail has no portal client, no domain schema, no snapshot
  field, no `meta.mail`, no hook, and no entry in the test account (`testAccount.js`)
  or demo data.
- The legacy SOAP mail API (`SynergyMailGetData` / `SynergyMailGetAttachment` in
  `documentation.md`) is **dead** — Edupoint deprecated the whole mobile SOAP API
  (`D5518-00`), which is why the app scrapes the PXP2 web portal. Mail must be scraped
  from the PXP2 messages module the same way documents/attendance are.
- The capture tooling in `local/` (`capture-portal-page.mjs`, `pull-real-data.mjs`)
  has **no messages page entry**, and no messages capture or fixture exists anywhere
  in the repo. The exact payload shape is unknown until we capture it.

So "fixing mail" = two independent tracks:

- **Track A — UI redesign (no backend needed).** Restyle the list to the PDF design.
  Works against the current placeholder data and later against real data unchanged.
- **Track B — real data (gated on a live capture).** Build the messages portal client
  and wire mail through the sync pipeline, with the test account carrying sample mail.

Track A can start immediately. Track B starts with a capture session.

---

## 2. Track A — Gmail-style list UI (`Mail.jsx`, `MailDetail.jsx`)

Target design (from the PDF): dark rounded cards, one per message —

1. **Subject** — large bold title (as today).
2. **Meta row** — plain muted text `Sender (Role) · 5/13/25`, *not* chips, followed
   inline by the count chips: green `N Link(s)` and purple `N Attachments`
   (chips keep the existing `link`/`attachment` tones; the person/date chips go away).
3. **Preview line** — first line of the body in muted text, single line, no wrap,
   fading out to the right edge (CSS `mask-image: linear-gradient(to right, black 70%, transparent)`
   on the text container — no overlay element needed on the card background).

Changes:

- **`github/src/pages/Mail.jsx`**
  - Rebuild the card body: subject → meta row → preview, per above. Keep the existing
    card box (`--color-surface-card`, `--radius-xl`, hover `--shadow-soft-drop`),
    the 820px column, and click-through to `/mail/:mailId`.
  - Derive the preview from the message body (first paragraph, entities decoded,
    whitespace collapsed).
  - Keep the sample-data banner for now; Track B replaces it with meta-driven state.
- **`github/src/pages/MailDetail.jsx`** — already close to the target reading pane.
  Only alignment tweaks: meta line format consistent with the list (`Sender (Role)`
  + date), links/attachments sections unchanged until Track B gives them real URLs.

Acceptance: `/mail` visually matches the PDF (subject weight, chip colors/order,
preview fade), in the existing dark theme tokens; list still sorts newest-first;
empty state unchanged.

---

## 3. Track B — real mail data

### Phase B0 — capture the PXP2 messages module (blocking, needs live credentials)

- Add a `messages` entry to `local/capture-portal-page.mjs` `PAGES` and
  `local/pull-real-data.mjs` `RESOURCES`. Likely URL is `PXP2_Messages.aspx?AGU=0` —
  confirm against the module list in a captured `Home_PXP2.aspx` before assuming.
- Capture with a live session (`SYNERGY_*` env vars, per `local/CLAUDE.md`). Inspect
  the embedded DevExpress `"dataSource"` grids and record the row keys (subject,
  sender, date, body/content, read flag, attachment tokens).
- Determine how the **full message body** is delivered: embedded in the list grid, or
  fetched per-message via an AJAX POST when a message opens. If the latter, capture
  that request/response too (browser devtools on the portal).
- Determine the **attachment download** mechanism (URL pattern + token), like
  `PXP_ShowDocument.aspx?docToken=` for documents.
- Sanitize a capture (`local/tools/sanitize-capture` flow, manual review mandatory)
  and commit it as a fixture for parser tests.
- Contingency: if the account has zero messages the grid will be `"dataSource":[]` —
  build the row mapping from the grid's column config as a reconstruction, flag it as
  unverified (same posture as attendance rows), and make bad rows degrade instead of
  failing the page.

### Phase B1 — domain model: `github/src/domain/mail.ts`

```
MailAttachmentSchema { token, name }
MailLinkSchema       { label, url }
MailMessageSchema    { id, subject, sender: { name, role, email },
                       date: IsoDateString, body (see below),
                       links: MailLink[], attachments: MailAttachment[] }
```

- Body representation: the portal sends HTML. Do **not** render raw HTML. Reduce it at
  parse time to plain-text paragraphs plus an extracted link list, using the existing
  `stripTags`/`decodeEntities` helpers — that is exactly the shape the current UI
  already renders (`body: string[]`, `links: []`), so no sanitizer dependency is
  needed. Field names are provisional until B0 confirms them.
- Export from `github/src/domain/index.ts`.

### Phase B2 — portal client: `github/src/portal/pages/mail.ts`

- `fetchMail(session, options)` modeled on `documents.ts`: `getPage` →
  `assertNotBounced(page, 'Messages')` → `findDataSourceWithKeys(...)` → map rows →
  `validate()` each row **individually**, skipping unparseable rows into an
  `unreadableMessages` count (the attendance lesson: report, never swallow).
- If B0 shows a per-message body fetch, add `fetchMailMessage(session, id)`; the sync
  then stores list metadata and `MailDetail` lazy-loads the body through it.
- `downloadMailAttachment(session, token)` mirroring `downloadDocument` (HTML response
  = expired token → `ModuleUnavailableError`).
- Export from `github/src/portal/pages/index.ts`. Colocated vitest tests against the
  sanitized fixture (list parse, entity decoding, bad-row degradation, empty grid).

### Phase B3 — data layer wiring

- **`github/src/data/api.js`** — `getMail()` via `withSession` (error mapping comes
  free); `downloadMailAttachment()` with a test-session short-circuit like
  `downloadDocument`'s.
- **`github/src/data/snapshot.js`** — add `mail: []` and
  `meta.mail: { ok: false, placeholder: false, message: '' }`.
- **`github/src/data/testAccount.js`** — add `TEST_MAIL`: move the 7 sample messages
  out of `Mail.jsx` here, validated against `MailMessageSchema` at import (typos fail
  loudly, same as the other test data).
- **`github/src/data/studentvue.js`** — add `api.getMail()` to the sync's
  `Promise.allSettled`; map domain → page shape (id, subject, sender, role, email,
  ISO date, preview, links, attachments); populate `meta.mail`; wire `TEST_MAIL`
  into `testSnapshot()` and `demoSnapshot()` (flagged placeholder). A mail failure
  must not sink the other resources — `allSettled` already guarantees this.
- **`github/src/data/SyncProvider.jsx`** — export `useMail()`.

### Phase B4 — pages consume the sync

- **`Mail.jsx`** — delete the hardcoded `MAIL` export; read `useMail()` +
  `useSyncMeta()`. Banner becomes state-driven: placeholder/test → sample-data
  banner; `meta.mail.ok === false` → the failure message; real data → no banner;
  empty → "No messages." Surface an unreadable-rows notice when the count is > 0.
- **`MailDetail.jsx`** — resolve the message from `useMail()` instead of the static
  import; links render as real `<a href target="_blank" rel="noreferrer">`;
  attachments become buttons that download/open via `downloadMailAttachment` (reuse
  the blob-URL open pattern from `Documents.jsx`, including the popup-blocked
  fallback).

### Phase B5 — verification & deploy

- `npm test` in `github/` green (new schema + parser + mapping tests included).
- Local run with the built-in test account (`test`/`test` at Hustler's University) or
  `VITE_DEMO=true`: mail list, detail, links, attachment path, banner states.
  Browser check via playwright-core over system Edge.
- Live pass against a real portal account once credentials are available: list parse,
  body, attachment download; confirm `unreadableMessages` stays 0.
- Deploy: commit/push **only inside `github/`**, authored by Tiger alone — **no
  co-author or generated-with lines**. If the push doesn't auto-trigger Pages, dispatch
  the deploy workflow via the GitHub REST API. Note: live (non-test) sign-in on prod
  still depends on the `VITE_RELAY_URL` Actions variable being set — unrelated to this
  work but it gates verifying real mail on the deployed site.

---

## 4. Suggested order

| # | Step | Depends on |
|---|------|------------|
| 1 | Track A UI redesign (list card per PDF) | nothing |
| 2 | B1 schema + B3 `TEST_MAIL` move + `useMail()` + B4 page wiring (test data flows through the real pipeline; the static `MAIL` array dies here) | 1 |
| 3 | B0 capture session | live credentials |
| 4 | B2 parser + fixtures + tests | 3 |
| 5 | B3 `getMail()` live path + B4 attachment downloads | 4 |
| 6 | B5 verification + deploy | 5 |

Steps 1–2 ship a complete, honest slice (test/demo accounts get mail through the same
pipeline as everything else; real accounts see the "not connected" meta message) even
before a capture session happens. Steps 3–6 turn it live.

## 5. Risks / open questions

- **Payload shape unknown** until B0: exact page URL, grid keys, body delivery
  (inline vs. AJAX), read/unread flag, attachment token format. B1's schema is
  provisional; adjust it in the same commit as the parser.
- **Zero-message account** → parser is a reconstruction (attendance precedent);
  degradation + `unreadableMessages` reporting is the safety net.
- **Districts can disable the messages module** → `assertNotBounced` throws
  `ModuleUnavailableError` → surfaces via `meta.mail.message`, other sections
  unaffected.
- **HTML bodies** vary; stripping to paragraphs + extracted links may lose formatting
  (bold, lists). Acceptable for v1; revisit only if real captures show heavy markup.
