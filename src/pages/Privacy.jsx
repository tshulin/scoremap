import React from 'react';

function Privacy() {
  const paragraph = {
    margin: 0,
    color: 'var(--color-body)',
    fontSize: 'var(--text-body-md-size)',
    lineHeight: 1.65,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-canvas)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px 24px 40px',
        }}
      >
        <article
          style={{
            width: 640,
            maxWidth: '100%',
            padding: 32,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            background: 'var(--color-surface-card)',
            border: '1px solid var(--color-hairline-strong)',
            borderRadius: 'var(--radius-xl)',
          }}
        >
          <h1
            style={{
              margin: 0,
              color: 'var(--color-ink)',
              fontSize: 'var(--text-display-sm-size)',
              fontWeight: 'var(--text-display-sm-weight)',
              letterSpacing: 'var(--text-display-sm-tracking)',
              lineHeight: 'var(--text-display-sm-leading)',
            }}
          >
            About the privacy of Grademax
          </h1>

          <p style={paragraph}>Grademax is designed to keep students' information private.</p>

          <p style={paragraph}>
            When a student uses the Grademax interface, their own device transmits their username
            and password directly to the official student portal, which returns their student
            information directly to their device.
          </p>

          <p style={paragraph}>
            Grademax servers do not receive any student data or login information. The Grademax
            interface is purely client-side: all data is retrieved, processed, and stored on-device.
          </p>

          <p style={paragraph}>
            If you have questions or concerns about Grademax, you can contact us on{' '}
            <a href="https://github.com/tshulin/grademax" target="_blank" rel="noreferrer">
              GitHub
            </a>
            .
          </p>
        </article>
      </main>

      <footer
        style={{
          padding: 24,
          textAlign: 'center',
          color: 'var(--color-muted)',
          fontSize: 'var(--text-caption-size)',
          lineHeight: 1.5,
        }}
      >
        StudentVUE is a registered trademark of Edupoint Educational Systems LLC. Grademax is not
        affiliated with or endorsed by Edupoint Educational Systems LLC.
      </footer>
    </div>
  );
}

export default Privacy;
