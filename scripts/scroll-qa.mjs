import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdir, writeFile} from 'node:fs/promises';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
const results = [];
const base = process.env.QA_URL || 'http://127.0.0.1:4173';
await mkdir('qa', {recursive:true});
try {
  for (const width of [375,390,430]) {
    const context = await browser.newContext({viewport:{width,height:700},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
    const page = await context.newPage();
    await page.goto(base);
    const bounds = () => page.locator('.video-backdrop video').evaluate(el => {
      const {x,y,width,height} = el.getBoundingClientRect();
      return {x,y,width,height};
    });
    const original = await bounds();
    await page.evaluate(() => scrollTo(0,120));
    const contentTop = await page.locator('.page').evaluate(el=>el.getBoundingClientRect().top);
    assert(contentTop < 0, 'Content must scroll independently');
    assert.deepEqual(await bounds(),original,'Video stays fixed during scroll');
    // A height-only resize models toolbar/keyboard changes without rotating.
    for (const height of [820,630,700]) {
      await page.setViewportSize({width,height});
      await page.waitForTimeout(100);
      await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
      assert.deepEqual(await bounds(),original,'Toolbar resize must not change video crop');
    }
    await page.screenshot({path:`qa/fixed-video-${width}.png`});
    await page.setViewportSize({width:600,height:390});
    await page.waitForTimeout(100);
    const rotated = await bounds();
    assert.equal(rotated.width,600);
    assert.equal(rotated.height,390,'A width change refreshes the video frame');
    await page.setViewportSize({width:844,height:390});
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.video-backdrop').isVisible(),false);
    await page.setViewportSize({width,height:700});
    await page.waitForTimeout(100);
    assert.deepEqual(await bounds(),original,'Returning from desktop restores mobile frame');
    assert.equal(await page.locator('video').getAttribute('src'),null,'Reduced motion remains respected');
    results.push({width,status:'pass',checks:'scroll, toolbar height changes, width/orientation changes, desktop return, reduced motion'});
    await context.close();
  }
} finally { await browser.close(); }
await writeFile('qa/scroll-results.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results,null,2));
