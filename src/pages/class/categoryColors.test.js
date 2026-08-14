import { describe, expect, it } from 'vitest';
import {
  CATEGORY_PALETTE,
  categoryColorAt,
  makeCategoryColorMap,
  sortCategoryNames,
} from './categoryColors.js';

describe('category colors', () => {
  it('sorts categories alphabetically and removes duplicates', () => {
    expect(sortCategoryNames(['Tests', 'Homework', 'Labs', 'Homework', 'Quizzes'])).toEqual([
      'Homework',
      'Labs',
      'Quizzes',
      'Tests',
    ]);
  });

  it('assigns the fixed palette in alphabetical order', () => {
    const colors = makeCategoryColorMap(['Tests', 'Homework', 'Labs', 'Quizzes']);
    expect([...colors.entries()]).toEqual([
      ['Homework', CATEGORY_PALETTE[0]],
      ['Labs', CATEGORY_PALETTE[1]],
      ['Quizzes', CATEGORY_PALETTE[2]],
      ['Tests', CATEGORY_PALETTE[3]],
    ]);
  });

  it('colors visible categories before unused configured categories', () => {
    const colors = makeCategoryColorMap(
      ['Tests', 'Homework'],
      ['Classwork', 'Homework', 'Tests'],
    );
    expect([...colors.entries()]).toEqual([
      ['Homework', CATEGORY_PALETTE[0]],
      ['Tests', CATEGORY_PALETTE[1]],
      ['Classwork', CATEGORY_PALETTE[2]],
    ]);
  });

  it('does not repeat colors after the fixed palette is exhausted', () => {
    const colors = Array.from({ length: CATEGORY_PALETTE.length + 8 }, (_, index) =>
      categoryColorAt(index),
    );
    expect(new Set(colors).size).toBe(colors.length);
  });
});
