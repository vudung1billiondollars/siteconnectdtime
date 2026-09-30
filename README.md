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
- Stable video framing while scrolling or browser toolbars change height.
- Instagram, Facebook and TikTok links supplied by the owner on 2026-09-30.
- Reduced motion/data-saving fallback and pause/play control.
- Desktop does not automatically request the mobile video.

Font licenses are included in fonts/ (public/fonts/ on the source branch).
