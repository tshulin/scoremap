# E1–E12 completion audit

Last verified: 2026-07-24

| Batch | States | Scope checked | CSV rows | Confirmed | Probable | Inactive/migrated | Unresolved | Removed |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| E1 | New York | 1,071 | 15 | 8 | 7 | 0 | 0 | 0 |
| E2 | Illinois | 1,031 | 11 | 11 | 0 | 0 | 0 | 2 |
| E3 | Ohio | 1,057 | 0 | 0 | 0 | 0 | 0 | 0 |
| E4 | Pennsylvania | 786 | 21 | 20 | 1 | 0 | 0 | 1 |
| E5 | New Jersey, Delaware | 743 | 0 | 0 | 0 | 0 | 0 | 0 |
| E6 | Michigan | 882 | 61 | 52 | 9 | 0 | 0 | 11 |
| E7 | Wisconsin, Indiana | 912 | 5 | 4 | 1 | 0 | 0 | 1 |
| E8 | Florida, Georgia, South Carolina | 431 | 6 | 3 | 2 | 1 | 0 | 0 |
| E9 | North Carolina, Virginia, Maryland, West Virginia | 655 | 20 | 20 | 0 | 0 | 0 | 3 |
| E10 | Tennessee, Kentucky, Mississippi, Alabama | 633 | 44 | 7 | 37 | 0 | 0 | 1 |
| E11 | Massachusetts, Connecticut, Rhode Island | 699 | 0 | 0 | 0 | 0 | 0 | 0 |
| E12 | Maine, New Hampshire, Vermont | 675 | 5 | 5 | 0 | 0 | 0 | 0 |

Total final tenant rows: 188
Schema/status/date/duplicate validation: PASS

## Source and coverage notes

- LEA universe: official NCES 2024–25 preliminary CCD directory (May 14, 2025 release).
- Vendor discovery: Edupoint's public mobile-app district lookup, queried using every unique current LEA office ZIP in each batch.
- Verification: direct StudentVUE portal behavior, district-controlled StudentVUE/Synergy pages, and broad state/name searches.
- Empty batch CSVs are intentional researched results: no current, in-scope Edupoint StudentVUE tenants survived verification.
- Rhode Island LEAs were absent from the preliminary NCES extract; the supplied state-list scope plus broad searches were used for the E11 audit.
- Distinct program tenants operated by one LEA remain separate rows when their StudentVUE base/login paths differ.
- Registry candidates that were private schools, adult programs, operators, non-LEA cooperatives, closed charters, or exact duplicate tenants were removed.

## Validation

- All 12 CSVs have the exact required 12-column schema.
- Every status is from the permitted vocabulary.
- Every row uses the verification date 2026-07-24.
- No exact StudentVUE tenant is duplicated within or across batches.
- Confirmed-current rows have NCES LEA IDs and evidence URLs.
