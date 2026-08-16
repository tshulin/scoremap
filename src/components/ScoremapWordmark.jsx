import React from 'react';
import logoBlue from '../assets/logoblue.png';

/**
 * Scoremap's compact brand lockup. The mark is sized in ems so it always
 * follows the surrounding wordmark text instead of introducing a second size.
 */
export default function ScoremapWordmark({ style, ...props }) {
  return (
    <span
      {...props}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4em',
        ...style,
      }}
    >
      <img
        src={logoBlue}
        alt=""
        aria-hidden="true"
        style={{
          display: 'block',
          width: '1.2em',
          height: '1.2em',
          objectFit: 'contain',
          flexShrink: 0,
        }}
      />
      <span>Scoremap</span>
    </span>
  );
}
