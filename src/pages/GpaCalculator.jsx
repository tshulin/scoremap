import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GPA_GRADES, isWeightedCourseName, parsePleasantonTranscriptText, projectCumulativeGpa, semesterGpa, toGpaGrade } from '../calc/index';
import Sidebar from '../components/Sidebar.jsx';
import { useClasses, useDocuments } from '../data/SyncProvider.jsx';
import { downloadDocument } from '../data/api.js';
import { extractPdfText } from '../data/transcriptPdf.js';
import './GpaCalculator.css';

const STORAGE_KEY = 'grademax-gpa-calculator-v1';
const BASELINE_KEY = 'scoremap-cumulative-gpa-baseline-v1';
let sequence = 0;
const newCourse = () => ({ id: `gpa-${Date.now()}-${sequence++}`, name: '', grade: 'A', weighted: false, credits: 5 });
const defaultCourses = () => Array.from({ length: 6 }, newCourse);
const loadCourses = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved) || !saved.length) return defaultCourses();
    return saved.filter((c) => c && GPA_GRADES.includes(c.grade)).map((c) => ({
      id: c.id || newCourse().id, name: c.name || '', grade: c.grade,
      weighted: c.weighted === true, credits: Number(c.credits) > 0 ? Number(c.credits) : 5,
    }));
  } catch { return defaultCourses(); }
};
const loadBaseline = () => {
  try {
    const value = JSON.parse(localStorage.getItem(BASELINE_KEY));
    return { unweighted: value?.unweighted ?? '', weighted: value?.weighted ?? '', credits: value?.credits ?? '' };
  } catch { return { unweighted: '', weighted: '', credits: '' }; }
};
const format = (value) => value == null || !Number.isFinite(value) ? 'N/A' : value.toFixed(2);
const tokenFor = (doc) => doc?.token || doc?.documentToken || doc?.id || '';

