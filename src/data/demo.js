// Demo mode - run the app signed-in on sample data with no relay, no portal,
// and no real login. Dev-only: the deploy workflow never sets VITE_DEMO, and
// this module refuses to load in a production build at all.
export const DEMO = import.meta.env?.VITE_DEMO === 'true';

if (DEMO && import.meta.env?.PROD) {
  throw new Error('VITE_DEMO must never be set on a production build.');
}

export const DEMO_STUDENT = {
  name: 'Demo Student',
  permId: 'DEMO-0000',
  gender: '',
  grade: '10',
};
