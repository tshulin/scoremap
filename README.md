# Scoremap

Scoremap was a web app for viewing school grades, attendance, and documents,
with live "what if" grade math. **It is no longer in service.**

All connections to external school systems and all supporting server code have
been removed from this repository. The related servers have been shut down.
Nothing here connects to any school information system.

What remains is the interface and the grade engine, running on bundled sample
fictional data so the app can still be viewed and the math can still be read.

## What's still here

- `src/calc/` - the grade engine: category weighting, hypothetical scores,
  target solving, max/min bounds, and the learned letter-cutoff index.
- `src/pages/`, `src/components/` - the interface.
- `src/data/testAccount.js`, `src/data/displayAccount.js` - the sample
  students. Both are invented; no real student's data appears anywhere in this
  repository.
- `src/data/sync.js` - assembles a sample account's snapshot. It makes no
  network requests.

## Grade tools

Each class page derives everything from the sample assignments, in the browser:

- **Grade over time** - replayed from the assignment dates; hover a point to
  see that day's work.
- **Hypothetical mode** - edit any score or add what-if assignments; the grade,
  chart, impact chips, and overview update live.
- **Overview** - per-category current %, its *effective* share of the final
  grade (a Finals category with no grades yet is 0% of today's grade), and its
  contribution to the course %.
- **Target calculator** - pick several upcoming assignments and a target grade;
  it solves the one uniform percentage that gets there, and re-solves around
  any score you lock in.
- **Max/min** - bounds on the final grade from the points still to come.
- **Grade index** - per-teacher letter cutoffs, inferred from the letters in
  the sample data, overridable per class.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest - grade engine + sample-data consistency
```

The app opens its demo from the landing page. `VITE_DEMO=true npm run dev`
starts it already signed in to the sample data.

---

Scoremap is an independent project. It is not affiliated with, endorsed by, or
connected to any school district, school information system, or their vendors.
