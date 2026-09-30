import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {links} from '../config/links.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.QA_URL||'http://127.0.0.1:4173';
await mkdir('qa',{recursive:true});
const report=[];
const options=process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{};
const browser=await chromium.launch({headless:true,...options});
try{
  for(const [width,height] of [[375,812],[390,844],[430,932],[768,1024],[1440,1000],[812,375]]){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
    const page=await context.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('requestfailed',r=>{if(r.url().endsWith('.mp4')&&r.failure().errorText==='net::ERR_ABORTED')return;errors.push(r.url()+': '+r.failure().errorText);});
    await page.goto(base);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1000);
    if(width<640){
      await page.waitForFunction(()=>{const v=document.querySelector('video');return v.videoWidth===1080&&v.currentTime>.2&&!v.paused;});
      assert.equal(await page.locator('html').evaluate(e=>getComputedStyle(e).getPropertyValue('--veil')),'.55');
      assert.equal(await page.locator('video').evaluate(v=>v.muted&&v.playsInline),true);
      await page.locator('#video-toggle').click();assert.equal(await page.locator('video').evaluate(v=>v.paused),true);
      await page.locator('#video-toggle').click();await page.waitForFunction(()=>!document.querySelector('video').paused);
      await page.locator('#video-toggle').evaluate(e=>e.blur());
    }else{
      assert.equal(await page.locator('video').getAttribute('src'),null,'Desktop does not request background video');
    }
    const layout=await page.evaluate(()=>({
      overflow:document.documentElement.scrollWidth>innerWidth,
      smallTargets:[...document.querySelectorAll('a')].filter(a=>!a.classList.contains('skip-link')&&a.getBoundingClientRect().height<44).map(a=>a.textContent),
      whatsappTop:document.querySelector('[data-channel="whatsapp"]').getBoundingClientRect().top,
      fonts:document.fonts.check('16px Montserrat')&&document.fonts.check('32px Cormorant'),
      runtimeBytes:performance.getEntriesByType('resource').filter(e=>e.initiatorType==='script').reduce((n,e)=>n+e.decodedBodySize,0),
    }));
    assert.equal(layout.overflow,false,`Overflow at ${width}`);assert.deepEqual(layout.smallTargets,[]);assert(layout.fonts);
    if(width<=430)assert(layout.whatsappTop<height,'WhatsApp visible in first viewport');
    assert.deepEqual(errors,[]);
    await page.screenshot({path:`qa/${width}x${height}.png`,fullPage:true});
    await page.locator('.skip-link').focus();assert.equal(await page.locator(':focus').textContent(),'Skip to official links');
    await page.keyboard.press('Enter');await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').getAttribute('data-channel'),'website');
    const focus=await page.locator(':focus').evaluate(el=>getComputedStyle(el).outlineStyle);assert.notEqual(focus,'none');
    report.push({viewport:`${width}x${height}`,status:'pass',...layout});await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.route('https://**/*',route=>route.fulfill({status:200,contentType:'text/plain',body:'Verified link destination'}));
  const page=await context.newPage();await page.goto(base);
  assert.equal(await page.locator('.identity').evaluate(e=>getComputedStyle(e).animationName),'none');
  assert.equal(await page.locator('video').getAttribute('src'),null,'Reduced motion uses poster without loading video');
  assert.equal(await page.locator('video').evaluate(v=>v.paused),true);
  for(const key of ['website','whatsapp','instagram','facebook','tiktok']){
    const popupEvent=context.waitForEvent('page');await page.locator(`[data-channel="${key}"]`).click();
    const popup=await popupEvent;await popup.waitForLoadState();
    assert.equal(popup.url(),links[key]);assert.equal(await popup.evaluate(()=>window.opener),null);await popup.close();
  }
  await page.addStyleTag({content:'html{font-size:200%}'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'200% text overflow');
  await page.screenshot({path:'qa/200-percent-text.png',fullPage:true});await context.close();
  const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:375,height:812}});
  const fallback=await noJS.newPage();await fallback.goto(base);
  assert.equal(await fallback.locator('a[data-channel]').count(),5);
  await fallback.locator('h1').waitFor({state:'visible'});await noJS.close();
  report.push({checks:'Reduced motion, external click destinations, noopener, 200% text, no JavaScript',status:'pass'});
}finally{await browser.close();}
try{
  const safari=await webkit.launch({headless:true});
  const page=await safari.newPage({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:3,hasTouch:true});
  await page.goto(base);await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'qa/webkit-mobile.png',fullPage:true});await safari.close();
  report.push({engine:'WebKit, mobile emulation (not a physical iPhone)',status:'pass'});
}catch(error){report.push({engine:'WebKit',status:'not verified',reason:error.message.split('\n')[0]});}
await writeFile('qa/results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
