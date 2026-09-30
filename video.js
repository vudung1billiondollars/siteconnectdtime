const video = document.getElementById('background-video');
const toggle = document.getElementById('video-toggle');
const backdrop = document.querySelector('.video-backdrop');
const mobile = matchMedia('(max-width: 639px)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let userPaused = false;
let failed = false;
let backdropWidth = 0;

function sizeBackdrop() {
  const width = document.documentElement.clientWidth;
  if (!mobile.matches) {
    backdrop.style.removeProperty('height');
    backdropWidth = 0;
    return;
  }
  // Height-only resizes come from browser chrome or the keyboard. Keep the
  // same crop while scrolling; remeasure only on entry or a real width change.
  if (width === backdropWidth) return;
  backdropWidth = width;
  backdrop.style.removeProperty('height');
  backdrop.style.height = `${backdrop.getBoundingClientRect().height}px`;
}

sizeBackdrop();
window.addEventListener('resize', sizeBackdrop);
mobile.addEventListener('change', sizeBackdrop);

function sync() {
  const playing = !video.paused;
  toggle.hidden = !mobile.matches || failed;
  toggle.classList.toggle('is-playing', playing);
  toggle.setAttribute('aria-label', playing ? 'Pause background video' : 'Play background video');
  toggle.title = toggle.getAttribute('aria-label');
}

async function play() {
  if (!mobile.matches || document.hidden || failed) return;
  if (!video.getAttribute('src')) video.src = video.dataset.src;
  video.muted = true;
  try { await video.play(); } catch { /* Keep the poster and allow a user-initiated retry. */ }
  sync();
}

function update() {
  if (!mobile.matches || reduced.matches || document.hidden || userPaused || navigator.connection?.saveData) {
    video.pause();
  } else {
    play();
  }
  sync();
}

video.addEventListener('play', sync);
video.addEventListener('pause', sync);
video.addEventListener('error', () => { failed = true; sync(); });
toggle.addEventListener('click', () => {
  userPaused = !video.paused;
  if (userPaused) video.pause(); else play();
});
mobile.addEventListener('change', update);
reduced.addEventListener('change', update);
document.addEventListener('visibilitychange', update);
update();
