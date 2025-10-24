/*
 * SPOOKY.JS — Halloween Animation Engine (CDN-fixed)
 * Uses reliable Twemoji SVGs and CSS-only fog (no broken links).
 */

const NUM_GHOSTS = 3;
const NUM_BATS = 4;
const LIGHTNING_INTERVAL = 15000; // ~15s
const AUDIO_URL = "https://cdn.pixabay.com/download/audio/2022/03/15/audio_80b0f17a8d.mp3?filename=spooky-wind-ambient-14395.mp3";

// Twemoji CDN (stable)
const GHOST_SRC = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f47b.svg"; // 👻
const BAT_SRC   = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f987.svg"; // 🦇

function createElement(tag, className, parent, inner) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (inner) el.innerHTML = inner;
  parent.appendChild(el);
  return el;
}

/* Ambient Audio */
const audio = new Audio(AUDIO_URL);
audio.loop = true;
audio.volume = 0.25;
// Autoplay will start after first user interaction (browser policy)
document.addEventListener("click", () => {
  if (audio.paused) audio.play().catch(() => {});
}, { once: true });

const container = document.body;

/* Ghosts */
function spawnGhosts() {
  for (let i = 0; i < NUM_GHOSTS; i++) {
    const ghost = createElement("img", "ghost", container);
    ghost.src = GHOST_SRC;
    ghost.alt = "ghost";
    ghost.style.top = `${Math.random() * 60 + 10}%`;
    ghost.style.left = `${Math.random() * 80 + 10}%`;
    animateGhost(ghost);
  }
}
function animateGhost(ghost) {
  const speed = 10000 + Math.random() * 10000;
  const dir = Math.random() > 0.5 ? 1 : -1;
  ghost.animate([
      { transform: `translateX(0px) scaleX(${dir})`, opacity: 0.7 },
      { transform: `translateX(${dir * 120}px) scaleX(${dir})`, opacity: 1 },
      { transform: `translateX(0px) scaleX(${dir})`, opacity: 0.7 }
    ], { duration: speed, iterations: Infinity, easing: "ease-in-out" });
}

/* Bats */
function spawnBats() {
  for (let i = 0; i < NUM_BATS; i++) {
    const bat = createElement("img", "bat", container);
    bat.src = BAT_SRC;
    bat.alt = "bat";
    bat.style.top = `${Math.random() * 40 + 5}%`;
    bat.style.left = `${Math.random() * 100}%`;
    animateBat(bat);
  }
}
function animateBat(bat) {
  const speed = 7000 + Math.random() * 7000;
  const dir = Math.random() > 0.5 ? 1 : -1;
  const amp = 40 + Math.random() * 30;
  bat.animate([
      { transform: `translate(${dir * 10}px, 0px) scale(${dir},1)` },
      { transform: `translate(${dir * amp}px, ${amp / 3}px) scale(${dir},1)` },
      { transform: `translate(${dir * 10}px, 0px) scale(${dir},1)` }
    ], { duration: speed, iterations: Infinity, easing: "ease-in-out" });
}

/* Fog (CSS-only, no external image) */
function createFog() {
  const fog = createElement("div", "fog-layer", container);
  // Subtle drift animation via Web Animations API
  fog.animate([
    { backgroundPosition: "0% 0%" },
    { backgroundPosition: "100% 0%" }
  ], { duration: 60000, iterations: Infinity, easing: "linear" });
}

/* Lightning */
function triggerLightning() {
  const flash = createElement("div", "lightning", container);
  flash.animate(
    [
      { opacity: 0 },
      { opacity: 0.9 },
      { opacity: 0.2 },
      { opacity: 0.8 },
      { opacity: 0 }
    ],
    { duration: 1000, easing: "ease-out" }
  );
  setTimeout(() => flash.remove(), 1200);
}
setInterval(triggerLightning, LIGHTNING_INTERVAL);

/* Inline styles for spooky layers (replaces broken asset URLs) */
const style = document.createElement("style");
style.textContent = `
.ghost, .bat {
  position: fixed;
  z-index: 50;
  pointer-events: none;
  filter: drop-shadow(0 0 8px rgba(255,145,0,0.6));
  opacity: 0.85;
}
.ghost { width: 60px; height: 60px; }
.bat { width: 50px; height: 30px; opacity: 0.7; }

/* CSS-only fog: layered radial gradients */
.fog-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  opacity: 0.18;
  background:
    radial-gradient(circle at 10% 20%, rgba(255,255,255,0.08), transparent 40%),
    radial-gradient(circle at 80% 30%, rgba(255,255,255,0.06), transparent 40%),
    radial-gradient(circle at 30% 80%, rgba(255,255,255,0.07), transparent 45%);
  background-size: 200% 100%, 180% 100%, 220% 100%;
  background-repeat: no-repeat;
}

/* Lightning overlay */
.lightning {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background: radial-gradient(circle, rgba(255,255,255,0.95) 10%, rgba(255,255,255,0.2) 30%, transparent 70%);
}
`;
document.head.appendChild(style);

/* Launch */
window.addEventListener("DOMContentLoaded", () => {
  createFog();
  spawnGhosts();
  spawnBats();
});
