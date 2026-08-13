# Adding real grades & attendance

Everything is scaffolded so that when the portal has real data, wiring it in is small
and localized. This is the map.

## Current state

| Data | Status | What's left |
|---|---|---|
| Student info, documents | ✅ live | nothing |
| Attendance | ✅ live (parser works) | verify the absence **row** shape against a real absence |
| Gradebook | ⛔ parser stub | implement `parseGradebook` once an active-term page is captured |

Both blocked cases already have a **sample** so the UI is fully built and demoable, and
both are **fallbacks** - real portal data always wins automatically once it exists. No UI,
schema, or grade-engine work remains for either; those are done.

## Previewing with sample data

Two dev flags, both off by default (production shows the honest "no grades yet" state,
never invented numbers):

```bash
VITE_DEMO=true npm run dev              # whole app signed-in on sample data - no relay, no login
VITE_PLACEHOLDER_DATA=true npm run dev  # real login; sample gradebook/attendance only as fallback
```

Sample data lives in `src/data/placeholders.js` and is validated against the domain schemas
at load; both paths are banner-flagged in the UI. Demo mode (`src/data/demo.js`) refuses to
load in a production build. With the placeholder flag, real portal data always wins once it
exists.

## What lights up automatically

Every grade feature - the grade-over-time chart, hypothetical edits/additions, impact
chips, the category overview, the target and max/min calculators, and the grade index -
consumes domain `Assignment`/`Category` shapes produced by `mapGradebook`
(`src/data/studentvue.js`). When `parseGradebook` lands, real data flows into all of them
with **zero feature work**. Two things to re-verify on first real data:

- Real category names and letters can be messier than the samples; the grade-index harvest
  already skips empty letters, and each sync tightens the inferred cutoffs automatically.
- Real gradebooks may hide assignments (category totals exceed the listed rows) - the
  hidden-points pseudo-rows and the overview's hidden flags cover that path.

## Gradebook - implement the parser

1. **Capture a real page** (grades must be back). Start the relay, then:
   ```bash
   RELAY_URL=ws://localhost:8080 \
   SYNERGY_DOMAIN=… SYNERGY_USERNAME=… SYNERGY_PASSWORD=… \
   npx tsx scripts/capture-gradebook.ts
   ```
   It writes `captures/gradebook.html` (+ `classgrades.html`) - **gitignored, real personal
   data, never commit.** The script reports how many `"dataSource":[…]` grids it found.

2. **Implement `parseGradebook`** in `src/portal/pages/gradebook/index.ts`. That function is
   the *only* missing piece; the block comment above it is a step-by-step with the exact
   tools (`findDataSourceWithKeys`, `extractJsonAfter`, `rawAssignmentToDomain`), the target
   `Gradebook` shape, and the score gotchas. Feed each raw assignment row to
   `rawAssignmentToDomain` - it already handles extra credit, earned zeros, not-for-grading,
   and scaled points. Validate the result with `GradebookSchema`.

3. **Verify** with the sample off: check a few courses' weighted and unweighted grades
   against the numbers the portal itself shows. When it returns real data, `getGradebook`
   stops using the sample with no other change.

## Attendance - verify the row shape

The parser works and the empty case is handled. The absence **row** field names
(`Date`, `AttAllDayReason`, `AttPeriods`, and the per-period `Period`/`Reason`/`Note`) are a
reconstruction from the grid config, unverified because the test account has no absences.

When a real absence exists:
1. Capture the page (`PXP2_Attendance.aspx`) the same way as above (add it to
   `scripts/capture-gradebook.ts`'s `PAGES` or fetch it manually).
2. Compare the real row keys to those read in `src/portal/pages/attendance.ts`
   (`toAbsence` / `toPeriods`) and adjust if they differ.
3. A row that can't be parsed is skipped and counted in `unreadableAbsences`, which the UI
   surfaces - so if that count climbs once real absences arrive, the row shape needs fixing.

## When both are done

Remove the `SAMPLE_GRADEBOOK` / `SAMPLE_ATTENDANCE` fallbacks from `src/data/api.js` and
the `meta.*.placeholder` banners in `src/components/SyncPill.jsx`, then delete this file.
Keep `src/data/placeholders.js` - demo mode (`VITE_DEMO`) still builds its snapshot from
it, and its consistency suite (`src/data/placeholders.test.ts`) keeps the sample honest.
