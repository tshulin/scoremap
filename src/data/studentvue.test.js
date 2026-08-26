// The sync layer's request budget. Every portal request the app makes is
// charged against a per-IP limit an entire school shares, so "which requests
// does a refresh actually make" is a correctness property, not a nicety -
// these tests assert the call counts, not just the mapped output.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_ATTENDANCE, SAMPLE_GRADEBOOK } from './placeholders';

const api = vi.hoisted(() => ({
  getStudent: vi.fn(),
  getGradebook: vi.fn(),
  getAttendance: vi.fn(),
  getDocuments: vi.fn(),
  getMail: vi.fn(),
  isTestSession: vi.fn(() => false),
  recallStudent: vi.fn(() => null),
  rememberStudent: vi.fn(),
  recallCredentials: vi.fn(() => null),
}));

vi.mock('./api.js', () => api);
vi.mock('./gradeIndexStore.js', () => ({ harvestFromClasses: vi.fn() }));

const { sync } = await import('./studentvue.js');

const STUDENT = { name: 'Ada Lovelace', grade: '11' };

const MAIL_MESSAGE = {
  id: 'MSG-1',
  subject: 'Picture day',
  sender: { name: 'Front Office', role: 'Staff', email: 'office@example.net' },
  date: '2026-03-04',
  body: [],
  links: [],
  attachments: [],
  bodyLoaded: false,
  hasAttachments: false,
  isSystemMessage: false,
};

const DOCUMENT = {
  docToken: 'DOC-1',
  title: 'Report Card',
  category: 'Grades',
  uploadDate: '2026-02-01',
};

beforeEach(() => {
  vi.clearAllMocks();
  api.isTestSession.mockReturnValue(false);
  api.recallStudent.mockReturnValue(null);
  api.getStudent.mockResolvedValue(STUDENT);
  api.getGradebook.mockResolvedValue({ gradebook: SAMPLE_GRADEBOOK, placeholder: false });
  api.getAttendance.mockResolvedValue({ attendance: SAMPLE_ATTENDANCE, placeholder: false });
  api.getDocuments.mockResolvedValue([DOCUMENT]);
  api.getMail.mockResolvedValue({ messages: [MAIL_MESSAGE], unreadableMessages: 0 });
});

const callCounts = () => ({
  student: api.getStudent.mock.calls.length,
  gradebook: api.getGradebook.mock.calls.length,
  attendance: api.getAttendance.mock.calls.length,
  documents: api.getDocuments.mock.calls.length,
  mail: api.getMail.mock.calls.length,
});

describe('sync scope', () => {
  it('fetches every resource once when no scope is given', async () => {
    const data = await sync(STUDENT);

    expect(callCounts()).toEqual({
      student: 0, // sign-in already fetched it
      gradebook: 1,
      attendance: 1,
      documents: 1,
      mail: 1,
    });
    expect(data.classes.length).toBeGreaterThan(0);
    expect(data.documents).toHaveLength(1);
    expect(data.mail.messages).toHaveLength(1);
  });

  it('fetches only the scoped resource', async () => {
    const full = await sync(STUDENT);
    vi.clearAllMocks();

    await sync(undefined, { scope: ['gradebook'], previous: full });

    expect(callCounts()).toEqual({
      student: 0,
      gradebook: 1,
      attendance: 0,
      documents: 0,
      mail: 0,
    });
  });

  it.each([
    ['gradebook', 'gradebook'],
    ['attendance', 'attendance'],
    ['documents', 'documents'],
    ['mail', 'mail'],
  ])('a %s refresh calls nothing but %s', async (scope, expected) => {
    const full = await sync(STUDENT);
    vi.clearAllMocks();

    await sync(undefined, { scope: [scope], previous: full });

    const counts = callCounts();
    expect(counts[expected]).toBe(1);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(1);
  });

  // The whole point of a scoped refresh: what it did not fetch must survive.
  it('keeps out-of-scope sections exactly as they were', async () => {
    const full = await sync(STUDENT);
    const next = await sync(undefined, { scope: ['gradebook'], previous: full });

    expect(next.documents).toEqual(full.documents);
    expect(next.mail).toEqual(full.mail);
    expect(next.attendance).toEqual(full.attendance);
    expect(next.meta.documents).toEqual(full.meta.documents);
    expect(next.meta.mail).toEqual(full.meta.mail);
    expect(next.session.studentName).toBe(STUDENT.name);
  });

  it('does not report an out-of-scope resource as failed', async () => {
    const full = await sync(STUDENT);
    const next = await sync(undefined, { scope: ['mail'], previous: full });

    // Nothing asked the gradebook for anything, so its status is untouched -
    // a scoped refresh must never paint an error onto a page it did not sync.
    expect(next.meta.gradebook.ok).toBe(true);
    expect(next.meta.gradebook.message).toBe('');
  });

  it('refreshes the scoped section even when it fails, without losing the rest', async () => {
    const full = await sync(STUDENT);
    api.getMail.mockRejectedValue(Object.assign(new Error('Mail is down.'), { code: 'OFFLINE' }));

    const next = await sync(undefined, { scope: ['mail'], previous: full });

    expect(next.meta.mail).toEqual({ ok: false, placeholder: false, message: 'Mail is down.' });
    // The failure is confined to mail's meta; the messages already on screen stay.
    expect(next.mail).toEqual(full.mail);
    expect(next.classes).toEqual(full.classes);
  });

  it('advances lastUpdated on a scoped refresh', async () => {
    const full = await sync(STUDENT);
    const next = await sync(undefined, { scope: ['documents'], previous: full });

    expect(next.session.lastUpdated.getTime()).toBeGreaterThanOrEqual(
      full.session.lastUpdated.getTime(),
    );
  });

  it('propagates a 401 from a scoped resource so the app can sign out', async () => {
    api.getDocuments.mockRejectedValue(Object.assign(new Error('expired'), { status: 401 }));

    await expect(sync(STUDENT, { scope: ['documents'] })).rejects.toMatchObject({ status: 401 });
  });
});

