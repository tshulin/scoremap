import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import GradeChart from './GradeChart.jsx';
import OverviewChart from './OverviewChart.jsx';

vi.mock('../../data/SyncProvider.jsx', () => ({ useSession: () => ({ lastUpdated: null }) }));

const point = (date, grade) => ({ date, grade, assignments: [] });
const paths = (html) => [...html.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);

describe('GradeChart', () => {
  it('renders nothing without points', () => {
    expect(renderToStaticMarkup(<GradeChart series={[]} />)).toBe('');
  });

  // A class with one graded date still gets a chart: a flat line across the
  // full plot width, node and date label at the right edge.
  it('draws a single point as a flat full-width line', () => {
    const html = renderToStaticMarkup(<GradeChart series={[point('2026-08-14', 78.94)]} />);
    const [area, line] = paths(html);
    const m = /^M (\d+\.?\d*) (\d+\.?\d*) L (\d+\.?\d*) (\d+\.?\d*)$/.exec(line);
    expect(m).not.toBeNull();
    expect(Number(m[1])).toBeLessThan(Number(m[3]));
    expect(m[2]).toBe(m[4]);
    expect(area.startsWith(line)).toBe(true);
    expect(html).toContain('<circle');
    expect(html).toContain('text-anchor="end"');
  });

  it('keeps a multi-point series as a polyline', () => {
    const html = renderToStaticMarkup(
      <GradeChart series={[point('2026-08-14', 78.94), point('2026-08-21', 85)]} />,
    );
    const [, line] = paths(html);
    expect(line.split(' L ')).toHaveLength(2);
  });
});

describe('OverviewChart', () => {
  it('draws a single-date class as a flat full-width line', () => {
    const assignments = [
      { id: '1', name: 'Test', pointsEarned: 15, pointsPossible: 19, date: '2026-08-14', extraCredit: false, notForGrade: false },
    ];
    const rows = [{ name: 'All', currentPct: 78.94, effectiveWeightPct: 100 }];
    const html = renderToStaticMarkup(<OverviewChart assignments={assignments} rows={rows} />);
    const [line] = paths(html);
    const m = /^M (\d+\.?\d*) (\d+\.?\d*) L (\d+\.?\d*) (\d+\.?\d*)$/.exec(line);
    expect(m).not.toBeNull();
    expect(m[2]).toBe(m[4]);
  });
});
