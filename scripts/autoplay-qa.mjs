import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const {chromium, webkit} = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.QA_URL || 'http://127.0.0.1:4173';
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const report = [];
await mkdir('qa', {recursive: true});

async function scenario(browser, engine, name, options, run) {
  const {viewport = {width: 390, height: 700}, userAgent = iphone,
    reducedMotion = 'no-preference', inline = true, play = 'native',
    saveData = false, mediaError = false} = options;
  const context = await browser.newContext({viewport, userAgent,
    isMobile: true, hasTouch: true, reducedMotion});
  const requests = [];
  const errors = [];
  try {
    await context.addInitScript(({inline, play, saveData}) => {
      const nativeMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = query => {
        const result = nativeMatchMedia(query);
        if (query === '(-webkit-video-playable-inline)') {
          Object.defineProperty(result, 'matches', {value: inline});
        }
        return result;
      };
      if (saveData) Object.defineProperty(navigator, 'connection', {value: {saveData: true}, configurable: true});
      window.__mediaQA = {playCalls: 0, fullscreenExits: 0};
      const originalPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (...args) {
        window.__mediaQA.playCalls++;
        if (play === 'reject') return Promise.reject(new DOMException('Autoplay blocked for regression test', 'NotAllowedError'));
        if (play === 'pending') {
          // Suppress the HTML autoplay attribute too: this fixture represents a
          // host that neither starts media nor settles the JavaScript promise.
          this.autoplay = false;
          this.pause();
          return new Promise(() => {});
        }
        return originalPlay.apply(this, args);
      };
    }, {inline, play, saveData});
    if (mediaError) {
      await context.route('**/media/background-motion.webp', route => route.fulfill({
        status: 404, contentType: 'text/plain', body: 'Missing animation for regression test',
      }));
    }
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (/\/media\//.test(request.url())) requests.push(new URL(request.url()).pathname);
    });
    await page.goto(base);
    await run(page, requests);
    assert.deepEqual(errors, [], `${name}: no uncaught page errors`);
    report.push({engine, test: name, status: 'pass'});
  } catch (error) {
    report.push({engine, test: name, status: 'fail', reason: error.message});
    throw error;
  } finally {
    await context.close();
  }
}

async function imageIsPlaying(page) {
  await page.waitForFunction(() => {
    const image = document.getElementById('background-motion');
    return document.querySelector('.video-backdrop').dataset.renderer === 'image' &&
      !image.hidden && image.complete && image.naturalWidth > 0 &&
      image.getAttribute('src') === image.dataset.src &&
      document.getElementById('video-toggle').classList.contains('is-playing');
  });
  assert.equal(await page.locator('#background-video').evaluate(video => video.paused), true,
    'Image rendering never runs native video behind it');
}

async function imagePauseResume(page) {
  const playCalls = await page.evaluate(() => window.__mediaQA.playCalls);
  await page.locator('#video-toggle').click();
  assert.equal(await page.locator('#video-toggle').evaluate(el => el.classList.contains('is-playing')), false);
  assert.equal(await page.locator('#background-motion').isVisible(), false);
  assert.equal(await page.locator('#background-motion').evaluate(image => image.src === document.getElementById('background-video').poster), true,
    'Pausing replaces the animated source with the static poster');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow')));
  assert.equal(await page.locator('#video-toggle').evaluate(el => el.classList.contains('is-playing')), false,
    'User pause survives page restoration');
  await page.locator('#video-toggle').click();
  await imageIsPlaying(page);
  assert.equal(await page.evaluate(() => window.__mediaQA.playCalls), playCalls,
    'Resuming fallback motion must never open native video');
}

