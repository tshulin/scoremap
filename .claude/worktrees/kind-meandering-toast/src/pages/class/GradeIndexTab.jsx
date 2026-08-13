// The class's letter scale: cutoffs observed from the portal's own letters,
// defaults where nothing has been seen, and student overrides on top. The
// portal computes letters server-side per teacher — we reconstruct the scale
// the letters imply, honestly labeled by source.
import React from 'react';
import { clearOverride, resetOverrides, setOverride, useGradeIndex } from '../../data/gradeIndexStore.js';
import { Chip, ScoreInput } from './ui.jsx';

const SOURCE_LABEL = { observed: 'observed', default: 'default', custom: 'custom' };
const SOURCE_TONE = { observed: 'info', default: 'neutral', custom: 'assignment' };

function CutoffRow({ classId, row }) {
  const [draft, setDraft] = React.useState(String(row.lowerBound));
  React.useEffect(() => setDraft(String(row.lowerBound)), [row.lowerBound]);

  const commit = () => {
    const value = parseFloat(draft);
    if (!Number.isFinite(value) || value < 0 || value > 200) {
      setDraft(String(row.lowerBound));
      return;
    }
    if (value !== row.lowerBound) setOverride(classId, row.letter, value);
  };

  return (
    <tr style={{ borderTop: '1px solid var(--color-hairline)' }}>
      <td style={{ padding: '10px 16px 10px 0', fontWeight: 600, fontSize: 16 }}>{row.letter}</td>
      <td style={{ padding: '10px 16px 10px 0' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ScoreInput
            value={draft}
            placeholder="—"
            label={`${row.letter} cutoff`}
            onChange={setDraft}
            width={72}
          />
          <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>% and up</span>
        </span>
      </td>
      <td style={{ padding: '10px 16px 10px 0' }}>
        <Chip tone={SOURCE_TONE[row.source]}>{SOURCE_LABEL[row.source]}</Chip>
      </td>
      <td style={{ padding: '10px 0', textAlign: 'right' }}>
        <span style={{ display: 'inline-flex', gap: 8 }}>
          {draft !== String(row.lowerBound) && (
            <button
              onClick={commit}
              aria-label={`Save ${row.letter} cutoff`}
              style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-primary)', color: 'var(--color-on-primary)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Save
            </button>
          )}
          {row.source === 'custom' && (
            <button
              onClick={() => clearOverride(classId, row.letter)}
              aria-label={`Reset ${row.letter} cutoff`}
              title="Back to the observed/default cutoff"
              style={{ border: 'none', background: 'transparent', color: 'var(--color-text-link)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
            >
              ↺
            </button>
          )}
        </span>
      </td>
    </tr>
  );
}

function GradeIndexTab({ classId }) {
  const { scale, observations, overrides } = useGradeIndex(classId);
  const hasOverrides = Object.keys(overrides).length > 0;
  const observedCount = observations.length;

  return (
    <div
      style={{
        background: 'var(--color-surface-card)',
        border: '1px solid var(--color-hairline-strong)',
        borderRadius: 'var(--radius-xl)',
        padding: '18px 24px',
        maxWidth: 560,
      }}
    >
      <div style={{ fontSize: 14, color: 'var(--color-body)', marginBottom: 4 }}>
        {observedCount > 0
          ? `Cutoffs inferred from ${observedCount} letter${observedCount === 1 ? '' : 's'} this portal has shown for this class, on top of the standard scale.`
          : 'No portal letters seen for this class yet — this is the standard scale.'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 14 }}>
        Based on grades seen so far; refine a cutoff manually if you know the teacher's exact
        scale. These letters label the hypothetical grade and both calculators — the portal's
        official letter is always shown as-is.
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, color: 'var(--color-ink)' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--color-muted)', fontSize: 13 }}>
            <th style={{ padding: '6px 16px 10px 0', fontWeight: 600 }}>Letter</th>
            <th style={{ padding: '6px 16px 10px 0', fontWeight: 600 }}>Starts at</th>
            <th style={{ padding: '6px 16px 10px 0', fontWeight: 600 }}>Source</th>
            <th style={{ padding: '6px 0 10px 0' }} />
          </tr>
        </thead>
        <tbody>
          {scale.map((row) => (
            <CutoffRow key={row.letter} classId={classId} row={row} />
          ))}
        </tbody>
      </table>
      {hasOverrides && (
        <div style={{ marginTop: 14 }}>
          <button
            onClick={() => resetOverrides(classId)}
            style={{ padding: '7px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-hairline-strong)', background: 'transparent', color: 'var(--color-body)', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Reset all custom cutoffs
          </button>
        </div>
      )}
    </div>
  );
}

export default GradeIndexTab;
