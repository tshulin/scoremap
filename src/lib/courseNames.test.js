import { describe, expect, it } from 'vitest';
import { displayCourseName } from './courseNames.js';

describe('displayCourseName', () => {
  it('removes StudentVUE course markers from the end of titles', () => {
    expect(displayCourseName('Sports & Ent Mkt (P)')).toBe('Sports & Ent Mkt');
    expect(displayCourseName('AP Biology (HP)')).toBe('AP Biology');
    expect(displayCourseName('Hon Princ of Engnr (PLTW)(HP)')).toBe('Hon Princ of Engnr');
    expect(displayCourseName('Hon Princ of Engnr (PLTW) (HP)')).toBe('Hon Princ of Engnr');
  });

  it('does not alter ordinary parentheses or markers inside a title', () => {
    expect(displayCourseName('English (World Literature)')).toBe('English (World Literature)');
    expect(displayCourseName('PLTW (P) Design')).toBe('PLTW (P) Design');
    expect(displayCourseName('Chemistry')).toBe('Chemistry');
  });
});
