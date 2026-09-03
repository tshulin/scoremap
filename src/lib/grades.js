// Grade → band-color helpers. Centralized here (the design references defined a
// copy in each file - see README "Grade → band color helper ... centralize it").

// Letter grade → band. Over 100% (extra credit pushed past the max) → cyan,
// A → green, B → yellow, C and below → red; no grade at all → the ungraded
// gray. Letters can't express "over 100", so callers that know the percentage
// pass it as the second argument.
export function gradeBandColor(grade, pct) {
  if (!grade || !grade.trim()) return 'var(--color-grade-none)';
  if (pct != null && pct > 100) return 'var(--color-grade-over)';
  const letter = grade.trim()[0].toUpperCase();
  if (letter === 'A') return 'var(--color-grade-good)';
  if (letter === 'B') return 'var(--color-grade-mid)';
  return 'var(--color-grade-bad)';
}

// Score percentage → band. >100 cyan, ≥90 green, ≥80 yellow, else red;
// no score → gray.
export function scoreBandColor(pct) {
  if (pct == null) return 'var(--color-grade-none)';
  if (pct > 100) return 'var(--color-grade-over)';
  if (pct >= 90) return 'var(--color-grade-good)';
  if (pct >= 80) return 'var(--color-grade-mid)';
  return 'var(--color-grade-bad)';
}