async function stableImageBounds(page) {
  const bounds = () => page.locator('#background-motion').evaluate(el => {
    const {x, y, width, height} = el.getBoundingClientRect();
    return {x, y, width, height};
  });
  const original = await bounds();
  const assertWholeImage = async () => {
    const image = await bounds();
    const viewport = page.viewportSize();
    assert(Math.abs(image.width / image.height - 9 / 16) < .001, 'Fallback retains the complete original frame');
    assert(image.width <= viewport.width + 1 && image.height <= viewport.height + 1, 'Image fits wholly inside the viewport');
    assert(Math.abs(image.x + image.width / 2 - viewport.width / 2) < 1, 'Image is centered');
    assert(Math.abs(image.y) < 1, 'Image remains at the top');
    const video = await page.locator('#background-video').evaluate(el => {
      const {x, y, width, height} = el.getBoundingClientRect();
      return {x, y, width, height};
    });
    assert.deepEqual(image, video, 'Native video and fallback have identical framing');
    return image;
  };
  await assertWholeImage();
  await page.evaluate(() => scrollTo(0, 120));
  assert(await page.locator('.page').evaluate(el => el.getBoundingClientRect().top < 0),
    'Content scrolls over the background');
  assert.deepEqual(await bounds(), original, 'Scrolling does not reposition the fallback');
  // This changes the real layout viewport. Safari toolbar-only movement is not
  // reproduced by setViewportSize and requires checking on the actual device.
  for (const height of [120, 780, 2000, 780, 500, 700]) {
    await page.setViewportSize({width: 390, height});
    await page.waitForTimeout(100);
    const refitted = await assertWholeImage();
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    assert.deepEqual(await bounds(), refitted, 'Content scroll preserves the newly fitted frame');
    if (height === 780) assert(refitted.width > 380 && refitted.height > 680, 'Normal height recovers from a transient strip or oversized viewport');
  }
}

