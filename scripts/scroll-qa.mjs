import assert from 'node:assert/strict';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {mkdir, writeFile} from 'node:fs/promises';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
const results = [];
const base = process.env.QA_URL || 'http://127.0.0.1:4173';
await mkdir('qa', {recursive:true});
const bounds = page => page.locator('#background-video').evaluate(el => {
  const {x,y,width,height} = el.getBoundingClientRect();
  return {x,y,width,height};
});
async function assertWholeFrame(page) {
  const frame = await bounds(page);
  const viewport = page.viewportSize();
  assert(frame.width > 0 && frame.height > 0, 'Background has a visible frame');
  assert(Math.abs(frame.width / frame.height - 9/16) < .001, 'The whole portrait frame retains its original aspect ratio');
  assert(frame.width <= viewport.width + 1, 'The video never extends beyond the viewport width');
  assert(frame.height <= viewport.height + 1, 'The complete video fits vertically');
  assert(Math.abs(frame.x + frame.width / 2 - viewport.width / 2) < 1, 'The frame is horizontally centered');
  assert(Math.abs(frame.y) < 1, 'The frame stays anchored at the top');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  return frame;
}
async function assertIndependentScroll(page) {
  const original = await assertWholeFrame(page);
  await page.evaluate(() => scrollTo(0, 120));
  assert(await page.locator('.page').evaluate(el => el.getBoundingClientRect().top < 0), 'Content scrolls independently');
  assert.deepEqual(await bounds(page), original, 'Scrolling leaves the entire background frame fixed');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  assert.deepEqual(await bounds(page), original, 'Background remains fixed at the end of the page');
}
try {
  for (const width of [375,390,430]) {
    const context = await browser.newContext({viewport:{width,height:700},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const page = await context.newPage();
    await page.goto(base);
    const original = await assertWholeFrame(page);
    await assertIndependentScroll(page);
    // setViewportSize changes the layout viewport (including svh). It does not
    // emulate Safari toolbar-only changes, whose small viewport stays stable.
    for (const height of [820,500,700]) {
      await page.setViewportSize({width,height});
      await page.waitForTimeout(100);
      await assertIndependentScroll(page);
      if (height === 500) assert((await bounds(page)).height < original.height, 'A real smaller viewport refits the whole frame');
    }
    await page.screenshot({path:`qa/fixed-video-${width}.png`});
    await page.setViewportSize({width:600,height:390});
    await page.waitForTimeout(100);
    const rotated = await assertWholeFrame(page);
    assert(rotated.width < 600, 'A short landscape viewport leaves side margins rather than cropping');
    assert.equal(rotated.height,390,'A shorter viewport contains the complete portrait frame');
    await page.setViewportSize({width:844,height:390});
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.video-backdrop').isVisible(),false);
    await page.setViewportSize({width,height:700});
    await page.waitForTimeout(100);
    assert.deepEqual(await assertWholeFrame(page),original,'Returning from desktop restores the fitted mobile frame');
    assert.equal(await page.locator('video').getAttribute('src'),null,'Reduced motion remains respected');
    results.push({width,status:'pass',checks:'fixed frame during content scroll, original aspect ratio, real viewport refit, landscape fit, desktop return, reduced motion'});
    await context.close();
  }
  for (const initialHeight of [120,2000]) {
    const context = await browser.newContext({viewport:{width:390,height:initialHeight},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const page = await context.newPage();
    await page.goto(base);
    const initial = await assertWholeFrame(page);
    await page.setViewportSize({width:390,height:780});
    await page.waitForTimeout(100);
    const settled = await assertWholeFrame(page);
    assert(settled.width > 380 && settled.height > 680, 'The settled viewport shows a useful full-width portrait frame');
    if (initialHeight === 120) assert(settled.height > initial.height * 4, 'A transient short viewport is not frozen into a permanent video strip');
    await assertIndependentScroll(page);
    await page.screenshot({path:`qa/recovered-video-${initialHeight}.png`});
    results.push({initialViewport:`390x${initialHeight}`,settledViewport:'390x780',status:'pass',checks:'same-width viewport recovery, no cropped zoom, whole frame and content scroll'});
    await context.close();
  }
} finally { await browser.close(); }
await writeFile('qa/scroll-results.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
