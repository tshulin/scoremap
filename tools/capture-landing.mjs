// Retakes the landing gallery screenshots in public/landing/ from the built-in
// display account, then bakes their side panels (bake-landing-sides.mjs).
//
// Usage: node tools/capture-landing.mjs [light|dark ...]
// Starts its own Vite dev server, so nothing else needs to be running.
// Uses the installed Microsoft Edge; set CAPTURE_BROWSER=chrome to use Chrome.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { LANDING_DIR, bakeSides, launchBrowser } from './bake-landing-sides.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THEMES = process.argv.length > 2 ? process.argv.slice(2) : ['light', 'dark'];

// 1140x752 at 2.5x = 2850x1880, the size and zoom the gallery was designed around.
const VIEWPORT = { width: 1140, height: 752 };
const SCALE = 2.5;
// A fixed clock keeps the greeting, "Last updated" time and attendance month stable.
const CLOCK = new Date('2026-08-11T13:17:00');

// The demo flag boots a different sample student; the gallery shows the display account.
delete process.env.VITE_DEMO;
const server = await createServer({ root: ROOT, logLevel: 'warn', server: { port: 5200 } });
await server.listen();
const baseUrl = server.resolvedUrls.local[0];

const browser = await launchBrowser();
const captured = [];

try {
  for (const theme of THEMES) {
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
    const page = await ctx.newPage();
    await page.clock.install({ time: CLOCK });
    await page.addInitScript((t) => localStorage.setItem('grademax-theme', t), theme);
    await page.goto(baseUrl);
    await page.getByRole('button', { name: 'Open the demo' }).click();
    await page.waitForURL('**/dashboard');
    const sidebar = page.locator('nav, aside').first();

    const shot = async (key) => {
      await page.mouse.move(VIEWPORT.width - 1, 1);
      await page.waitForTimeout(2200);
      // The gallery captures leave out the demo-mode pill.
      await page.getByText('Demo mode. Everything here is sample data.')
        .evaluateAll((els) => els.forEach((el) => { el.style.display = 'none'; }));
      const file = path.join(LANDING_DIR, `${key}-${theme}.png`);
      await page.screenshot({ path: file });
      captured.push(file);
      console.log('captured', path.relative(ROOT, file));
    };

    await shot('dashboard');

    // Hypothetical mode with an extra-credit exam worth 20 points.
    await sidebar.getByText('AP US History', { exact: true }).click();
    await page.waitForURL('**/grades/**');
    const classUrl = page.url();
    await page.waitForTimeout(800);
    await page.getByLabel('Hypothetical mode').check();
    await page.getByText('+ New assignment').click();
    await page.getByLabel('Hypothetical assignment name').fill('ch 10 extra credit');
    await page.getByLabel('ch 10 extra credit category').selectOption({ label: 'Exams' });
    await page.getByLabel('ch 10 extra credit date').fill('2026-10-17');
    await page.getByRole('checkbox', { name: 'Extra credit', exact: true }).check();
    const earned = page.getByLabel(/points earned$/).first();
    await earned.fill('20');
    await earned.focus();
    await shot('hypothetical');

    await page.goto(classUrl);
    await page.waitForTimeout(800);
    await page.getByText('Overview', { exact: true }).click();
    await shot('overview');

    for (const [label, key] of [['Documents', 'documents'], ['Mail', 'mail'], ['GPA calculator', 'gpa'], ['Attendance', 'attendance']]) {
      await sidebar.getByText(label, { exact: true }).click();
      if (key === 'gpa') await page.getByRole('button', { name: 'Import current grades' }).click();
      await shot(key);
    }
    await ctx.close();
  }

  await bakeSides(browser, captured);
} finally {
  await browser.close();
  await server.close();
}
