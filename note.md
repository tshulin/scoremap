# Portal data still needed

Updated July 15, 2026.

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
