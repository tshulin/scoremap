// StudentVUE sync layer — client.
//
// In production this authenticates a student against their district's
// StudentVUE endpoint (`<domain>`, e.g. `[district]-psv.edupoint.com`) and pulls
// the gradebook: class list, per-class assignments, and grade history. The
// device talks to StudentVUE directly — the server never sees the password or
// grades (see the login copy).
//
// Until that client is wired up, these functions resolve against the last-synced
// snapshot (src/data/snapshot.js), exposing the async, promise-based API a live
// client would so callers don't change when the real transport lands.
import { snapshot } from './snapshot.js';

// Simulate the latency of a real StudentVUE round-trip.
const settle = (value, ms = 0) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

// Authenticate + pull the full gradebook for a session.
// `credentials`: { username, domain, agreed }.
export async function sync(credentials = {}) {
  const session = { ...snapshot.session, ...credentials };
  return settle({ ...snapshot, session });
}

export async function fetchClasses() {
  return settle(snapshot.classes);
}

export async function fetchClass(id) {
  return settle(snapshot.classes.find((c) => c.id === id) || null);
}

export async function fetchAssignments(id) {
  return settle(snapshot.assignmentsByClass[id] || snapshot.assignmentsByClass.__default || []);
}

export async function fetchGradeHistory(id) {
  return settle(snapshot.historyByClass[id] || snapshot.historyByClass.__default || { dates: [], values: [] });
}

export default { sync, fetchClasses, fetchClass, fetchAssignments, fetchGradeHistory };
