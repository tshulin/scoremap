const PORTAL_SUFFIX = /(?:\s*\((?:P|HP|PLTW)\))+\s*$/i;

// StudentVUE appends program/college-prep markers to course titles. Keep the
// raw title in synced data (the GPA calculator uses HP to infer weighting),
// but remove those trailing markers anywhere a student sees the name.
export function displayCourseName(name) {
  const raw = typeof name === 'string' ? name.trim() : '';
  const cleaned = raw.replace(PORTAL_SUFFIX, '').trim();
  return cleaned || raw;
}
