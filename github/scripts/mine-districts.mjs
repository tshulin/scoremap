// Regenerates src/data/districts.js - the district list behind the login
// page's "choose your school district" dropdown.
//
// Asks Edupoint's public district-lookup service (the same endpoint the
// official StudentVUE app calls with a user's zip code) for the districts near
// each seed zip, then BFS-crawls: every newly discovered district contributes
// its own zip until no new districts appear. Seeds live in
// scripts/district-seeds.json and are updated after each run, so the crawl
// stays self-sustaining as districts come and go.
//
//   node scripts/mine-districts.mjs               mine live and regenerate
//   node scripts/mine-districts.mjs --raw d.json  regenerate from a saved dump
import { readFileSync, writeFileSync } from 'node:fs';

const SEEDS_PATH = new URL('./district-seeds.json', import.meta.url);
const OUT_PATH = new URL('../src/data/districts.js', import.meta.url);

const ENDPOINT = 'https://support.edupoint.com/Service/HDInfoCommunication.asmx';
const SOAP = (zip) => `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ProcessWebServiceRequest xmlns="http://edupoint.com/webservices/"><userID>EdupointDistrictInfo</userID><password>Edup01nt</password><skipLoginLog>1</skipLoginLog><parent>0</parent><webServiceHandleName>HDInfoServices</webServiceHandleName><methodName>GetMatchingDistrictList</methodName><paramStr>&lt;Parms&gt;&lt;Key&gt;5E4B7859-B805-474B-A833-FDB15D205D40&lt;/Key&gt;&lt;MatchToDistrictZipCode&gt;${zip}&lt;/MatchToDistrictZipCode&gt;&lt;/Parms&gt;</paramStr></ProcessWebServiceRequest></soap:Body></soap:Envelope>`;

const unescapeXml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', AS: 'American Samoa',
  GU: 'Guam', MP: 'Northern Mariana Islands', PR: 'Puerto Rico',
  VI: 'U.S. Virgin Islands',
};

// ---- mining ----

async function queryZip(zip, attempt = 0) {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        SOAPAction: 'http://edupoint.com/webservices/ProcessWebServiceRequest',
        'Content-Type': 'text/xml; charset=utf-8',
      },
      body: SOAP(zip),
    });
    const text = unescapeXml(await res.text());
    const out = [];
    for (const [tag] of text.matchAll(/<DistrictInfo [^>]*\/>/g)) {
      const attrs = {};
      for (const [, k, v] of tag.matchAll(/([A-Za-z]+)="([^"]*)"/g)) attrs[k] = v;
      if (attrs.Name && attrs.PvueURL) out.push(attrs);
    }
    return out;
  } catch (e) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      return queryZip(zip, attempt + 1);
    }
    console.error(`zip ${zip} failed: ${e.message}`);
    return [];
  }
}

const zipOf = (address) => (String(address).match(/\b(\d{5})(?:-\d{4})?\s*$/) || [])[1] || null;

async function mine(seeds) {
  const queried = new Set();
  const found = new Map(); // "PvueURL||Name" -> DistrictInfo
  let queue = [...seeds];
  for (let round = 1; queue.length && round <= 5; round++) {
    console.log(`round ${round}: ${queue.length} zips`);
    const work = [...queue];
    const next = new Set();
    const workers = Array.from({ length: 6 }, async () => {
      while (work.length) {
        const zip = work.pop();
        if (queried.has(zip)) continue;
        queried.add(zip);
        for (const d of await queryZip(zip)) {
          const key = `${d.PvueURL}||${d.Name}`;
          if (!found.has(key)) {
            found.set(key, d);
            const z = zipOf(d.Address || '');
            if (z && !queried.has(z)) next.add(z);
          }
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    });
    await Promise.all(workers);
    queue = [...next].filter((z) => !queried.has(z));
    console.log(`  ${found.size} districts so far`);
  }
  return { raw: [...found.values()], queried };
}

// ---- normalization ----

// PvueURL -> portal domain: host plus optional base path, no scheme/query/
// page file. Mirrors src/portal/domainInput.ts (verified by its tests against
// the generated data).
function toDomain(pvueUrl) {
  const raw = String(pvueUrl).trim();
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/\.+$/, '').toLowerCase();
  const segments = url.pathname.toLowerCase().split('/').filter(Boolean);
  if (segments.length && segments[segments.length - 1].includes('.')) segments.pop();
  return [host, ...segments].join('/');
}

function normalize(raw) {
  // Learn zip3 -> state from records that carry both, to fill in the few
  // addresses missing a state token.
  const zip3State = new Map();
  const stateOf = (address) => (String(address).match(/\b([A-Z]{2})\b\s+\d{5}(-\d{4})?\s*$/) || [])[1];
  for (const d of raw) {
    const st = stateOf(d.Address);
    const zip = zipOf(d.Address);
    if (st && zip && STATE_NAMES[st]) zip3State.set(zip.slice(0, 3), st);
  }

  const byKey = new Map();
  for (const d of raw) {
    const domain = toDomain(d.PvueURL);
    if (!domain) {
      console.warn(`skipping unparseable PvueURL: ${d.PvueURL}`);
      continue;
    }
    const name = unescapeXml(d.Name).trim();
    const st = stateOf(d.Address) || zip3State.get((zipOf(d.Address) || '').slice(0, 3));
    const state = STATE_NAMES[st] || 'Other';
    byKey.set(`${domain}||${name}`, { state, name, domain });
  }

  return [...byKey.values()].sort(
    (a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name) || a.domain.localeCompare(b.domain)
  );
}

// ---- main ----

const rawFlag = process.argv.indexOf('--raw');
let raw;
let queriedZips = null;
if (rawFlag !== -1) {
  raw = JSON.parse(readFileSync(process.argv[rawFlag + 1], 'utf8'));
} else {
  const seeds = JSON.parse(readFileSync(SEEDS_PATH, 'utf8'));
  const mined = await mine(new Set(seeds));
  raw = mined.raw;
  queriedZips = mined.queried;
}

const districts = normalize(raw);
const counts = {};
for (const d of districts) counts[d.state] = (counts[d.state] || 0) + 1;
console.log(`${districts.length} districts across ${Object.keys(counts).length} states`);

const date = new Date().toISOString().slice(0, 10);
const body = districts
  .map((d) => ` { state: ${JSON.stringify(d.state)}, name: ${JSON.stringify(d.name)}, domain: ${JSON.stringify(d.domain)} },`)
  .join('\n');
writeFileSync(
  OUT_PATH,
  `// GENERATED FILE - do not edit by hand. Regenerate: node scripts/mine-districts.mjs
// Districts that use StudentVUE, from Edupoint's public district-lookup
// service (the endpoint the official app queries by zip code). ${districts.length}
// districts as of ${date}. Sorted by state, then name.
export const DISTRICTS = [
${body}
];
`
);
console.log(`wrote src/data/districts.js`);

if (queriedZips) {
  const seeds = [...queriedZips].sort();
  writeFileSync(SEEDS_PATH, `${JSON.stringify(seeds, null, 1)}\n`);
  console.log(`updated ${seeds.length} seed zips`);
}
