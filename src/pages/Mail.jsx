/**
 * Mail — the student's school messages (route: /mail).
 *
 * FRONTEND ONLY. MAIL below is local placeholder data matching the shape a
 * StudentVUE pull produces (subject, sender, date, body, links, attachments).
 * The backend will supply the real list later — swap MAIL then. MAIL is exported
 * so the message reader (MailDetail) can resolve a message by id.
 *
 * Uses the same card box as the Documents page for a consistent look. Clicking a
 * message opens the reader at /mail/:mailId.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import { PersonIcon, LinkIcon, PaperclipIcon } from '../lib/icons.jsx';

// --- placeholder data (backend/StudentVUE will replace this) ---
export const MAIL = [
  {
    id: 'm1',
    subject: 'Action Needed: DECA/ROP Survey',
    sender: 'Tami Raaker',
    role: 'Teacher',
    email: 'traaker@pleasantonusd.net',
    date: '2025-05-13',
    body: [
      'Hi all,',
      "Please complete the DECA/ROP end-of-year survey by this Friday. It helps us plan next year's program and only takes a couple of minutes.",
      'Regards,\nMrs. Raaker',
    ],
    links: [{ label: 'DECA/ROP Survey', url: '#' }],
    attachments: [],
  },
  {
    id: 'm2',
    subject: 'Grades: 09, 10, 11, 12, 13 - Are You Moving?',
    sender: 'Brigitte Holling',
    role: 'Staff',
    email: 'bholling@pleasantonusd.net',
    date: '2025-05-07',
    body: [
      'Families,',
      'If your student is moving or will not be returning to Foothill next year, please let the office know so we can update enrollment. The withdrawal form, FAQ, and office contact are linked below.',
      'Thank you,\nB. Holling',
    ],
    links: [
      { label: 'Withdrawal Form', url: '#' },
      { label: 'Enrollment FAQ', url: '#' },
      { label: 'Contact the Office', url: '#' },
    ],
    attachments: [],
  },
  {
    id: 'm3',
    subject: 'Grades: 09, 10, 11 - Summer Opportunities!',
    sender: 'Anabel Delgado',
    role: 'Staff',
    email: 'adelgado@pleasantonusd.net',
    date: '2025-04-28',
    body: [
      'Hello students,',
      'A number of summer programs, internships, and volunteer opportunities are now open. Details and application links are below, and the flyers are attached.',
      'Best,\nA. Delgado',
    ],
    links: [
      { label: 'Summer Internships', url: '#' },
      { label: 'Volunteer Portal', url: '#' },
      { label: 'Enrichment Camps', url: '#' },
      { label: 'Scholarships', url: '#' },
    ],
    attachments: [
      { name: 'Summer Programs.pdf' },
      { name: 'Internship Flyer.pdf' },
      { name: 'Volunteer Guide.pdf' },
      { name: 'Camp Schedule.pdf' },
      { name: 'Scholarship List.pdf' },
    ],
  },
  {
    id: 'm4',
    subject: 'Grades: 09, 10, 11 - Summer Enrichment Opportunities!',
    sender: 'Anabel Delgado',
    role: 'Staff',
    email: 'adelgado@pleasantonusd.net',
    date: '2025-04-22',
    body: [
      'Hello students,',
      'More enrichment opportunities for the summer have been posted. See the links below to learn more and apply.',
      'Best,\nA. Delgado',
    ],
    links: [
      { label: 'STEM Summer Institute', url: '#' },
      { label: 'Arts Intensive', url: '#' },
      { label: 'Writing Workshop', url: '#' },
      { label: 'Leadership Camp', url: '#' },
    ],
    attachments: [],
  },
  {
    id: 'm5',
    subject: 'Grades: 09, 10, 11, 12 - Volunteers Needed!',
    sender: 'Anabel Delgado',
    role: 'Staff',
    email: 'adelgado@pleasantonusd.net',
    date: '2025-04-17',
    body: [
      'Hi everyone,',
      "We're looking for volunteers to help at upcoming school events. Sign up using the link below — all grade levels welcome.",
      'Thanks,\nA. Delgado',
    ],
    links: [{ label: 'Volunteer Sign-Up', url: '#' }],
    attachments: [],
  },
  {
    id: 'm6',
    subject: 'Grades: 09, 10, 11, 12 - Volunteer Opportunities!',
    sender: 'Anabel Delgado',
    role: 'Staff',
    email: 'adelgado@pleasantonusd.net',
    date: '2025-04-15',
    body: [
      'Hi everyone,',
      'New volunteer opportunities are available this month. Check the links below for details and to sign up.',
      'Thanks,\nA. Delgado',
    ],
    links: [
      { label: 'Community Cleanup', url: '#' },
      { label: 'Tutoring Program', url: '#' },
    ],
    attachments: [],
  },
  {
    id: 'm7',
    subject: 'Grades: 09, 10, 11, 12 - Out of State Mini College Fair: Tomorrow during lunch at FHS!',
    sender: 'Anabel Delgado',
    role: 'Staff',
    email: 'adelgado@pleasantonusd.net',
    date: '2025-04-14',
    body: [
      'Students,',
      'A mini college fair with out-of-state schools will be held tomorrow during lunch at FHS. Stop by to meet admissions reps — the list of attending colleges is attached.',
      'Best,\nA. Delgado',
    ],
    links: [],
    attachments: [{ name: 'College List.pdf' }],
  },
];

const fmtDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${String(y).slice(2)}`;
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const TONES = {
  neutral: { background: 'var(--color-surface-strong)', color: 'var(--color-body)', border: '1px solid var(--color-hairline)' },
  link: { background: 'rgba(0, 201, 80, 0.14)', color: 'var(--color-grade-good)', border: '1px solid transparent' },
  attachment: { background: 'rgba(168, 85, 247, 0.14)', color: 'var(--color-preview)', border: '1px solid transparent' },
};

function Chip({ icon, tone = 'neutral', children }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        ...TONES[tone],
      }}
    >
      {icon}
      {children}
    </span>
  );
}

function Mail() {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(null);

  const messages = [...MAIL].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-canvas)', fontFamily: 'var(--font-sans)' }}>
      <Sidebar />

      <main style={{ flex: 1, padding: '32px 40px 64px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          {/* sync status */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 12,
                padding: '7px 14px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid var(--color-hairline-strong)',
                background: 'var(--color-surface-card)',
                fontSize: 13,
                color: 'var(--color-body)',
              }}
            >
              <span>Last updated last month</span>
              <a href="#" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span aria-hidden="true">↻</span> Refresh
              </a>
            </div>
          </div>

          {/* message list — same narrow card box as Documents */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820, margin: '0 auto' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: 15, padding: '48px 0' }}>
                No messages.
              </div>
            )}
            {messages.map((m) => {
              const hov = hovered === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => navigate(`/mail/${m.id}`)}
                  onMouseEnter={() => setHovered(m.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    background: 'var(--color-surface-card)',
                    border: '1px solid var(--color-hairline-strong)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '20px 24px',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    boxShadow: hov ? 'var(--shadow-soft-drop)' : 'none',
                    transition: 'box-shadow 150ms ease',
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-ink)', marginBottom: 10, letterSpacing: '-0.2px' }}>
                    {m.subject}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <Chip icon={<PersonIcon />}>
                      {m.sender} ({m.role})
                    </Chip>
                    <Chip>{fmtDate(m.date)}</Chip>
                    {m.links.length > 0 && (
                      <Chip tone="link" icon={<LinkIcon />}>
                        {plural(m.links.length, 'Link')}
                      </Chip>
                    )}
                    {m.attachments.length > 0 && (
                      <Chip tone="attachment" icon={<PaperclipIcon />}>
                        {plural(m.attachments.length, 'Attachment')}
                      </Chip>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

export default Mail;
