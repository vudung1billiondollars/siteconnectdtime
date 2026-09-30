const video = document.getElementById('background-video');
const motion = document.getElementById('background-motion');
const toggle = document.getElementById('video-toggle');
const backdrop = document.querySelector('.video-backdrop');
const mobile = matchMedia('(max-width: 639px)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const inlinePlayback = matchMedia('(-webkit-video-playable-inline)');
const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const embeddedTikTok = /TikTok|musical_ly|BytedanceWebview|aweme|trill/i.test(navigator.userAgent);
let renderer = embeddedTikTok || (ios && !inlinePlayback.matches) ? 'image' : 'video';
let userPaused = false;
let userStarted = false;
let failed = false;
let imagePlaying = false;
let imageLoading = false;
let nativePending = false;
let playAttempt = 0;
let playbackTimer;
backdrop.dataset.renderer = renderer;

// Configure the media element before giving WebKit a source.
video.defaultMuted = true;
video.muted = true;
video.playsInline = true;
video.controls = false;
video.setAttribute('webkit-playsinline', '');
video.disablePictureInPicture = true;
video.disableRemotePlayback = true;

function wantsMotion() {
  return mobile.matches && !document.hidden && !userPaused && !failed &&
    (userStarted || (!reduced.matches && !navigator.connection?.saveData));
}

function sync() {
  const playing = wantsMotion() && (renderer === 'image' ? imagePlaying : !video.paused);
  toggle.hidden = !mobile.matches || failed;
  toggle.classList.toggle('is-playing', playing);
  toggle.setAttribute('aria-label', playing ? 'Pause background animation' : 'Play background animation');
  toggle.title = toggle.getAttribute('aria-label');
}

function stopImage() {
  imagePlaying = false;
  imageLoading = false;
  motion.hidden = true;
  // Merely hiding an animated image does not stop its decoding/playback.
  if (motion.getAttribute('src') && motion.getAttribute('src') !== video.poster) motion.src = video.poster;
}

function startImage() {
  if (imagePlaying || imageLoading) return;
  imageLoading = true;
  motion.src = motion.dataset.src;
}

function useImage() {
  renderer = 'image';
  backdrop.dataset.renderer = renderer;
  playAttempt++;
  nativePending = false;
  clearTimeout(playbackTimer);
  video.autoplay = false;
  video.pause();
  if (video.getAttribute('src')) {
    video.removeAttribute('src');
    video.load();
  }
  update();
}

function startVideo() {
  if (nativePending || !video.paused) return;
  const attempt = ++playAttempt;
  nativePending = true;
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  if (!video.getAttribute('src')) video.src = video.dataset.src;
  // Some embedded browsers leave play() pending instead of rejecting it.
  playbackTimer = setTimeout(() => {
    if (attempt === playAttempt && wantsMotion() && renderer === 'video' && (video.paused || video.readyState < 2)) useImage();
  }, 6000);
  video.play().then(() => {
    if (attempt !== playAttempt) return;
    nativePending = false;
    clearTimeout(playbackTimer);
    if (!wantsMotion() || renderer !== 'video') video.pause();
    sync();
  }).catch(() => {
    if (attempt !== playAttempt) return;
    nativePending = false;
    clearTimeout(playbackTimer);
    if (wantsMotion()) useImage();
  });
}

function update() {
  if (!wantsMotion()) {
    playAttempt++;
    nativePending = false;
    clearTimeout(playbackTimer);
    video.pause();
    stopImage();
  } else if (renderer === 'image') {
    video.pause();
    startImage();
  } else {
    startVideo();
  }
  sync();
}

motion.addEventListener('load', () => {
  if (motion.getAttribute('src') !== motion.dataset.src) return;
  imageLoading = false;
  if (!wantsMotion()) return stopImage();
  imagePlaying = true;
  motion.hidden = false;
  sync();
});
motion.addEventListener('error', () => {
  if (motion.getAttribute('src') !== motion.dataset.src) return;
  failed = true;
  stopImage();
  sync();
});
video.addEventListener('play', () => {
  if (renderer === 'image' || !wantsMotion()) video.pause();
  sync();
});
video.addEventListener('pause', sync);
video.addEventListener('error', () => { if (renderer === 'video') useImage(); });
video.addEventListener('webkitbeginfullscreen', () => {
  // Recovery for an embedded browser that ignores its inline capability signal.
  try { video.webkitExitFullscreen?.(); } catch { /* The host may already be closing it. */ }
  useImage();
});
toggle.addEventListener('click', () => {
  userPaused = wantsMotion();
  if (!userPaused) userStarted = true;
  update();
});
window.addEventListener('pageshow', update);
mobile.addEventListener('change', update);
reduced.addEventListener('change', () => { userStarted = false; update(); });
document.addEventListener('visibilitychange', update);
update();
