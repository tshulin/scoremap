import { describe, expect, it } from 'vitest';
import { courseDisplayName } from './courseNameOverrides.js';

describe('courseDisplayName', () => {
  const course = { id: 'biology-1', name: 'AP Biology (HP)' };

  it('uses a saved custom name', () => {
    expect(courseDisplayName(course, { 'biology-1': 'Advanced Biology' })).toBe('Advanced Biology');
  });

  it('falls back to the cleaned course name', () => {
    expect(courseDisplayName(course, {})).toBe('AP Biology');
  });

  it('ignores blank custom names', () => {
    expect(courseDisplayName(course, { 'biology-1': '   ' })).toBe('AP Biology');
  });
});
