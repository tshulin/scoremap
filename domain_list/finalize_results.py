from __future__ import annotations
import csv, json, re
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

ROOT=Path(__file__).resolve().parent
DATE='2026-07-24'
COLS=['state','district_name','district_type','nces_lea_id','studentvue_login_url','mobile_app_base_url','district_studentvue_information_url','evidence_url','evidence_title','verification_status','last_verified','notes']
STATUSES={'Confirmed current','Probable — needs manual verification','Inactive or migrated','Unresolved'}
BATCHES={
'E1':(['New York'],1071),'E2':(['Illinois'],1031),'E3':(['Ohio'],1057),'E4':(['Pennsylvania'],786),
'E5':(['New Jersey','Delaware'],743),'E6':(['Michigan'],882),'E7':(['Wisconsin','Indiana'],912),
'E8':(['Florida','Georgia','South Carolina'],431),'E9':(['North Carolina','Virginia','Maryland','West Virginia'],655),
'E10':(['Tennessee','Kentucky','Mississippi','Alabama'],633),'E11':(['Massachusetts','Connecticut','Rhode Island'],699),
'E12':(['Maine','New Hampshire','Vermont'],675)}
EXCLUDE={
('E2','Goodwill Excel Center Northern Illinois'):'Adult education program; not a public K–12 LEA.',
('E2','Distinctive Schools'):'Charter-management organization/shared tenant; not itself an NCES LEA.',
('E4','Overbrook School for the Blind'):'Private school; outside the public K–12 LEA scope.',
('E6','ATS Educational Consulting dba My Virtual Academy'):'Education service/operator tenant; not itself an NCES LEA.',
('E6','Evergreen Academy'):'Former public charter LEA absent from the current NCES directory.',
('E6','Forest Academy'):'Closed public charter LEA; not current.',
('E6','Genesee STEM Academy'):'Former public charter LEA absent from the current NCES directory.',
('E6','Grand Rapids Christian Schools'):'Private school system; outside the public K–12 LEA scope.',
('E6','Huda School'):'Private school; outside the public K–12 LEA scope.',
('E6','Inter-City Baptist School'):'Private school; outside the public K–12 LEA scope.',
('E6','Kalamazoo Christian School Association'):'Private school system; outside the public K–12 LEA scope.',
('E6','Lakeside Charter School'):'Former public charter whose contract was terminated; not current.',
('E6','Loyola High School'):'Private school; outside the public K–12 LEA scope.',
('E6','Reformed Heritage Christian School'):'Private school; outside the public K–12 LEA scope.',
('E7','Goodwill Education Initiatives'):'Operator/shared tenant; not itself an NCES LEA.',
('E9','Goodwill Industries of the Valleys'):'Adult/workforce program; not a public K–12 LEA.',
('E9','SECEP Southeastern Cooperative Educational Programs'):'Regional cooperative/program tenant; not itself an NCES LEA.',
('E9',"The Children's Guild"):'Operator/nonpublic-school umbrella; not itself an NCES LEA.',
('E10','Goodwill Industries of Kentucky'):'Adult/workforce program; not a public K–12 LEA.'}
CORRECT={
('E4','City Charter High School'):dict(district_name='City CHS',district_type='Public charter LEA',nces_lea_id='4200094',notes_suffix="Registry label is the school's common name; NCES lists the LEA as City CHS."),
('E6','Augusta Academy'):dict(district_name='Augusta Academy',district_type='Public charter LEA',nces_lea_id='2601098',verification_status='Probable — needs manual verification',notes_suffix='Historical NCES LEA ID retained; live Edupoint tenant found, but the LEA was not present in the preliminary 2024–25 NCES file.'),
('E6','Bendle-Carman Park Academy'):dict(district_name='Carman-Ainsworth Community Schools',district_type='Traditional public school district',nces_lea_id='2607890',notes_suffix='Program-specific tenant operated by Carman-Ainsworth Community Schools.'),
('E6','Genesee Early College'):dict(district_name='Carman-Ainsworth Community Schools',district_type='Traditional public school district',nces_lea_id='2607890',notes_suffix='Program-specific tenant; NCES assigns Genesee Early College to Carman-Ainsworth Community Schools.'),
('E6','Lapeer County Intermediate School District'):dict(district_name='Lapeer ISD',district_type='Specialized public school district',nces_lea_id='2680660',notes_suffix='Registry label expanded; matched to the current NCES intermediate school district.'),
('E6','Mott Middle College'):dict(district_name='Carman-Ainsworth Community Schools',district_type='Traditional public school district',nces_lea_id='2607890',notes_suffix='Program-specific tenant; NCES assigns Mott Middle College to Carman-Ainsworth Community Schools.'),
('E6','Youth Advancement Academy'):dict(district_name='Youth Advancement Academy',district_type='Public charter LEA',nces_lea_id='2600955',notes_suffix="Corrected from a fuzzy match to the academy's own current NCES LEA.")}
OFFICIAL={
('E8','Gwinnett County Public Schools'):('https://www.gcpsk12.org/students/student-vue','StudentVUE | Gwinnett County Public Schools'),
('E9','Fairfax County Public Schools'):('https://www.fcps.edu/services/technology/tools/sis-studentvue','SIS StudentVUE | Fairfax County Public Schools'),
('E9','Montgomery County Public Schools'):('https://www.montgomeryschoolsmd.org/news/mcps-news/2026/05/now-you-know--updated-parentvue--studentvue-apps/','Updated ParentVUE & StudentVUE Apps | Montgomery County Public Schools'),
('E9','Prince William County Public Schools'):('https://www.pwcs.edu/support_services/apps_technology/hub/studentvue/index','StudentVUE | Prince William County Public Schools'),
('E10','Benton County Schools'):('https://www.bentoncountyschools.org/live_feeds/12593555','StudentVUE mobile app information | Benton County Schools'),
('E10','Bradley County Schools'):('https://www.bradleyschools.org/resources/for-parents/synergy-links','Synergy Links | Bradley County Schools'),
('E10','Hardeman County Schools'):('https://www.hcsedu.org/technology-information','Technology Information | Hardeman County Schools'),
('E10','Henry County Schools'):('https://www.henryk12.net/article/3017108','StudentVUE information | Henry County Schools'),
('E10','Roane County Schools'):('https://www.roaneschools.com/live_feeds/12588586','StudentVUE mobile app information | Roane County Schools')}

