/**
 * PrivacyDialog - the privacy explainer as a popup (same Dialog chrome as the
 * class-page target calculator) instead of a routed page. Opened from the
 * sidebar and landing-page data notices.
 */
import React from 'react';
import { createPortal as renderDialog } from 'react-dom';
import { Dialog } from '../pages/class/ui.jsx';

const LEARN_MORE_URL = 'https://github.com/tshulin/scoremap';

function PrivacyDialog({ onClose }) {
  const paragraph = {
    margin: 0,
    color: 'var(--color-body)',
    fontSize: 'var(--text-body-md-size)',
    lineHeight: 1.65,
  };

  // Render at <body>: the sidebar <aside> is position:sticky, which traps a
  // dialog rendered inside it in the aside's stacking context - content that
  // animates with transforms (NumberFlow digits) would paint over the overlay.
  return renderDialog(
    <Dialog title="Your privacy" onClose={onClose} maxWidth={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={paragraph}>This retired Scoremap demo uses fictional sample data bundled with the site.</p>

        <p style={paragraph}>
          It has no sign-in, makes no connection to an external school system, and does not contain
          any real student's records.{' '}
          <a href={LEARN_MORE_URL} target="_blank" rel="noreferrer">Learn more ↗</a>
        </p>

        <p style={paragraph}>
          If you have questions or concerns about Scoremap, you can contact us at{' '}
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
          Scoremap is an independent project and is not affiliated with or endorsed by any school district,
          school information system, or vendor.
        </p>
      </div>
    </Dialog>,
    document.body,
  );
}

export default PrivacyDialog;