async function runSuite(browser, engine) {
  await scenario(browser, engine, 'Native muted inline autoplay and pause/resume', {}, async page => {
    await page.waitForFunction(() => {
      const video = document.getElementById('background-video');
      return !video.paused && video.currentTime > 0.2 && video.videoWidth === 1080;
    });
    assert.equal(await page.locator('.video-backdrop').getAttribute('data-renderer'), 'video');
    assert.equal(await page.locator('#background-video').evaluate(v =>
      v.muted && v.defaultMuted && v.playsInline && !v.controls && v.loop &&
      v.hasAttribute('webkit-playsinline') && v.currentSrc.endsWith('/media/background-inline.mp4')), true);
    await page.locator('#video-toggle').click();
    assert.equal(await page.locator('#background-video').evaluate(v => v.paused), true);
    await page.locator('#video-toggle').click();
    await page.waitForFunction(() => !document.getElementById('background-video').paused);
  });

  await scenario(browser, engine, 'TikTok user agent uses animated image with zero video play calls',
    {userAgent: `${iphone} musical_ly_202600 TikTok`, inline: false, play: 'reject'}, async (page, requests) => {
      await imageIsPlaying(page);
      assert.equal(await page.evaluate(() => window.__mediaQA.playCalls), 0);
      assert.equal(requests.some(path => path.endsWith('.mp4')), false);
      assert.equal(await page.locator('#background-motion').evaluate(image => image.naturalWidth), 1080);
      const firstFrame = await page.locator('.video-backdrop').screenshot();
      await page.waitForTimeout(1400);
      const nextFrame = await page.locator('.video-backdrop').screenshot();
      assert.equal(firstFrame.equals(nextFrame), false, 'The animated image visibly advances');
      await imagePauseResume(page);
      await stableImageBounds(page);
      assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--veil').trim()), '.55');
      await page.screenshot({path: `qa/autoplay-${engine.toLowerCase()}-tiktok-fallback.png`});
    });

  await scenario(browser, engine, 'iOS inline capability unavailable uses image without native playback',
    {inline: false, play: 'reject'}, async page => {
      await imageIsPlaying(page);
      assert.equal(await page.evaluate(() => window.__mediaQA.playCalls), 0);
    });

  await scenario(browser, engine, 'Rejected autoplay automatically switches to image and stays inline',
    {play: 'reject'}, async page => {
      await imageIsPlaying(page);
      assert(await page.evaluate(() => window.__mediaQA.playCalls > 0));
      await imagePauseResume(page);
    });

  await scenario(browser, engine, 'Pending autoplay switches to image after a bounded wait',
    {play: 'pending'}, async page => { await imageIsPlaying(page); });

  await scenario(browser, engine, 'Unexpected native fullscreen exits and keeps future playback in image',
    {}, async page => {
      await page.waitForFunction(() => !document.getElementById('background-video').paused);
      await page.locator('#background-video').evaluate(video => {
        Object.defineProperty(video, 'webkitExitFullscreen', {value: () => { window.__mediaQA.fullscreenExits++; }, configurable: true});
        video.dispatchEvent(new Event('webkitbeginfullscreen'));
      });
      await imageIsPlaying(page);
      assert.equal(await page.evaluate(() => window.__mediaQA.fullscreenExits), 1);
      await imagePauseResume(page);
    });

  for (const [name, options] of [
    ['Reduced motion', {reducedMotion: 'reduce'}],
    ['Save data', {saveData: true}],
  ]) {
    await scenario(browser, engine, `${name} uses poster until explicit play`,
      {...options, userAgent: `${iphone} TikTok`, inline: false, play: 'reject'}, async (page, requests) => {
        assert.equal(await page.locator('#background-video').getAttribute('src'), null);
        assert.equal(await page.locator('#background-motion').getAttribute('src'), null);
        assert.equal(requests.some(path => /\.(mp4|webp)$/.test(path)), false);
        assert.equal(await page.locator('#video-toggle').evaluate(el => el.classList.contains('is-playing')), false);
        await page.locator('#video-toggle').click();
        await imageIsPlaying(page);
        assert.equal(await page.evaluate(() => window.__mediaQA.playCalls), 0);
      });
  }

  await scenario(browser, engine, 'Desktop does not load animation',
    {viewport: {width: 1440, height: 1000}}, async (page, requests) => {
      assert.equal(await page.locator('#background-video').getAttribute('src'), null);
      assert.equal(await page.locator('#background-motion').getAttribute('src'), null);
      assert.equal(requests.some(path => /\.(mp4|webp)$/.test(path)), false);
      assert.equal(await page.evaluate(() => window.__mediaQA.playCalls), 0);
      assert.equal(await page.locator('#video-toggle').isVisible(), false);
    });

  await scenario(browser, engine, 'Missing animation leaves a usable static page',
    {userAgent: `${iphone} TikTok`, inline: false, play: 'reject', mediaError: true}, async page => {
      await page.waitForFunction(() => document.getElementById('video-toggle').hidden &&
        document.getElementById('background-motion').src === document.getElementById('background-video').poster);
      assert.equal(await page.locator('#background-motion').isVisible(), false);
      assert.equal(await page.locator('#background-video').evaluate(video => video.paused), true);
      assert.equal(await page.locator('a[data-channel]').count(), 5);
      assert.equal(await page.locator('h1').isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    });
}

let failure;
try {
  const browser = await chromium.launch({headless: true,
    ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  try { await runSuite(browser, 'Chromium'); } finally { await browser.close(); }
  if (process.env.QA_SKIP_WEBKIT === '1') {
    report.push({engine: 'WebKit', status: 'not verified',
      reason: process.env.QA_WEBKIT_REASON || 'Skipped by QA_SKIP_WEBKIT; this is not a physical iPhone/TikTok test.'});
  } else {
    let safari;
    try { safari = await webkit.launch({headless: true, timeout: 20000}); }
    catch (error) {
      report.push({engine: 'WebKit', status: 'not available', reason: error.message.split('\n')[0]});
    }
    if (safari) {
      try { await runSuite(safari, 'WebKit'); } finally { await safari.close(); }
    }
  }
} catch (error) { failure = error; }
await writeFile('qa/autoplay-results.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (failure) throw failure;
