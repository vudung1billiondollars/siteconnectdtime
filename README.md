# D.Time Connect

Official connection hub for https://connect.dtimepieces.com.

## Deploy to Hostinger

- Website type: **Custom PHP/HTML**.
- Repository: `https://github.com/vudung1billiondollars/siteconnectdtime.git`.
- Deployment branch: **main**.
- Deploy into the document root of **connect.dtimepieces.com**, not the main dtimepieces.com website.
- No install command, build command, database or environment variables are required on this branch.
- `index.html`, `media/`, `fonts/`, and `brand/` must be at the website root.
- After uploading, point the `connect` DNS record to the exact target supplied by Hostinger and enable HTTPS.

Hostinger guide: https://www.hostinger.com/support/1583302-how-to-deploy-a-git-repository-in-hostinger/

## Branches

- **main**: deployable static files, ready to serve.
- **source**: editable source, build scripts and matching `dist/` output.

To edit the source branch, use Node.js 20+ and run `npm run build` then `npm run check`. No dependency installation is required. Changes to source do not automatically update main: publish the newly built dist files to main when ready.

## Current release

- Approved mobile Full HD 1080 x 1920 video, 55% dark overlay.
- Silent MP4 with inline playback configured before the source is loaded.
- TikTok and iOS browsers without inline playback use a looping Full HD animated WebP made from the same complete clip. Rejected or stalled native autoplay also falls back to this image, keeping the background inside the page.
- Both renderers share the original 9:16 frame, fitted fully inside the small viewport with black space around it. The frame stays fixed while content scrolls.
- CSS small-viewport sizing replaces the initial JavaScript height snapshot, so a temporary short/tall viewport while a browser opens cannot remain locked in place. The media is no longer enlarged to cover the screen.
- Instagram, Facebook and TikTok links supplied by the owner on 2026-09-30.
- Reduced motion/data-saving fallback and pause/play control.
- Desktop does not automatically request the mobile video.

The animated fallback is approximately 5.9 MB, 27 seconds, at 12 fps; the native video preserves the original Full HD frames. Pause/play controls work with both renderers. Reduced-motion and data-saving preferences start with a still image until the visitor opts into motion. Browser or app policies cannot be overridden to guarantee native video autoplay.

## Validation

Run `npm run check`, `npm run test:browser`, `npm run test:scroll`, and `npm run test:autoplay` against the local server. Browser tests require Playwright (optionally set `PLAYWRIGHT_MODULE` to its `index.mjs`) and installed Chromium/WebKit; `CHROME_PATH` can select Chrome. Autoplay tests simulate TikTok identification, unavailable inline playback, rejected/pending playback, fullscreen recovery, image failure, and accessibility preferences. These checks are not a physical iPhone test inside TikTok.

Font licenses are included in fonts/ (public/fonts/ on the source branch).