describe('student identity', () => {
  it('never asks the portal when sign-in already handed the student over', async () => {
    await sync(STUDENT);
    expect(api.getStudent).not.toHaveBeenCalled();
  });

  it('never asks the portal when the name was mirrored to storage', async () => {
    api.recallStudent.mockReturnValue(STUDENT);

    const data = await sync(undefined);

    expect(api.getStudent).not.toHaveBeenCalled();
    expect(data.session.studentName).toBe(STUDENT.name);
  });

  it('never asks the portal when the previous snapshot knows the name', async () => {
    const full = await sync(STUDENT);
    api.recallStudent.mockReturnValue(null);
    vi.clearAllMocks();

    const next = await sync(undefined, { scope: ['mail'], previous: full });

    expect(api.getStudent).not.toHaveBeenCalled();
    expect(next.session.studentName).toBe(STUDENT.name);
  });

  it('asks the portal only when nothing knows who is signed in', async () => {
    const data = await sync(undefined, { scope: [] });

    expect(api.getStudent).toHaveBeenCalledTimes(1);
    expect(data.session.studentName).toBe(STUDENT.name);
    expect(api.rememberStudent).toHaveBeenCalledWith(STUDENT);
  });

  it('survives a failed student fetch when nothing else knows the name', async () => {
    api.getStudent.mockRejectedValue(new Error('student info unreadable'));

    const data = await sync(undefined, { scope: [] });

    // No name to show, but the sync still resolves rather than throwing.
    expect(data.session.studentName).toBe('');
    expect(api.rememberStudent).not.toHaveBeenCalled();
  });

  // The login form prefills from these if the saved sign-in ever stops working.
  it('stamps the saved account into the session', async () => {
    api.recallCredentials.mockReturnValue({ domain: 'ca-x-psv.edupoint.com', username: 'ada', password: 'pw' });

    const data = await sync(STUDENT);

    expect(data.session.username).toBe('ada');
    expect(data.session.domain).toBe('ca-x-psv.edupoint.com');
  });
});

describe('progressive sync', () => {
  it('paints grades from the first partial, before any background resource lands', async () => {
    // The gradebook hands out its landing-page partial synchronously; mail
    // stalls until everything else is over.
    api.getGradebook.mockImplementation(async ({ onPartial } = {}) => {
      if (onPartial) onPartial(SAMPLE_GRADEBOOK);
      return { gradebook: SAMPLE_GRADEBOOK, placeholder: false };
    });

    const updates = [];
    const stages = [];
    const data = await sync(STUDENT, {
      onUpdate: (snapshot) => updates.push(snapshot),
      onStage: (stage) => stages.push(stage),
    });

    // The first update carries the mapped classes and none of the mail that
    // had not arrived yet.
    expect(updates.length).toBeGreaterThan(1);
    expect(updates[0].classes.length).toBeGreaterThan(0);
    expect(updates[0].mail.messages).toHaveLength(0);
    // Every emission is a fresh object, so React re-renders on identity.
    expect(updates[0]).not.toBe(updates[1]);
    // The final resolution matches the last emission's data.
    expect(data.classes).toEqual(updates[updates.length - 1].classes);
    expect(data.mail.messages).toHaveLength(1);

    // The pill narrates: grades first, immediately - then each stage falls
    // away in display order, ending quiet.
    expect(stages[0]).toBe('grades');
    expect(stages[1]).toBe('assignments');
    expect(stages[stages.length - 1]).toBeNull();
    expect(stages).toContain('attendance');
    expect(stages).toContain('mail');
  });

  it('announces only the scoped stages on a scoped refresh', async () => {
    const full = await sync(STUDENT);
    const stages = [];
    await sync(undefined, { scope: ['mail'], previous: full, onStage: (s) => stages.push(s) });
    expect(stages[0]).toBe('mail');
    expect(stages[stages.length - 1]).toBeNull();
    expect(stages).not.toContain('grades');
    expect(stages).not.toContain('attendance');
  });

  it('still resolves all-at-once for callers passing no callbacks', async () => {
    const data = await sync(STUDENT);
    expect(data.classes.length).toBeGreaterThan(0);
    expect(data.mail.messages).toHaveLength(1);
  });
});

