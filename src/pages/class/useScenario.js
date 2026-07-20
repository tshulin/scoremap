// The single scenario state every grade feature reads: real assignments plus
// score edits plus added hypotheticals, exposed as one `effective` list.
// Session-only on purpose — stale fake assignments mixed into freshly synced
// real data is the worst failure mode here.
import { useCallback, useMemo, useRef, useState } from 'react';

const today = () => new Date().toISOString().slice(0, 10);

export function useScenario(baseAssignments) {
  const [hypothetical, setHypothetical] = useState(false);
  // { [assignmentId]: { earned, possible } } as input strings.
  const [edits, setEdits] = useState({});
  // Full domain Assignments with ids "hypo-1", "hypo-2", …
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

  const addAssignment = useCallback(({ name, category, pointsEarned, pointsPossible, extraCredit, date }) => {
    const id = `hypo-${seq.current++}`;
    const a = {
      id,
      name: name || 'Hypothetical assignment',
      extraCredit: !!extraCredit,
      notForGrade: false,
      date: date || today(),
    };
    const earned = parseFloat(pointsEarned);
    const possible = parseFloat(pointsPossible);
    if (Number.isFinite(earned)) a.pointsEarned = earned;
    if (Number.isFinite(possible)) a.pointsPossible = possible;
    if (category) a.category = category;
    setAdded((prev) => [...prev, a]);
    return id;
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
      return out;
    };
    return [...baseAssignments, ...added].map(apply);
  }, [hypothetical, baseAssignments, added, edits]);

  return {
    hypothetical,
    toggleHypothetical,
    edits,
    setEdit,
    added,
    addAssignment,
    removeAssignment,
    effective,
  };
}
