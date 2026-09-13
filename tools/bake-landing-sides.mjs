// Bakes the landing gallery's side panels ({key}-{theme}-left/right.png) from
// the flat captures in public/landing/: the perspective tilt, the outer-edge
// fade-out, and the rounded border are rendered once into the file, so the
// live page composites three plain images with no runtime 3D or filters.
//
// Usage: node tools/bake-landing-sides.mjs [capture.png ...]
// With no arguments every {key}-{theme}.png in public/landing/ is baked.
// Uses the installed Microsoft Edge; set CAPTURE_BROWSER=chrome to use Chrome.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LANDING_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/landing');

const ANGLE = 59; // degrees the panel turns away from the viewer
const PERSPECTIVE = 907; // px, relative to the 800px-wide slide below

const SLIDE_W = 800;
const SLIDE_H = Math.round((SLIDE_W * 752) / 1140);
const SCALE = 4;
const BOX_W = 244; // 976px at 4x
const BOX_H = 536.75; // 2147px at 4x
const PAD = 2;

// --color-hairline-strong for each theme (src/index.css).
const HAIRLINE = { light: 'rgba(60, 55, 90, 0.15)', dark: 'rgba(255, 255, 255, 0.14)' };

export async function bakeSides(browser, files) {
  const page = await browser.newPage({ viewport: { width: 400, height: 700 }, deviceScaleFactor: SCALE });
  for (const file of files) {
    const theme = file.includes('-dark') ? 'dark' : 'light';
    const src = `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
    for (const side of ['left', 'right']) {
      // The edge facing the center slide stays full height; the outer edge
      // recedes and fades out.
      const near = side === 'left' ? 'right' : 'left';
      const rot = side === 'left' ? -ANGLE : ANGLE;
      const fade = `linear-gradient(to ${side}, #000 0%, #000 42%, rgba(0,0,0,0.35) 72%, transparent 96%)`;
      await page.setContent(`
        <style>html,body{margin:0;background:transparent}</style>
        <div id="box" style="position:relative;width:${BOX_W}px;height:${BOX_H}px;overflow:hidden;
          -webkit-mask-image:${fade};mask-image:${fade};">
          <div style="position:absolute;top:${(BOX_H - SLIDE_H) / 2}px;${near}:${PAD}px;width:${SLIDE_W}px;height:${SLIDE_H}px;
            transform-origin:${near} center;transform:perspective(${PERSPECTIVE}px) rotateY(${rot}deg);">
            <img src="${src}" style="display:block;width:100%;height:100%;box-sizing:border-box;
              border:1px solid ${HAIRLINE[theme]};border-radius:12px;">
          </div>
        </div>`);
      await page.waitForFunction(() => document.images[0]?.complete);
      const out = file.replace(/\.png$/, `-${side}.png`);
      await page.locator('#box').screenshot({ path: out, omitBackground: true });
      console.log('baked', path.relative(process.cwd(), out));
    }
  }
  await page.close();
}

export function launchBrowser() {
  return chromium.launch({ channel: process.env.CAPTURE_BROWSER || 'msedge' });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.length > 2
    ? process.argv.slice(2).map((f) => path.resolve(f))
    : fs.readdirSync(LANDING_DIR)
      .filter((f) => /^[a-z]+-(light|dark)\.png$/.test(f))
      .map((f) => path.join(LANDING_DIR, f));
  const browser = await launchBrowser();
  await bakeSides(browser, files);
  await browser.close();
}
