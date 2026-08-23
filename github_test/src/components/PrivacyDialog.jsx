/**
 * PrivacyDialog — the privacy explainer as a popup (same Dialog chrome as the
 * class-page target calculator) instead of a routed page. Opened from the
 * sidebar privacy note and the landing page's "Private login" card.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from '../pages/class/ui.jsx';

// TODO: destination for the technical explainer — Tiger will add the link.
const LEARN_MORE_URL = '#';

function PrivacyDialog({ onClose }) {
  const paragraph = {
    margin: 0,
    color: 'var(--color-body)',
    fontSize: 'var(--text-body-md-size)',
    lineHeight: 1.65,
  };

  // Portal to <body>: the sidebar <aside> is position:sticky, which traps a
  // dialog rendered inside it in the aside's stacking context — content that
  // animates with transforms (NumberFlow digits) would paint over the overlay.
  return createPortal(
    <Dialog title="Your privacy" onClose={onClose} maxWidth={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={paragraph}>Grademax is designed to keep students' information private.</p>

        <p style={paragraph}>
          Your password, login info, and grades are only ever viewed by StudentVUE and you —
          Grademax can't read any of it.{' '}
          <a href={LEARN_MORE_URL}>Learn more ↗</a>
        </p>

        <p style={paragraph}>
          If you have questions or concerns about Grademax, you can contact us at{' '}
          <a href="mailto:contact@scoremap.org">contact@scoremap.org</a>.
        </p>

        <p
          style={{
            margin: 0,
            color: 'var(--color-muted)',
            fontSize: 'var(--text-caption-size)',
            lineHeight: 1.5,
          }}
        >
          StudentVUE is a registered trademark of Edupoint Educational Systems LLC. Grademax is not
          affiliated with or endorsed by Edupoint Educational Systems LLC.
        </p>
      </div>
    </Dialog>,
    document.body,
  );
}

export default PrivacyDialog;
