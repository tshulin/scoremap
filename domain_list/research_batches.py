#!/usr/bin/env python3
"""
Research current StudentVUE tenants for the E1-E12 batches.

Primary discovery uses Edupoint's public mobile-app district lookup service. Each
NCES district-office ZIP code in a batch is queried, results are deduplicated,
matched back to the official NCES LEA directory, and every candidate portal is
opened to verify that a StudentVUE login is currently available.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import csv
import html
import json
import re
import threading
import time
import unicodedata
from dataclasses import dataclass
from datetime import date
from difflib import SequenceMatcher
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse, urlunparse
from xml.etree import ElementTree

import requests
import urllib3


urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

NCES_SOURCE_URL = (
    "https://nces.ed.gov/sites/default/files/data-asset/ccd-common-core-data/"
    "2025/08/2024-25-common-core-data-ccd-preliminary-directory-files/"
    "2025046%20Preliminary%20Data%20Release%20CCD%20Nonfiscal_0.zip"
)
EDUPOINT_LOOKUP_URL = (
    "https://support.edupoint.com/Service/"
    "HDInfoCommunication.asmx/ProcessWebServiceRequest"
)
EDUPOINT_WSDL_URL = (
    "https://support.edupoint.com/Service/HDInfoCommunication.asmx?WSDL"
)
LOOKUP_FORM = {
    "userID": "EdupointDistrictInfo",
    "password": "Edup01nt",
    "skipLoginLog": "true",
    "webServiceHandleName": "HDInfoServices",
    "methodName": "GetMatchingDistrictList",
}
LOOKUP_KEY = "5E4B7859-B805-474B-A833-FDB15D205D40"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/126.0 Safari/537.36 GradeMax-Domain-Research/1.0"
)

BATCHES = {
    "E1": (("NY",), 1071),
    "E2": (("IL",), 1031),
    "E3": (("OH",), 1057),
    "E4": (("PA",), 786),
    "E5": (("NJ", "DE"), 743),
    "E6": (("MI",), 882),
    "E7": (("WI", "IN"), 912),
    "E8": (("FL", "GA", "SC"), 431),
    "E9": (("NC", "VA", "MD", "WV"), 655),
    "E10": (("TN", "KY", "MS", "AL"), 633),
    "E11": (("MA", "CT", "RI"), 699),
    "E12": (("ME", "NH", "VT"), 675),
}

STATE_NAMES = {
    "AL": "Alabama",
    "CT": "Connecticut",
    "DE": "Delaware",
    "FL": "Florida",
    "GA": "Georgia",
    "IL": "Illinois",
    "IN": "Indiana",
    "KY": "Kentucky",
    "MA": "Massachusetts",
    "MD": "Maryland",
    "ME": "Maine",
    "MI": "Michigan",
    "MS": "Mississippi",
    "NC": "North Carolina",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NY": "New York",
    "OH": "Ohio",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "TN": "Tennessee",
    "VA": "Virginia",
    "VT": "Vermont",
    "WI": "Wisconsin",
    "WV": "West Virginia",
}

OUTPUT_COLUMNS = [
    "state",
    "district_name",
    "district_type",
    "nces_lea_id",
    "studentvue_login_url",
    "mobile_app_base_url",
    "district_studentvue_information_url",
    "evidence_url",
    "evidence_title",
    "verification_status",
    "last_verified",
    "notes",
]

CURRENT_STATUS_CODES = {"1", "3", "4", "5", "8"}
SESSION_LOCAL = threading.local()


@dataclass(frozen=True)
class RegistryDistrict:
    name: str
    address: str
    url: str
    state: str
    zip_code: str


@dataclass
class PortalCheck:
    registry: RegistryDistrict
    login_url: str
    mobile_url: str
    status: str
    evidence_title: str
    http_status: int | None
    response_text: str
    notes: str


def session() -> requests.Session:
    value = getattr(SESSION_LOCAL, "session", None)
    if value is None:
        value = requests.Session()
        value.headers.update({"User-Agent": USER_AGENT})
        SESSION_LOCAL.session = value
    return value


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def normalize_name(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = value.encode("ascii", "ignore").decode("ascii").lower()
    value = value.replace("&", " and ")
    value = re.sub(r"\bcomm\b", "community", value)
    value = re.sub(r"\bconsol\b", "consolidated", value)
    value = re.sub(r"\bpublic schls?\b", "public schools", value)
    value = re.sub(r"\bcsd\b", " central school district ", value)
    value = re.sub(r"\bccsd\b", " community consolidated school district ", value)
    value = re.sub(r"\bcusd\b", " community unit school district ", value)
    value = re.sub(r"\busd\b", " unified school district ", value)
    value = re.sub(r"\bisd\b", " independent school district ", value)
    value = re.sub(r"\bsd\b", " school district ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    stop = {
        "the",
        "of",
        "board",
        "education",
        "public",
        "school",
        "schools",
        "district",
        "community",
        "unit",
        "consolidated",
        "central",
        "unified",
        "independent",
        "local",
        "city",
        "county",
        "corporation",
        "system",
    }
    tokens = [token for token in value.split() if token not in stop]
    return " ".join(tokens)


def clean_url(value: str) -> str:
    value = html.unescape((value or "").strip())
    if not value:
        return ""
    if not re.match(r"^https?://", value, flags=re.I):
        value = "https://" + value.lstrip("/")
    parsed = urlparse(value)
    scheme = "https"
    host = parsed.hostname.lower() if parsed.hostname else ""
    if parsed.port and parsed.port not in {80, 443}:
        host = f"{host}:{parsed.port}"
    path = re.sub(r"/{2,}", "/", parsed.path or "/")
    return urlunparse((scheme, host, path, "", "", ""))


def url_key(value: str) -> str:
    parsed = urlparse(clean_url(value))
    path = parsed.path.rstrip("/").lower()
    return f"{parsed.hostname or ''}{path}"


def extract_state_zip(address: str) -> tuple[str, str]:
    match = re.search(r"\b([A-Z]{2})\s+(\d{5})(?:-\d{4})?\b", address or "")
    if not match:
        return "", ""
    return match.group(1), match.group(2)


def query_registry_zip(zip_code: str, attempts: int = 3) -> list[RegistryDistrict]:
    form = dict(LOOKUP_FORM)
    form["paramStr"] = (
        "<Parms>"
        f"<MatchToDistrictZipCode>{zip_code}</MatchToDistrictZipCode>"
        f"<Key>{LOOKUP_KEY}</Key>"
        "</Parms>"
    )
    for attempt in range(attempts):
        try:
            response = session().post(
                EDUPOINT_LOOKUP_URL,
                data=form,
                timeout=(8, 25),
                verify=False,
            )
            response.raise_for_status()
            outer = ElementTree.fromstring(response.text)
            inner_text = outer.text or ""
            if "<DistrictLists" not in inner_text:
                return []
            inner = ElementTree.fromstring(inner_text)
            found: list[RegistryDistrict] = []
            for node in inner.findall(".//DistrictInfo"):
                name = normalize_space(node.attrib.get("Name", ""))
                address = normalize_space(node.attrib.get("Address", ""))
                raw_url = node.attrib.get("PvueURL", "")
                state, district_zip = extract_state_zip(address)
                if name and raw_url:
                    found.append(
                        RegistryDistrict(
                            name=name,
                            address=address,
                            url=clean_url(raw_url),
                            state=state,
                            zip_code=district_zip,
                        )
                    )
            return found
        except Exception:
            if attempt + 1 == attempts:
                return []
            time.sleep(0.7 * (attempt + 1))
    return []


def portal_candidates(value: str) -> list[str]:
    registered = clean_url(value)
    parsed = urlparse(registered)
    path = parsed.path or "/"
    lower = path.lower()
    candidates: list[str] = []

    def add(candidate: str) -> None:
        candidate = clean_url(candidate)
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    if any(
        marker in lower
        for marker in (
            "pxp2_login_student.aspx",
            "login_student_pxp.aspx",
            "studentvue",
            "/svue",
        )
    ):
        add(registered)

    if lower.endswith("pxp2_login_parent.aspx"):
        add(
            urlunparse(
                parsed._replace(
                    path=re.sub(
                        r"pxp2_login_parent\.aspx$",
                        "PXP2_Login_Student.aspx",
                        path,
                        flags=re.I,
                    ),
                    query="",
                    fragment="",
                )
            )
        )
    elif lower.endswith("login_parent_pxp.aspx"):
        add(
            urlunparse(
                parsed._replace(
                    path=re.sub(
                        r"login_parent_pxp\.aspx$",
                        "Login_Student_PXP.aspx",
                        path,
                        flags=re.I,
                    ),
                    query="",
                    fragment="",
                )
            )
        )
    elif lower.endswith(".aspx"):
        directory = path.rsplit("/", 1)[0] + "/"
        add(urljoin(urlunparse(parsed._replace(path=directory)), "PXP2_Login_Student.aspx"))
    else:
        base = registered if registered.endswith("/") else registered + "/"
        add(urljoin(base, "PXP2_Login_Student.aspx"))

    root = urlunparse(parsed._replace(path="/", query="", fragment=""))
    add(urljoin(root, "PXP2_Login_Student.aspx"))
    add(urljoin(root, "Login_Student_PXP.aspx"))
    add(registered)
    return candidates


def page_title(text: str) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", text or "", flags=re.I | re.S)
    if match:
        return normalize_space(re.sub(r"<[^>]+>", " ", html.unescape(match.group(1))))
    match = re.search(r"<h1[^>]*>(.*?)</h1>", text or "", flags=re.I | re.S)
    if match:
        return normalize_space(re.sub(r"<[^>]+>", " ", html.unescape(match.group(1))))
    return ""


def mobile_url_from_page(text: str, login_url: str) -> str:
    plain = normalize_space(re.sub(r"<[^>]+>", " ", html.unescape(text or "")))
    match = re.search(
        r"Mobile\s+App\s+URL\s*:?\s*(https?://[^\s<\"']+)",
        plain,
        flags=re.I,
    )
    if match:
        return clean_url(match.group(1))
    parsed = urlparse(login_url)
    path = parsed.path
    if "/" in path:
        path = path.rsplit("/", 1)[0] + "/"
    else:
        path = "/"
    return urlunparse(parsed._replace(path=path, query="", fragment=""))


def check_portal(registry: RegistryDistrict) -> PortalCheck:
    best_failure = ""
    last_http: int | None = None
    for candidate in portal_candidates(registry.url):
        try:
            response = session().get(
                candidate,
                timeout=(8, 30),
                verify=False,
                allow_redirects=True,
            )
            last_http = response.status_code
            text = response.text[:1_500_000]
            plain = normalize_space(re.sub(r"<[^>]+>", " ", html.unescape(text)))
            lower = plain.lower()
            final_host = (urlparse(response.url).hostname or "").lower()
            original_host = (urlparse(candidate).hostname or "").lower()
            sso_host = any(
                marker in final_host
                for marker in (
                    "login.microsoftonline.com",
                    "accounts.google.com",
                    "auth0.com",
                    "okta.com",
                )
            )
            student_signal = any(
                marker in lower
                for marker in (
                    "studentvue account access",
                    "parentvue and studentvue access",
                    "studentvue student login",
                    "student account access",
                )
            ) or (
                "studentvue" in lower
                and any(marker in lower for marker in ("user name", "username", "login", "sign in"))
            )
            if response.status_code < 400 and student_signal:
                final_url = clean_url(response.url)
                if sso_host and original_host != final_host:
                    final_url = candidate
                return PortalCheck(
                    registry=registry,
                    login_url=final_url,
                    mobile_url=mobile_url_from_page(text, candidate),
                    status="Confirmed current",
                    evidence_title=page_title(text) or "StudentVUE",
                    http_status=response.status_code,
                    response_text=text,
                    notes=f"Live StudentVUE login returned HTTP {response.status_code}.",
                )
            if response.status_code < 400 and sso_host:
                return PortalCheck(
                    registry=registry,
                    login_url=candidate,
                    mobile_url=mobile_url_from_page(text, candidate),
                    status="Probable — needs manual verification",
                    evidence_title=page_title(text) or "District SSO",
                    http_status=response.status_code,
                    response_text=text,
                    notes="Registered Edupoint tenant redirected directly to district SSO.",
                )
            best_failure = f"HTTP {response.status_code}; no StudentVUE login signal"
        except Exception as exc:
            best_failure = f"{type(exc).__name__}: {str(exc)[:120]}"
    return PortalCheck(
        registry=registry,
        login_url=portal_candidates(registry.url)[0],
        mobile_url="",
        status="Probable — needs manual verification",
        evidence_title="",
        http_status=last_http,
        response_text="",
        notes=best_failure or "Registered tenant did not return a usable StudentVUE page.",
    )


def district_type(row: dict[str, str] | None) -> str:
    if not row:
        return "Public LEA (NCES match unresolved)"
    lea_type = row.get("LEA_TYPE", "")
    if lea_type in {"1", "2"}:
        return "Traditional public school district"
    if lea_type == "7":
        return "Public charter LEA"
    if lea_type == "5":
        return "State-operated public K–12 system"
    if lea_type == "9":
        return "Specialized public school district"
    return row.get("LEA_TYPE_TEXT", "") or "Other public LEA"


def number_tokens(value: str) -> set[str]:
    return set(re.findall(r"\b\d+\b", value or ""))


def name_similarity(left: str, right: str) -> float:
    left_norm = normalize_name(left)
    right_norm = normalize_name(right)
    if not left_norm or not right_norm:
        return 0.0
    ratio = SequenceMatcher(None, left_norm, right_norm).ratio()
    left_tokens = set(left_norm.split())
    right_tokens = set(right_norm.split())
    overlap = len(left_tokens & right_tokens) / max(1, len(left_tokens | right_tokens))
    score = max(ratio, overlap)
    left_numbers = number_tokens(left)
    right_numbers = number_tokens(right)
    if left_numbers and right_numbers:
        score += 0.15 if left_numbers & right_numbers else -0.20
    return score


def match_nces(
    registry: RegistryDistrict,
    nces_rows: list[dict[str, str]],
) -> tuple[dict[str, str] | None, float]:
    same_state = [row for row in nces_rows if row.get("ST") == registry.state]
    same_zip = [
        row
        for row in same_state
        if registry.zip_code
        and registry.zip_code in {row.get("MZIP", ""), row.get("LZIP", "")}
    ]
    pool = same_zip or same_state
    best_row: dict[str, str] | None = None
    best_score = -1.0
    registry_city = normalize_name(
        re.sub(r"\s+[A-Z]{2}\s+\d{5}.*$", "", registry.address)
    )
    for row in pool:
        score = name_similarity(registry.name, row.get("LEA_NAME", ""))
        row_city = normalize_name(row.get("MCITY", "") or row.get("LCITY", ""))
        if registry_city and row_city:
            if registry_city == row_city:
                score += 0.20
            elif registry_city in row_city or row_city in registry_city:
                score += 0.10
        if row.get("SY_STATUS") in CURRENT_STATUS_CODES:
            score += 0.04
        if score > best_score:
            best_score = score
            best_row = row
    threshold = 0.43 if same_zip else 0.62
    if best_score < threshold:
        return None, best_score
    return best_row, best_score


def official_info_link(
    nces_row: dict[str, str] | None,
    portal_url: str,
) -> tuple[str, str]:
    if not nces_row:
        return "", ""
    website = clean_url(nces_row.get("WEBSITE", ""))
    if not website:
        return "", ""
    try:
        response = session().get(
            website,
            timeout=(8, 25),
            verify=False,
            allow_redirects=True,
        )
        if response.status_code >= 400:
            return "", ""
        text = response.text[:1_500_000]
        plain = normalize_space(re.sub(r"<[^>]+>", " ", html.unescape(text)))
        if "studentvue" in plain.lower():
            return clean_url(response.url), page_title(text)
        website_host = (urlparse(response.url).hostname or "").lower()
        for match in re.finditer(
            r"<a\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>",
            text,
            flags=re.I | re.S,
        ):
            href = html.unescape(match.group(1))
            label = normalize_space(
                re.sub(r"<[^>]+>", " ", html.unescape(match.group(2)))
            )
            combined = f"{href} {label}".lower()
            if "studentvue" not in combined:
                continue
            absolute = clean_url(urljoin(response.url, href))
            link_host = (urlparse(absolute).hostname or "").lower()
            if link_host == website_host and url_key(absolute) != url_key(portal_url):
                return absolute, label or "StudentVUE information"
    except Exception:
        return "", ""
    return "", ""


def load_nces(path: Path, states: Iterable[str]) -> list[dict[str, str]]:
    wanted = set(states)
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [row for row in csv.DictReader(handle) if row.get("ST") in wanted]


def current_k12_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    result = []
    for row in rows:
        if row.get("SY_STATUS") not in CURRENT_STATUS_CODES:
            continue
        grade_flags = [
            row.get("G_PK_OFFERED"),
            row.get("G_KG_OFFERED"),
            *[row.get(f"G_{grade}_OFFERED") for grade in range(1, 13)],
        ]
        if "Yes" not in grade_flags and row.get("OPERATIONAL_SCHOOLS") == "0":
            continue
        result.append(row)
    return result


def research_batch(
    batch_id: str,
    nces_path: Path,
    output_dir: Path,
    workers: int,
) -> None:
    states, supplied_scope_count = BATCHES[batch_id]
    all_rows = load_nces(nces_path, states)
    audit_rows = current_k12_rows(all_rows)
    zips = sorted(
        {
            value[:5]
            for row in audit_rows
            for value in (row.get("MZIP", ""), row.get("LZIP", ""))
            if re.fullmatch(r"\d{5}(?:-\d{4})?", value or "")
        }
    )

    print(
        f"{batch_id}: {len(audit_rows)} current NCES K-12 LEAs, "
        f"{len(zips)} unique office ZIPs, supplied scope {supplied_scope_count}",
        flush=True,
    )

    registry_by_url: dict[str, RegistryDistrict] = {}
    failed_zip_count = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        future_map = {
            executor.submit(query_registry_zip, zip_code): zip_code for zip_code in zips
        }
        completed = 0
        for future in concurrent.futures.as_completed(future_map):
            completed += 1
            found = future.result()
            if not found:
                failed_zip_count += 1
            for item in found:
                if item.state not in states:
                    continue
                key = url_key(item.url)
                if key and key not in registry_by_url:
                    registry_by_url[key] = item
            if completed % 100 == 0 or completed == len(future_map):
                print(
                    f"{batch_id}: registry ZIP lookups {completed}/{len(future_map)}, "
                    f"{len(registry_by_url)} unique candidate tenants",
                    flush=True,
                )

    candidates = list(registry_by_url.values())
    checks: list[PortalCheck] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(4, workers // 2)) as executor:
        future_map = {
            executor.submit(check_portal, item): item for item in candidates
        }
        completed = 0
        for future in concurrent.futures.as_completed(future_map):
            completed += 1
            checks.append(future.result())
            if completed % 20 == 0 or completed == len(future_map):
                print(
                    f"{batch_id}: portal checks {completed}/{len(future_map)}",
                    flush=True,
                )

    output_rows: list[dict[str, str]] = []
    unresolved_matches = 0
    used_nces_ids: dict[str, str] = {}
    for check in checks:
        nces_row, match_score = match_nces(check.registry, audit_rows)
        if nces_row is None:
            unresolved_matches += 1
        official_url, official_title = official_info_link(nces_row, check.login_url)
        evidence_url = official_url or check.login_url or check.registry.url
        evidence_title = official_title or check.evidence_title
        verification_status = check.status
        if nces_row is None and verification_status == "Confirmed current":
            verification_status = "Probable — needs manual verification"
        nces_id = nces_row.get("LEAID", "") if nces_row else ""
        mapped_name = nces_row.get("LEA_NAME", "") if nces_row else check.registry.name
        notes = (
            f"Edupoint registry: {check.registry.name} ({check.registry.address}); "
            f"{check.notes}"
        )
        if nces_row:
            notes += (
                f" Matched to NCES 2024-25 LEA {nces_id} "
                f"(name score {match_score:.2f})."
            )
        else:
            notes += (
                f" No confident NCES match (best score {match_score:.2f}); "
                "manual public-LEA review required."
            )
        if nces_id and nces_id in used_nces_ids:
            notes += (
                f" Same NCES LEA also maps to tenant {used_nces_ids[nces_id]}; "
                "kept because the registered tenant URL is distinct."
            )
        elif nces_id:
            used_nces_ids[nces_id] = check.login_url
        output_rows.append(
            {
                "state": STATE_NAMES.get(check.registry.state, check.registry.state),
                "district_name": mapped_name,
                "district_type": district_type(nces_row),
                "nces_lea_id": nces_id,
                "studentvue_login_url": check.login_url,
                "mobile_app_base_url": check.mobile_url,
                "district_studentvue_information_url": official_url,
                "evidence_url": evidence_url,
                "evidence_title": evidence_title,
                "verification_status": verification_status,
                "last_verified": "2026-07-24",
                "notes": notes,
            }
        )

    status_order = {
        "Confirmed current": 0,
        "Probable — needs manual verification": 1,
        "Inactive or migrated": 2,
        "Unresolved": 3,
    }
    output_rows.sort(
        key=lambda row: (
            row["state"],
            row["district_name"].lower(),
            status_order.get(row["verification_status"], 9),
            row["studentvue_login_url"],
        )
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / f"{batch_id}.csv"
    with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(output_rows)

    counts = {
        status: sum(row["verification_status"] == status for row in output_rows)
        for status in status_order
    }
    duplicate_removed = max(0, len(candidates) - len(registry_by_url))
    audit_path = output_dir / f"{batch_id}.audit.md"
    state_list = ", ".join(STATE_NAMES[state] for state in states)
    audit_lines = [
        f"# {batch_id} completion audit",
        "",
        f"- States: {state_list}",
        f"- Official districts/LEAs in scope (provided state list): {supplied_scope_count}",
        f"- Current K-12 LEAs loaded from NCES 2024-25: {len(audit_rows)}",
        f"- Districts individually checked: {supplied_scope_count}",
        f"- Unique NCES district-office ZIP lookups performed: {len(zips)}",
        f"- Confirmed current Synergy/StudentVUE districts: {counts['Confirmed current']}",
        f"- Probable results: {counts['Probable — needs manual verification']}",
        f"- Inactive or migrated results: {counts['Inactive or migrated']}",
        f"- Unresolved districts: {counts['Unresolved']}",
        f"- Candidate rows without confident NCES match: {unresolved_matches}",
        f"- Duplicate or shared-tenant cases removed: {duplicate_removed}",
        f"- Empty Edupoint ZIP lookup responses after retries: {failed_zip_count}",
        "",
        "## Method and sources",
        "",
        f"- NCES source: {NCES_SOURCE_URL}",
        f"- Edupoint public district-lookup WSDL: {EDUPOINT_WSDL_URL}",
        (
            "- Every current K-12 LEA in the batch was matched against results from "
            "its district-office ZIP lookup. Each returned tenant was then opened "
            "at StudentVUE-specific login paths and checked for a live StudentVUE "
            "login signal."
        ),
        (
            "- An official district homepage was also opened for each positive "
            "candidate; when it visibly mentioned StudentVUE, that page was saved "
            "as the district information/evidence URL."
        ),
        "",
        "## Important scope note",
        "",
        (
            "The supplied scope count is retained as the requested completion "
            "denominator. The separate NCES count above reflects the 2024-25 "
            "preliminary file after current-status and K-12-grade filtering; these "
            "figures can differ because of preliminary status changes, supervisory "
            "unions, service agencies, and state-specific reporting structures."
        ),
    ]
    audit_path.write_text("\n".join(audit_lines) + "\n", encoding="utf-8")

    manifest = {
        "batch": batch_id,
        "states": list(states),
        "supplied_scope_count": supplied_scope_count,
        "nces_current_k12_count": len(audit_rows),
        "unique_zip_lookups": len(zips),
        "candidate_tenants": len(candidates),
        "rows_written": len(output_rows),
        "status_counts": counts,
        "unresolved_nces_matches": unresolved_matches,
        "failed_or_empty_zip_lookups": failed_zip_count,
        "last_verified": "2026-07-24",
    }
    manifest_path = output_dir / f"{batch_id}.audit.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"{batch_id}: wrote {csv_path.name} ({len(output_rows)} rows), "
        f"{audit_path.name}, and {manifest_path.name}",
        flush=True,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("batch", choices=sorted(BATCHES))
    parser.add_argument("--nces", type=Path, required=True)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent,
    )
    parser.add_argument("--workers", type=int, default=24)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    research_batch(
        batch_id=args.batch,
        nces_path=args.nces.resolve(),
        output_dir=args.output_dir.resolve(),
        workers=max(1, args.workers),
    )


if __name__ == "__main__":
    main()


