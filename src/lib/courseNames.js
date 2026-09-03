const COURSE_SUFFIX = /(?:\s*\((?:P|HP|PLTW)\))+\s*$/i;

// Imported titles may include program/college-prep markers. Keep the
// raw title in synced data (the GPA calculator uses HP to infer weighting),
// but remove those trailing markers anywhere a student sees the name.
export function displayCourseName(name) {
  const raw = typeof name === 'string' ? name.trim() : '';
  const cleaned = raw.replace(COURSE_SUFFIX, '').trim();
  return cleaned || raw;
}
