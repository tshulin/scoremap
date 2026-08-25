// Scoremap design-system entry.
//
// The design references read components off a global published by the compiled
// bundle (`window.ScoremapDesignSystem_faa73b`). Rather than vendoring/rewriting
// that bundle, we load it for its side effects and re-export the components as
// named ES exports, so pages can do the README's "mechanical swap":
//   const { Button } = window.ScoremapDesignSystem_faa73b;   // before
//   import { Button } from '../lib/ds.js';                    // after
//
// Import order matters: ./reactGlobal must run first so `window.React` exists
// when the bundle IIFE executes.
import './reactGlobal.js';
import '../../ds/_ds_bundle.js';

const ns = window.ScoremapDesignSystem_faa73b || {};

if (ns.__errors && ns.__errors.length) {
  // Surface any component that failed to evaluate inside the bundle.
  console.error('[grademax-design-system] bundle errors:', ns.__errors);
}

export const Badge = ns.Badge;
export const Button = ns.Button;
export const FeatureCard = ns.FeatureCard;
export const TestimonialCard = ns.TestimonialCard;
export const WorkflowStepCard = ns.WorkflowStepCard;
export const TextInput = ns.TextInput;
export const BrowserMockup = ns.BrowserMockup;
export const CtaBand = ns.CtaBand;
export const Footer = ns.Footer;
export const HeroBand = ns.HeroBand;
export const TopNav = ns.TopNav;

export default ns;
