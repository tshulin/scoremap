// The empty pre-sync snapshot. Real data comes from the backend via
// src/data/studentvue.js; nothing here may look like a real student.
//
// `meta` carries per-resource sync outcomes so pages can tell "empty" apart
// from "failed" (and flag the backend's sample gradebook as sample data).

export const emptySnapshot = {
  classes: [],
  assignmentsByClass: {},
  attendance: { schoolName: '', records: [], unreadableAbsences: 0 },
  documents: [],
  mail: { messages: [], unreadableMessages: 0 },
  session: {
    studentName: '',
    username: '',
    domain: '',
    semester: '',
    lastUpdated: null,
  },
  meta: {
    gradebook: { ok: false, placeholder: false, message: '' },
    attendance: { ok: false, placeholder: false, message: '' },
    documents: { ok: false, message: '' },
    mail: { ok: false, placeholder: false, message: '' },
  },
};

export const snapshot = emptySnapshot;

export default emptySnapshot;