export default function GpaCalculator() {
  const [courses, setCourses] = useState(loadCourses);
  const [baseline, setBaseline] = useState(loadBaseline);
  const [selectedToken, setSelectedToken] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const classes = useClasses();
  const documents = useDocuments();

  const transcripts = useMemo(() => (documents || []).filter((d) =>
    /transcript/i.test([d.title, d.name, d.type, d.documentName].filter(Boolean).join(' '))
  ), [documents]);
  useEffect(() => {
    if (!selectedToken && transcripts.length) setSelectedToken(tokenFor(transcripts[0]));
  }, [selectedToken, transcripts]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(courses)); } catch {} }, [courses]);
  useEffect(() => { try { localStorage.setItem(BASELINE_KEY, JSON.stringify(baseline)); } catch {} }, [baseline]);

  const importable = useMemo(() => (classes || []).map((c) => ({
    name: c.name, grade: toGpaGrade(c.grade || ''), weighted: isWeightedCourseName(c.name || ''), credits: 5,
  })).filter((c) => c.grade), [classes]);
  const semester = useMemo(() => semesterGpa(courses), [courses]);
  const historical = {
    unweighted: Number(baseline.unweighted), weighted: Number(baseline.weighted), credits: Number(baseline.credits),
  };
  const projection = useMemo(() => projectCumulativeGpa(courses, historical), [courses, baseline]);

  const applyTranscript = async (blob) => {
    setBusy(true); setStatus('Reading transcript on this device…');
    try {
      const text = await extractPdfText(blob);
      const parsed = parsePleasantonTranscriptText(text);
      if (parsed.unweighted == null || parsed.weighted == null || parsed.credits == null) {
        throw new Error('The GPA summary or completed credits could not be found.');
      }
      setBaseline({ unweighted: parsed.unweighted, weighted: parsed.weighted, credits: parsed.credits });
      setStatus('Transcript GPA and completed credits imported.');
    } catch (error) { setStatus(error?.message || 'Could not read this transcript.'); }
    finally { setBusy(false); }
  };
  const readSelected = async () => {
    if (!selectedToken) return;
    setBusy(true); setStatus('Downloading transcript…');
    try {
      const result = await downloadDocument(selectedToken);
      await applyTranscript(result.blob);
    } catch (error) { setStatus(error?.message || 'Could not download this transcript.'); setBusy(false); }
  };
  const updateCourse = (id, field, value) => setCourses((all) => all.map((c) => c.id === id ? { ...c, [field]: value } : c));

  return <div className="gpa-page">
    <Sidebar />
    <main className="gpa-main"><div className="gpa-shell">
      <header className="gpa-header"><div><h1>GPA calculator</h1><p>See how this semester could affect your cumulative GPA.</p></div></header>

      <section className="gpa-baseline-card">
        <div className="gpa-card-heading"><div><h2>Cumulative GPA starting point</h2><p>Import your latest Pleasanton transcript, or enter the three values manually.</p></div></div>
        <div className="gpa-transcript-actions">
          <select value={selectedToken} onChange={(e) => setSelectedToken(e.target.value)} disabled={!transcripts.length}>
            {!transcripts.length && <option>No transcript found in Documents</option>}
            {transcripts.map((doc) => <option key={tokenFor(doc)} value={tokenFor(doc)}>{doc.title || doc.name || 'Transcript'}</option>)}
          </select>
          <button type="button" className="gpa-add-button" onClick={readSelected} disabled={!selectedToken || busy}>Read transcript</button>
          <button type="button" className="gpa-add-button gpa-import-button" onClick={() => fileRef.current?.click()} disabled={busy}>Upload PDF</button>
          <input ref={fileRef} hidden type="file" accept="application/pdf" onChange={(e) => e.target.files?.[0] && applyTranscript(e.target.files[0])} />
        </div>
        <div className="gpa-baseline-fields">
          <label>Current unweighted GPA<input type="number" min="0" step="0.01" value={baseline.unweighted} onChange={(e) => setBaseline({ ...baseline, unweighted: e.target.value })} /></label>
          <label>Current weighted GPA<input type="number" min="0" step="0.01" value={baseline.weighted} onChange={(e) => setBaseline({ ...baseline, weighted: e.target.value })} /></label>
          <label>Completed credits<input type="number" min="0" step="0.5" value={baseline.credits} onChange={(e) => setBaseline({ ...baseline, credits: e.target.value })} /></label>
        </div>
        {status && <p className="gpa-status">{status}</p>}
        <p className="gpa-local-note">The PDF is read locally in your browser. Its contents are not uploaded to Scoremap.</p>
      </section>

      <div className="gpa-layout">
        <section className="gpa-course-card">
          <div className="gpa-card-heading"><div><h2>Current semester</h2><p>{courses.length} courses</p></div>
            <div className="gpa-heading-actions">
              <button className="gpa-add-button" onClick={() => setCourses((all) => [...all, newCourse()])}>Add course</button>
              <button className="gpa-add-button gpa-import-button" disabled={!importable.length} onClick={() => setCourses(importable.map((c) => ({ ...newCourse(), ...c })))}>Import current grades</button>
            </div>
          </div>
          <div className="gpa-table">
            <div className="gpa-table-header"><span>Course</span><span>Grade</span><span>Type</span><span>Credits</span><span>Remove</span></div>
            {courses.map((course) => <div className="gpa-course-row" key={course.id}>
              <input aria-label="Course name" value={course.name} placeholder="Course name" onChange={(e) => updateCourse(course.id, 'name', e.target.value)} />
              <select aria-label="Grade" value={course.grade} onChange={(e) => updateCourse(course.id, 'grade', e.target.value)}>{GPA_GRADES.map((g) => <option key={g}>{g}</option>)}</select>
              <select aria-label="Course type" value={course.weighted ? 'weighted' : 'regular'} onChange={(e) => updateCourse(course.id, 'weighted', e.target.value === 'weighted')}><option value="regular">Unweighted</option><option value="weighted">Weighted</option></select>
              <input aria-label="Credits" type="number" min="0.5" step="0.5" value={course.credits} onChange={(e) => updateCourse(course.id, 'credits', Number(e.target.value))} />
              <button className="gpa-remove-button" aria-label="Remove course" onClick={() => setCourses((all) => all.length > 1 ? all.filter((c) => c.id !== course.id) : all)}>×</button>
            </div>)}
          </div>
        </section>
        <aside className="gpa-summary-card">
          <div className="gpa-summary-block"><span>Semester unweighted</span><strong>{format(semester?.unweighted)}</strong></div>
          <div className="gpa-summary-divider" />
          <div className="gpa-summary-block"><span>Semester weighted</span><strong>{format(semester?.weighted)}</strong></div>
          <div className="gpa-summary-divider" />
          <div className="gpa-summary-block"><span>Projected cumulative unweighted</span><strong>{format(projection?.projected.unweighted)}</strong></div>
          <div className="gpa-summary-divider" />
          <div className="gpa-summary-block"><span>Projected cumulative weighted</span><strong>{format(projection?.projected.weighted)}</strong></div>
        </aside>
      </div>
    </div></main>
  </div>;
}
