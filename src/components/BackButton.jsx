// Circular back arrow pinned to the page's top-left corner (login/signup
// pages). Navigates to an explicit destination rather than history-back, so
// it works the same when the page was opened directly.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '../lib/icons.jsx';

function BackButton({ to = '/', label = 'Back' }) {
  const navigate = useNavigate();
  return (
    <button
      aria-label={label}
      onClick={() => navigate(to)}
      style={{
        position: 'fixed',
        top: 24,
        left: 24,
        zIndex: 40,
        width: 38,
        height: 38,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-full)',
        border: '1px solid var(--color-hairline-strong)',
        background: 'var(--color-surface-card)',
        color: 'var(--color-body)',
        cursor: 'pointer',
      }}
    >
      <ArrowLeftIcon size={17} />
    </button>
  );
}

export default BackButton;