describe('onGrades', () => {
  it('fires exactly once, the moment the first gradebook partial paints', async () => {
    const order = [];
    api.getGradebook.mockImplementation(async ({ onPartial } = {}) => {
      if (onPartial) {
        order.push('partial');
        onPartial(SAMPLE_GRADEBOOK);
      }
      return { gradebook: SAMPLE_GRADEBOOK, placeholder: false };
    });
    let fired = 0;
    await sync(STUDENT, { onGrades: () => { fired++; order.push('grades-ready'); } });
    expect(fired).toBe(1);
    expect(order).toEqual(['partial', 'grades-ready']);
  });

  it('still fires when the gradebook resolves without partials (placeholder path)', async () => {
    let fired = 0;
    await sync(STUDENT, { onGrades: () => fired++ });
    expect(fired).toBe(1);
  });

  it('does not fire when the gradebook fails', async () => {
    api.getGradebook.mockRejectedValue(Object.assign(new Error('portal down'), { status: 502 }));
    let fired = 0;
    await sync(STUDENT, { onGrades: () => fired++ });
    expect(fired).toBe(0);
  });
});

describe('landing partial merge', () => {
  // A landing-page gradebook the way some districts render it: letters only,
  // percentage 0, no assignments anywhere.
  const landingOnly = () => {
    const gb = JSON.parse(JSON.stringify(SAMPLE_GRADEBOOK));
    for (const course of gb.courses)
      for (const mark of course.marks) {
        mark.percentage = 0;
        mark.assignments = [];
        delete mark.categories;
      }
    return gb;
  };

  it('a refresh keeps last-visit grades on screen instead of dropping them to 0%', async () => {
    const full = await sync(STUDENT);
    const known = full.classes.find((c) => c.pct != null && c.pct > 0);
    expect(known).toBeTruthy();

    const updates = [];
    api.getGradebook.mockImplementation(async ({ onPartial } = {}) => {
      if (onPartial) onPartial(landingOnly());
      return { gradebook: SAMPLE_GRADEBOOK, placeholder: false };
    });
    const next = await sync(undefined, { previous: full, onUpdate: (s) => updates.push(s) });

    // The first emission is the landing partial - it must still show the
    // cached grade and the cached assignments, never a 0% wipe.
    const partial = updates[0].classes.find((c) => c.id === known.id);
    expect(partial.pct).toBe(known.pct);
    expect(partial.grade).toBe(known.grade);
    expect(updates[0].assignmentsByClass[known.id].length).toBe(
      full.assignmentsByClass[known.id].length,
    );
    // And the final snapshot carries the real fresh values.
    expect(next.classes.find((c) => c.id === known.id).pct).toBe(known.pct);
  });

  it('with no cache, a letter-only landing defers grades-ready to the full gradebook', async () => {
    const events = [];
    api.getGradebook.mockImplementation(async ({ onPartial } = {}) => {
      if (onPartial) {
        events.push('partial');
        onPartial(landingOnly());
      }
      events.push('resolve');
      return { gradebook: SAMPLE_GRADEBOOK, placeholder: false };
    });
    await sync(STUDENT, { onGrades: () => events.push('grades-ready') });
    // Not announced at the uninformative partial - only once real grades exist.
    expect(events.indexOf('grades-ready')).toBeGreaterThan(events.indexOf('resolve'));
    expect(events.filter((e) => e === 'grades-ready')).toHaveLength(1);
  });

  it('an informative landing partial still announces grades immediately', async () => {
    const events = [];
    api.getGradebook.mockImplementation(async ({ onPartial } = {}) => {
      if (onPartial) {
        events.push('partial');
        onPartial(SAMPLE_GRADEBOOK);
      }
      events.push('resolve');
      return { gradebook: SAMPLE_GRADEBOOK, placeholder: false };
    });
    await sync(STUDENT, { onGrades: () => events.push('grades-ready') });
    expect(events.indexOf('grades-ready')).toBeLessThan(events.indexOf('resolve'));
  });
});
