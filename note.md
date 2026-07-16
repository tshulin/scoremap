# Portal data still needed

Updated July 16, 2026.

## Placeholder data (so the frontend can be built now)

Neither blocked resource stops frontend work. Both stand-ins are dev-only.

| Resource | Stand-in | How |
|---|---|---|
| Gradebook | `SAMPLE_GRADEBOOK` in `src/mock/placeholders.ts` | `PLACEHOLDER_DATA=true` |
| Attendance | the **real parser** over `attendance-absences.html` | `MOCK_WITH_ABSENCES=true` |

`npm run dev:mock` turns both on by default and prints which data is real.

The two are deliberately different mechanisms. Attendance has a working parser, so its
placeholder runs through it — that exercises real code. The gradebook has no parser and no
observed page, so its placeholder is a **domain-level object**, not invented HTML: a parser
written against made-up markup would only learn to read our own fiction, pass its own
tests, and be discarded the day real data arrives.

Safety, because invented grades reaching a student who thinks they are real is the worst
outcome here:

- `PLACEHOLDER_DATA` is off by default and `loadConfig` **throws** if it is on while
  `NODE_ENV=production`.
- Placeholder responses carry `X-Grademax-Placeholder: true`; the frontend should show a
  clear "sample data" banner on it. Real portal responses never carry it.
- The gradebook only falls back on `NoActiveGradingPeriodError` or `ParseError` — the two
  blocked states. A portal outage or auth failure still surfaces as an error, and each
  fallback logs `placeholder_served`.
- Because it is a fallback rather than a replacement, real grades win automatically once
  Part 7b lands and the term starts. No config change, no frontend change.

`SAMPLE_GRADEBOOK` is validated against `GradebookSchema` at import, and a test asserts
each course's stated `percentage` matches what `src/calc/` computes from its assignments —
otherwise the UI would show two different grades for one course. It covers extra credit, a
not-for-grading row, an ungraded assignment, an earned zero, scaled points, an unweighted
course, an empty course, and a weighted category with no graded work (the renormalization
case: Algebra II is 85%, not the 68% you get by treating ungraded Finals as a zero).

### To remove when real data lands

1. Delete `src/mock/placeholders.ts` and `src/mock/placeholders.test.ts`.
2. Drop the fallback in `src/api/routes/resources.ts` (`isGradebookBlocked`,
   `PLACEHOLDER_HEADER`) and its tests in `src/api/app.test.ts`.
3. Drop `placeholderData` from `src/api/config.ts` + its tests, and `PLACEHOLDER_DATA`
   from `src/mock/dev.ts`.
4. Tell the frontend to drop the `X-Grademax-Placeholder` banner.

## Gradebook

The gradebook cannot be parsed yet because the portal redirects
`PXP2_Gradebook.aspx?AGU=0` to `Home_PXP2.aspx` outside an active grading period. The
domain types are in place, but a live response is still needed to determine:

- how courses, marks, categories, and assignments are nested;
- whether assignment details come from the gradebook page, class detail page, or another
  request;
- how reporting-period selection works.

When grades are available again:

```bash
npx tsx tools/capture-portal-page.ts gradebook
npx tsx tools/capture-portal-page.ts gradebook-classdetail
npx tsx tools/pull-real-data.ts gradebook
npx tsx tools/sanitize-capture.ts captures/gradebook.html
```

Review the sanitized fixture before committing it. Then implement the page mapping and
period selection. Verify weighted and unweighted course calculations against the grades
shown by the portal.

Extra credit no longer needs live data to be safe: `isCalculable` was fixed on 2026-07-16
to accept an extra-credit assignment on `pointsEarned` alone (see the plan's Part 8 notes).
Both row shapes — with and without `ScoreMaxValue` — now count. Still confirm the totals
against the portal UI when real rows land, as part of the verification above.

## Attendance rows

The available account has no absences, so the portal returns an empty `dataSource`. The
empty result is implemented and tested. The grid configuration confirms these field
names:

| Field | Meaning |
|---|---|
| `Date` | absence date |
| `AttAllDayReason` | all-day reason |
| `AttPeriods` | per-period details |

The objects inside `AttPeriods` have not been observed. The rows in
`test/fixtures/portal/attendance-absences.html` are synthetic and only test the current
assumption that periods use `Period`, `Reason`, and `Note`.

Recheck attendance whenever live data is captured:

```bash
npx tsx tools/pull-real-data.ts attendance
npx tsx tools/capture-portal-page.ts attendance
```

If a populated row becomes available, sanitize it and update the parser and fixture. The
portal JavaScript referenced by the attendance grid may also reveal the period shape.

Before release, decide how to handle an unexpected row shape. Skipping an unreadable row
with a warning is preferable to failing the whole attendance response.

## Capture safety

- Keep raw captures in the ignored `captures/` directory.
- Run `tools/sanitize-capture.ts` before creating a fixture.
- Manually check every sanitized fixture for names, IDs, schools, teachers, and other
  identifying values.
- Do not reformat files in `test/fixtures/portal/`; their embedded markup and JSON are
  parser inputs.
