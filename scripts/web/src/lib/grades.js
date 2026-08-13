// Grade → band-color helpers. Centralized here (the design references defined a
// copy in each file — see README "Grade → band color helper ... centralize it").

// Letter grade → band. A → green, B → yellow, C and below → red.
export function gradeBandColor(grade) {
  const letter = (grade || 'A').trim()[0].toUpperCase();
  if (letter === 'A') return 'var(--color-grade-good)';
  if (letter === 'B') return 'var(--color-grade-mid)';
  return 'var(--color-grade-bad)';
}

// Score percentage → band. ≥90 green, ≥80 yellow, else red.
export function scoreBandColor(pct) {
  if (pct >= 90) return 'var(--color-grade-good)';
  if (pct >= 80) return 'var(--color-grade-mid)';
  return 'var(--color-grade-bad)';
}
