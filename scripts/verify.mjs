import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {links,site} from '../config/links.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const html=await readFile('dist/index.html','utf8');
assert(!/\{\{[A-Z_]+\}\}/.test(html),'Unresolved template variable');
assert(html.includes(`href="${site.origin}/"`),'Canonical');
for(const key of ['website','whatsapp','instagram','facebook','tiktok','privacy']){
  if(links[key]) assert(html.includes(`href="${links[key].replaceAll('&','&amp;').replaceAll('"','&quot;')}"`),`${key} link`);
}
for(const match of html.matchAll(/<a\b[^>]*href="https:[^"]+"[^>]*>/g)){
  assert(match[0].includes('target="_blank"'),'External target');
  assert(match[0].includes('rel="noopener noreferrer"'),'External rel');
}
for(const match of html.matchAll(/(?:href|src|poster)="(\/[^"#]*)"/g)){
  const pathname = new URL(match[1], site.origin).pathname;
  assert((await stat(`dist${pathname}`)).isFile(),`Asset: ${match[1]}`);
}
assert(html.indexOf('data-channel="website"')<html.indexOf('data-channel="whatsapp"'),'CTA hierarchy');
assert(html.indexOf('data-channel="whatsapp"')<html.indexOf('data-channel="instagram"'),'WhatsApp precedes social');
assert(!/http-equiv\s*=\s*"refresh"|navigator\.userAgent|location\.(replace|assign)|fbq\(|ttq\(/i.test(html),'No redirects or trackers');
const css=await readFile('dist/styles.css','utf8');
assert(css.includes('prefers-reduced-motion:reduce'));
assert(css.includes('safe-area-inset-bottom'));
assert((await readFile('dist/robots.txt','utf8')).includes(`${site.origin}/sitemap.xml`));
assert((await readFile('dist/sitemap.xml','utf8')).includes(`<loc>${site.origin}/</loc>`));
assert((await stat('dist/year.js')).size<200,'Tiny optional runtime');
assert((await readFile('dist/video.css','utf8')).includes('--veil:.55'),'Approved 55% video overlay');
assert(html.includes('data-src="/media/background-hd.mp4"'),'Full HD video source');
assert(html.includes('muted loop playsinline preload="none"'),'Mobile video behavior');
console.log('PASS: links, hierarchy, local assets, metadata, sitemap, robots, motion, safe areas, runtime budget.');
