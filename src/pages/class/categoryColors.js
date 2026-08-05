// Category colors are assigned by alphabetical position, not by keywords in
// the category name. This keeps the mapping deterministic across filters,
// assignment chips, dropdowns, and overview charts.
export const CATEGORY_PALETTE = [
  'var(--color-grade-good)',
  'var(--color-grade-bad)',
  'var(--color-category-blue)',
  'var(--color-category-orange)',
  'var(--color-category-purple)',
  'var(--color-category-teal)',
  'var(--color-category-pink)',
  'var(--color-category-lime)',
  'var(--color-category-indigo)',
  'var(--color-category-coral)',
  'var(--color-category-cyan)',
];

const categoryCollator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
});

export const compareCategoryNames = (a, b) => categoryCollator.compare(a, b);

export const sortCategoryNames = (names) =>
  [...new Set(names.filter((name) => typeof name === 'string' && name.trim()))]
    .sort(compareCategoryNames);

// The fixed theme-aware colors cover normal gradebooks. If a portal sends
// more categories, the golden-angle fallback continues producing unique hues
// instead of cycling and repeating an existing category color.
export const categoryColorAt = (index) =>
  CATEGORY_PALETTE[index] ?? `hsl(${Math.round((index * 137.508) % 360)} 72% 62%)`;

export const makeCategoryColorMap = (...nameGroups) => {
  const ordered = [];
  const seen = new Set();
  for (const names of nameGroups) {
    for (const name of sortCategoryNames(names)) {
      if (seen.has(name)) continue;
      seen.add(name);
      ordered.push(name);
    }
  }
  return new Map(ordered.map((name, index) => [name, categoryColorAt(index)]));
};

export const categoryColorFor = (name, colorMap) =>
  colorMap.get(name) ?? 'var(--color-muted)';

export const categoryChipStyle = (name, colorMap) => {
  const color = categoryColorFor(name, colorMap);
  return {
    color,
    background: `color-mix(in srgb, ${color} 14%, transparent)`,
    border: '1px solid transparent',
  };
};
