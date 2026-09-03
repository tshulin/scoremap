import React from 'react';
import { Link } from 'react-router-dom';

import ScoremapWordmark from '../components/ScoremapWordmark.jsx';

function Shutdown() {
  React.useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Scoremap is shutting down';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="gm-shutdown-page">
      <header className="gm-shutdown-header">
        <Link to="/" aria-label="Back to the Scoremap home page" className="gm-shutdown-wordmark">
          <ScoremapWordmark />
        </Link>
      </header>

      <article className="gm-shutdown-article">
        <h1>Scoremap is shutting down</h1>
        <time dateTime="2026-09-03">September 3, 2026</time>

        <p>Scoremap is no longer connecting to school district systems and sign-in has been disabled.</p>

        <p>
          Scoremap started as a small, independent, open-source project built to give students a
          better way to view and understand information they could already access through their
          school portal. It was free, not affiliated with any school district, and designed with
          privacy in mind.
        </p>

        <h2>Why is Scoremap shutting down?</h2>

        <p>
          Edupoint Educational Systems, the company behind the student information systems used by
          the districts Scoremap supported, contacted us and asked us to stop accessing its systems.
        </p>

        <p>
          Although Scoremap was designed to keep student credentials and records out of our servers,
          Edupoint&apos;s position is that third-party applications are not authorized to connect to its
          systems using student credentials.
        </p>

        <p>
          We&apos;re complying with their request. As a result, Scoremap can no longer provide grades,
          attendance, mail, documents, or other portal information.
        </p>

        <h2>What happens now?</h2>

        <p>
          Scoremap will remain online in a demo-only state, but it will no longer connect to school
          district systems.
        </p>

        <p>
          The project will also <strong>remain open source</strong>. Its code will continue to be
          publicly available for anyone interested in learning from it or using ideas from it in
          their own personal projects.
        </p>

        <p>
          In just about the span of two weeks, the site reached{' '}
          <strong>around ~3.5k users across 8+ school districts</strong> in 6 states. We&apos;d like to
          thank everyone who used Scoremap, shared it with friends, and sent us feedback. We&apos;re
          incredibly grateful that something we built ended up reaching thousands of students.
        </p>

        <p className="gm-shutdown-thanks"><strong>Thank you for using Scoremap.</strong> ❤️</p>
      </article>
    </main>
  );
}

export default Shutdown;
