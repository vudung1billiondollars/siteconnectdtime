import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { links, site } from '../config/links.mjs';
import { analytics } from '../config/analytics.mjs';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const escape = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
for (const [key,value] of Object.entries(links)) {
  if (value !== null && new URL(value).protocol !== 'https:') throw new Error(`${key}: use a verified HTTPS URL or null`);
}
if (analytics.enabled) throw new Error('No analytics integration is configured.');
const svg = (body, cls='') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const external = svg('<path d="M6 18 18 6M6 6h12v12"/>','arrow');
const icons = {
  website: svg('<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>'),
  whatsapp: svg('<path d="M20.5 11.6a8.5 8.5 0 0 1-12.7 7.7L3 20.7l1.4-4.6a8.5 8.5 0 1 1 16.1-4.5Z"/><path d="M8.1 7.6c.4-.3.8-.2 1 .3l.8 1.7c.2.4-.5 1-.8 1.3.7 1.4 1.7 2.4 3.2 3.1.3-.3.9-1.1 1.3-.9l1.8.8c.5.2.6.6.3 1.1-.5.8-1.1 1.3-2.1 1.1-3.8-.7-6.9-3.9-7.1-6.7 0-.8.8-1.5 1.6-1.8Z"/>'),
  instagram: svg('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/>'),
  facebook: svg('<path d="M14 21v-8h3l.5-4H14V7c0-1 .4-2 2-2h2V2h-3c-3.4 0-5 2-5 5v2H7v4h3v8"/>'),
  tiktok: svg('<path d="M14 3v12.5a4.5 4.5 0 1 1-4-4.5v3a1.5 1.5 0 1 0 1 1.5V3h3c.4 3 2.1 4.7 5 5v3a9 9 0 0 1-5-2"/>'),
};
const attrs = key => `href="${escape(links[key])}" target="_blank" rel="noopener noreferrer"`;
function card(key,title,description,primary=false){
  const enabled=Boolean(links[key]);
  const tag=enabled?'a':'div';
  return `<${tag} ${enabled?attrs(key):'aria-disabled="true"'} class="action-card${primary?' primary':''}${enabled?'':' unavailable'}" data-channel="${key}" ${enabled?`aria-label="${title} (opens in a new tab)"`:''}>
  <div class="card-content"><div class="card-title">${icons[key]}<h2>${title}</h2></div>
  <p class="description">${enabled?description:'Contact link coming soon'}</p></div>${enabled?external:''}</${tag}>`;
}
const socialRows=['instagram','facebook','tiktok'].map(key=>{
  const name={instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok'}[key];
  const enabled=Boolean(links[key]);const tag=enabled?'a':'div';
  return `<li><${tag} ${enabled?attrs(key):'aria-disabled="true"'} class="social-row${enabled?'':' unavailable'}" data-channel="${key}" ${enabled?`aria-label="${name} (opens in a new tab)"`:''}><span class="social-icon">${icons[key]}</span><span class="social-name">${name}</span>${enabled?external:'<span class="availability">Coming soon</span>'}</${tag}></li>`;
}).join('\n');
const tokens={TITLE:escape(site.title),DESCRIPTION:escape(site.description),ORIGIN:escape(site.origin),YEAR:new Date().getFullYear(),
  WEBSITE_CARD:card('website','Official Website','Explore the world of D.Time',true),
  WHATSAPP_CARD:card('whatsapp','WhatsApp','Direct enquiries &amp; support'),
  SOCIAL_ROWS:socialRows,
  FOOTER_LINKS:[['website','Official Website'],['privacy','Privacy']].map(([key,label])=>links[key]?`<a class="footer-link" ${attrs(key)}>${label}</a>`:`<span class="unavailable">${label} — coming soon</span>`).join(''),
};
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
let template=await readFile('src/index.html','utf8');
template=template.replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>{if(!(key in tokens))throw new Error(`Missing token ${key}`);return tokens[key];});
await writeFile('dist/index.html',template);
await cp('src/styles.css','dist/styles.css');
await cp('src/video.css','dist/video.css');
await cp('src/video.js','dist/video.js');
await writeFile('dist/year.js',"const year=document.getElementById('year');if(year)year.textContent=String(new Date().getFullYear());\n");
await writeFile('dist/robots.txt',`User-agent: *\nAllow: /\nSitemap: ${site.origin}/sitemap.xml\n`);
await writeFile('dist/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(site.origin)}/</loc></url></urlset>\n`);
await writeFile('dist/404.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found — D.Time</title><link rel="stylesheet" href="/styles.css"><main class="page hero"><h1>Page not found</h1><p><a href="/">Return to D.Time connections</a></p></main></html>');
console.log('Built standalone static site in dist/. No production dependencies.');
