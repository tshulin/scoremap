Conduct exhaustive web research for batch [BATCH ID], covering these states:

[STATES]

GOAL

Identify every current public K–12 school district or public local education
agency in these states that uses Edupoint Synergy SIS and provides StudentVUE
to students. Record the district’s canonical StudentVUE portal link.

SCOPE

Include:
- Traditional public school districts
- Unified, union, independent, county and municipal school systems
- Public charter LEAs only when they operate their own separate StudentVUE tenant
- State-operated public K–12 systems when they have a separate StudentVUE tenant

Exclude:
- Private schools
- Colleges and universities
- Individual schools that merely use their parent district’s portal
- ParentVUE-only pages unless a StudentVUE login is also available
- Former, migrated, decommissioned or clearly inactive portals
- Results that mention “synergy” in an unrelated sense

RESEARCH METHOD

1. Establish the complete district universe using the latest available official
   NCES CCD directory or the relevant state department of education directory.

2. Run broad discovery searches, including variations of:
   - "StudentVUE" "[STATE]"
   - "Synergy SIS" "school district" "[STATE]"
   - "StudentVUE Account Access" "[STATE]"
   - "ParentVUE and StudentVUE Access" "[STATE]"
   - site:edupoint.com inurl:PXP2_Login_Student.aspx "[STATE]"
   - inurl:studentvue "school district" "[STATE]"
   - site:k12.[STATE DOMAIN] StudentVUE
   - site:[STATE EDUCATION DOMAIN] StudentVUE

3. Perform a district-by-district completeness audit. For every district in the
   official directory, search:
   - "[FULL DISTRICT NAME]" StudentVUE
   - "[FULL DISTRICT NAME]" Synergy SIS
   - "[FULL DISTRICT NAME]" ParentVUE
   - site:[DISTRICT DOMAIN] StudentVUE
   Do not assume that broad search results found every district.

4. Verify every positive result. Strong confirmation requires:
   - A working StudentVUE login page naming the district; or
   - An official district webpage linking to StudentVUE; or
   - Both, whenever possible.

5. Portal recognition signals include:
   - “StudentVUE Account Access”
   - “ParentVUE and StudentVUE Access”
   - “Synergy Accessibility”
   - PXP2_Login_Student.aspx
   - A visible StudentVUE student-login option
   Do not restrict results to edupoint.com because districts can use custom
   StudentVUE domains.

6. Open each portal. Do not record a URL based only on a search-result snippet.
   Prefer the canonical HTTPS StudentVUE URL. Remove temporary parameters such
   as session IDs, authentication tokens and tracking parameters.

7. If the page provides a “Mobile App URL,” record that separately. Do not use a
   temporary SAML or Microsoft/Google SSO redirect as the canonical portal URL.

8. Deduplicate district aliases, abbreviations, renamed districts, regional
   consortium pages and multiple URLs that point to the same tenant.

OUTPUT

Return a CSV-compatible table with exactly these columns:

state
district_name
district_type
nces_lea_id
studentvue_login_url
mobile_app_base_url
district_studentvue_information_url
evidence_url
evidence_title
verification_status
last_verified
notes

Use one row per distinct district-operated StudentVUE tenant.

For verification_status, use only:
- Confirmed current
- Probable — needs manual verification
- Inactive or migrated
- Unresolved

After the table, provide a completion audit:

- Official districts/LEAs in scope
- Districts individually checked
- Confirmed current Synergy/StudentVUE districts
- Probable results
- Inactive or migrated results
- Unresolved districts
- Duplicate or shared-tenant cases removed

COMPLETENESS RULE

Do not describe the results as exhaustive unless every district in the official
directory was checked. If output limits prevent completing the batch, stop at a
clear alphabetical boundary, report the exact stopping point and continue in a
subsequent response without repeating completed districts.

CITATION RULE

Every confirmed row must contain at least one working evidence URL. Prefer
official district websites and live StudentVUE portals over blogs, app-directory
pages, social media or third-party school directories.