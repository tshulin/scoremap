// The single scenario state every grade feature reads: real assignments plus
// per-assignment edits plus added hypotheticals, exposed as one `effective`
// list. Session-only on purpose - stale fake assignments mixed into freshly
// synced real data is the worst failure mode here.
import { useCallback, useMemo, useRef, useState } from 'react';
import { todayIso } from './ui.jsx';

export function useScenario(baseAssignments) {
  const [hypothetical, setHypothetical] = useState(false);
  // { [assignmentId]: { name, earned, possible, category, date, notForGrade } } - score
  // fields as input strings; name/category/date as committed values. Applies
  // to real AND added rows, so every assignment is editable the same way.
  const [edits, setEdits] = useState({});
  // Added hypotheticals, ids "hypo-1", "hypo-2", … Born blank: no score, no
  // category - the row itself is the editor, there is nothing to decide first.
  const [added, setAdded] = useState([]);
  const seq = useRef(1);

  const setEdit = useCallback((id, field, value) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }, []);

  const toggleHypothetical = useCallback((on) => {
    setHypothetical(on);
    if (!on) {
      setEdits({});
      setAdded([]);
    }
  }, []);

  // Clear every edit and added row but stay in hypothetical mode.
  const reset = useCallback(() => {
    setEdits({});
    setAdded([]);
  }, []);

  const addAssignment = useCallback(() => {
    const id = `hypo-${seq.current++}`;
    setAdded((prev) => [...prev, { id, name: '', extraCredit: false, notForGrade: false, date: todayIso() }]);
    return id;
  }, []);

  // Patch fields that live on the added row itself (name, extraCredit).
  const updateAssignment = useCallback((id, patch) => {
    setAdded((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);

  const removeAssignment = useCallback((id) => {
    setAdded((prev) => prev.filter((a) => a.id !== id));
    setEdits((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const effective = useMemo(() => {
    if (!hypothetical) return baseAssignments;
    const apply = (a) => {
      const e = edits[a.id];
      if (!e) return a;
      const out = { ...a };
      const earned = parseFloat(e.earned);
      const possible = parseFloat(e.possible);
      if (e.earned !== undefined && e.earned !== '' && Number.isFinite(earned)) {
        out.pointsEarned = earned;
      }
      if (e.possible !== undefined && e.possible !== '' && Number.isFinite(possible)) {
        out.pointsPossible = possible;
      }
      // A cleared name falls back to the original - no assignment is nameless.
      if (e.name !== undefined && e.name.trim() !== '') out.name = e.name;
      // '' means "no category" (back to uncategorized); an absent key means untouched.
      if (e.category !== undefined) out.category = e.category || undefined;
      if (e.date !== undefined && e.date !== '') out.date = e.date;
      // Not-for-grade is a hypothesis too: "what if this actually counted?"
      if (e.notForGrade !== undefined) out.notForGrade = e.notForGrade;
      return out;
    };
    return [
      ...baseAssignments,
      // A nameless blank still needs a label in the chart tooltip and calculators.
      ...added.map((a) => (a.name ? a : { ...a, name: 'Hypothetical assignment' })),
    ].map(apply);
  }, [hypothetical, baseAssignments, added, edits]);

  return {
    hypothetical,
    toggleHypothetical,
    reset,
    edits,
    setEdit,
    added,
    addAssignment,
    updateAssignment,
    removeAssignment,
    effective,
  };
}