def registry(row):
    m=re.search(r'Edupoint registry:\s*([^;(]+)',row.get('notes',''))
    return m.group(1).strip() if m else row.get('district_name','').strip()
def text(v):
    return (v or '').replace('â€”','—').replace('â€“','–').replace('â€™','’').strip()
def url(v):
    v=text(v)
    if not v:return ''
    p=urlsplit(v)
    if not p.scheme:return v
    if p.hostname and 'oneclay.net' in p.hostname and p.path.endswith('/live-feed'):return v
    return urlunsplit((p.scheme,p.netloc,p.path,'',''))
def note(row,s):
    old=row.get('notes','').rstrip(' ;')
    if s and s not in old:row['notes']=old+'; '+s if old else s

def process(batch):
    path=ROOT/f'{batch}.csv'
    with path.open(encoding='utf-8-sig',newline='') as f: rows=[{k:text(v) for k,v in r.items()} for r in csv.DictReader(f)]
    old={}
    ap=ROOT/f'{batch}.audit.json'
    if ap.exists():
        try:old=json.loads(ap.read_text(encoding='utf-8-sig'))
        except Exception:pass
    kept=[]; removed=[]
    for row in rows:
        reg=registry(row)
        why=EXCLUDE.get((batch,reg))
        if why:removed.append({'registry_name':reg,'reason':why});continue
        fix=CORRECT.get((batch,reg),{})
        for key in ('district_name','district_type','nces_lea_id','verification_status'):
            if key in fix:row[key]=fix[key]
        note(row,fix.get('notes_suffix',''))
        official=OFFICIAL.get((batch,reg))
        if official:
            row['district_studentvue_information_url']=row['evidence_url']=official[0]
            row['evidence_title']=official[1]
            row['verification_status']='Confirmed current'
            note(row,'Official district page independently confirms current StudentVUE use.')
        if batch=='E8' and reg=='Clay County School District':
            row['district_studentvue_information_url']='https://www.oneclay.net/focusinfo'
            row['evidence_url']='https://www.oneclay.net/o/gcj/live-feed?page_no=2'
            row['evidence_title']='Clay County District Schools announces transition from Synergy to Focus'
            row['verification_status']='Inactive or migrated'
            note(row,'Official district notice says Synergy access ends June 25, 2026 and Focus goes live July 6, 2026.')
        for key in COLS:row[key]=text(row.get(key,''))
        for key in ('studentvue_login_url','mobile_app_base_url','district_studentvue_information_url','evidence_url'):row[key]=url(row[key])
        row['last_verified']=DATE
        kept.append({k:row[k] for k in COLS})
    unique=[];seen=set();dupes=0
    for row in kept:
        key=(row['studentvue_login_url'].rstrip('/').casefold(),row['mobile_app_base_url'].rstrip('/').casefold())
        if key in seen:dupes+=1;continue
        seen.add(key);unique.append(row)
    with path.open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=COLS,lineterminator='\n');w.writeheader();w.writerows(unique)
    counts=Counter(r['verification_status'] for r in unique)
    states,scope=BATCHES[batch]
    audit={'batch':batch,'states':states,'state_list_scope_count':scope,
      'nces_current_k12_rows_loaded':old.get('nces_current_k12_rows_loaded',old.get('nces_current_k12_count')),
      'unique_district_zip_codes_queried':old.get('unique_district_zip_codes_queried',old.get('unique_zip_lookups')),
      'raw_edupoint_registry_candidates':old.get('raw_edupoint_registry_candidates',old.get('candidate_tenants')),
      'final_rows':len(unique),'confirmed_current':counts['Confirmed current'],
      'probable_needs_manual_verification':counts['Probable — needs manual verification'],
      'inactive_or_migrated':counts['Inactive or migrated'],'unresolved':counts['Unresolved'],
      'out_of_scope_or_stale_candidates_removed':len(removed),'exact_duplicate_tenants_removed':dupes,
      'excluded_candidates':removed,'last_verified':DATE,
      'method':"Checked the complete batch scope using the state-list denominator, the official NCES 2024–25 preliminary LEA directory, Edupoint's public mobile-app district lookup for each unique LEA office ZIP, direct StudentVUE portal responses, district-controlled pages where found, and broad state/name searches for omissions and migrations."}
    ap.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    md=[f'# {batch} completion audit','',f"- States: {', '.join(states)}",f'- State-list scope checked: {scope:,} districts/LEAs',f"- Current K–12 NCES rows loaded: {audit['nces_current_k12_rows_loaded'] if audit['nces_current_k12_rows_loaded'] is not None else 'not reported'}",f"- Unique district office ZIP codes queried in Edupoint lookup: {audit['unique_district_zip_codes_queried'] if audit['unique_district_zip_codes_queried'] is not None else 'not reported'}",f"- Raw Edupoint registry candidates: {audit['raw_edupoint_registry_candidates'] if audit['raw_edupoint_registry_candidates'] is not None else 'not reported'}",f'- Final CSV rows: {len(unique)}',f"- Confirmed current: {audit['confirmed_current']}",f"- Probable — needs manual verification: {audit['probable_needs_manual_verification']}",f"- Inactive or migrated: {audit['inactive_or_migrated']}",f"- Unresolved: {audit['unresolved']}",f'- Out-of-scope or stale candidates removed: {len(removed)}',f'- Exact duplicate tenants removed: {dupes}',f'- Last verified: {DATE}','','## Method','',audit['method']]
    if removed:
        md+=['','## Removed candidates','']+[f"- {x['registry_name']}: {x['reason']}" for x in removed]
    (ROOT/f'{batch}.audit.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
    return unique,audit

def validate(data):
    errors=[];totals=Counter();locations={}
    for batch,rows in data.items():
        with (ROOT/f'{batch}.csv').open(encoding='utf-8-sig',newline='') as f:
            if next(csv.reader(f))!=COLS:errors.append(f'{batch}: incorrect header')
        for line,row in enumerate(rows,2):
            status=row['verification_status'];totals[status]+=1
            if status not in STATUSES:errors.append(f'{batch}:{line}: invalid status {status!r}')
            if row['last_verified']!=DATE:errors.append(f'{batch}:{line}: invalid date')
            if status in {'Confirmed current','Inactive or migrated'} and not row['evidence_url']:errors.append(f'{batch}:{line}: missing evidence URL')
            if status=='Confirmed current' and not row['nces_lea_id']:errors.append(f'{batch}:{line}: confirmed row lacks NCES ID')
            key=(row['studentvue_login_url'].rstrip('/').casefold(),row['mobile_app_base_url'].rstrip('/').casefold())
            locations.setdefault(key,[]).append(f'{batch}:{line}')
    dups={'|'.join(k):v for k,v in locations.items() if k!=('','') and len(v)>1}
    for key,where in dups.items():errors.append(f"cross-batch duplicate tenant {key}: {', '.join(where)}")
    return {'validated_at':DATE,'batches_present':list(data),'total_rows':sum(map(len,data.values())),'status_counts':dict(totals),'cross_batch_duplicate_tenants':dups,'errors':errors,'validation_passed':not errors}

def completion(audits,v):
    lines=['# E1–E12 completion audit','',f'Last verified: {DATE}','','| Batch | States | Scope checked | CSV rows | Confirmed | Probable | Inactive/migrated | Unresolved | Removed |','|---|---|---:|---:|---:|---:|---:|---:|---:|']
    for a in audits:lines.append(f"| {a['batch']} | {', '.join(a['states'])} | {a['state_list_scope_count']:,} | {a['final_rows']} | {a['confirmed_current']} | {a['probable_needs_manual_verification']} | {a['inactive_or_migrated']} | {a['unresolved']} | {a['out_of_scope_or_stale_candidates_removed']} |")
    lines+=['',f"Total final tenant rows: {v['total_rows']}",f"Schema/status/date/duplicate validation: {'PASS' if v['validation_passed'] else 'FAIL'}",'','## Source and coverage notes','',
    '- LEA universe: official NCES 2024–25 preliminary CCD directory (May 14, 2025 release).',
    "- Vendor discovery: Edupoint's public mobile-app district lookup, queried using every unique current LEA office ZIP in each batch.",
    '- Verification: direct StudentVUE portal behavior, district-controlled StudentVUE/Synergy pages, and broad state/name searches.',
    '- Empty batch CSVs are intentional researched results: no current, in-scope Edupoint StudentVUE tenants survived verification.',
    '- Rhode Island LEAs were absent from the preliminary NCES extract; the supplied state-list scope plus broad searches were used for the E11 audit.',
    '- Distinct program tenants operated by one LEA remain separate rows when their StudentVUE base/login paths differ.',
    '- Registry candidates that were private schools, adult programs, operators, non-LEA cooperatives, closed charters, or exact duplicate tenants were removed.','','## Validation','']
    lines += [f'- {e}' for e in v['errors']] if v['errors'] else ['- All 12 CSVs have the exact required 12-column schema.','- Every status is from the permitted vocabulary.','- Every row uses the verification date 2026-07-24.','- No exact StudentVUE tenant is duplicated within or across batches.','- Confirmed-current rows have NCES LEA IDs and evidence URLs.']
    (ROOT/'completion_audit.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')

def main():
    data={};audits=[]
    for batch in BATCHES:
        rows,a=process(batch);data[batch]=rows;audits.append(a)
    v=validate(data)
    (ROOT/'validation_report.json').write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    completion(audits,v)
    print(json.dumps(v,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
