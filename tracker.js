import { FilesetResolver, HandLandmarker } from './lib/vision_bundle.mjs';

const video = document.getElementById('v');
const msg = document.getElementById('msg');
const flash = document.getElementById('flash');
const dot = document.getElementById('dot');

const HOLD_MS = 300;       // hold the hand in a side zone this long before it fires
const ZONE = 0.33;        // outer third of the frame on each side
const COOLDOWN_MS = 900;   // minimum gap between slide changes

// MediaPipe's handedness label for the user's right hand. Verified on a real camera: 'Right' selects
// the user's right hand. Change to 'Left' if a different camera/driver reports it the other way.
const RIGHT_HAND_LABEL = 'Right';
let rightHandOnly = true;
chrome.storage.local.get({ rightHandOnly: true }).then((v) => { rightHandOnly = v.rightHandOnly; });
chrome.storage.onChanged.addListener((c) => { if (c.rightHandOnly) rightHandOnly = c.rightHandOnly.newValue; });

let holdDir = null;
let holdSince = 0;
let armed = true;          // must return to the middle (or leave view) before firing again
let lastFire = 0;

// Ask the page to show/hide the panel; it fades in with a hand and out ~1s after the hand leaves.
let shown = null;
let hideTimer = null;
function setVisible(v) {
  if (v) { clearTimeout(hideTimer); hideTimer = null; }
  if (v === shown) return;
  if (!v) {
    if (hideTimer) return;
    hideTimer = setTimeout(() => { hideTimer = null; shown = false; parent.postMessage({ type: 'visible', value: false }, '*'); }, 1000);
    return;
  }
  shown = true;
  parent.postMessage({ type: 'visible', value: true }, '*');
}

// Where is the hand? The camera image is unmirrored, so the user's right is small x.
function zoneOf(lm) {
  const x = lm[9].x;
  if (x < ZONE) return 'next';
  if (x > 1 - ZONE) return 'prev';
  return null;
}

function onHand(lm, now) {
  // The dot mirrors the hand like the user's own reflection: user's right appears on the right.
  dot.style.opacity = lm ? 1 : 0;
  setVisible(!!lm);
  if (lm) dot.style.left = (1 - lm[9].x) * 100 + '%';
  const dir = lm ? zoneOf(lm) : null;
  if (!dir) {
    dot.style.background = '#8ab4f8';
    holdDir = null;
    armed = true;
    return;
  }
  if (dir !== holdDir) { holdDir = dir; holdSince = now; }
  const held = now - holdSince;
  dot.style.background = held >= HOLD_MS ? '#81c995' : '#fdd663'; // yellow while holding
  if (!armed || held < HOLD_MS || now - lastFire < COOLDOWN_MS) return;

  armed = false;
  lastFire = now;
  flash.textContent = dir === 'next' ? '→' : '←';
  flash.style.opacity = 1;
  setTimeout(() => (flash.style.opacity = 0), 350);
  parent.postMessage({ type: 'swipe', dir }, '*');
}

async function main() {
  let stage = 'camera';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    video.srcObject = stream;
    await video.play();
    stage = 'model';
    msg.textContent = 'Loading…';

    const fileset = await FilesetResolver.forVisionTasks('./lib');
    const make = (delegate) => HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: './lib/hand_landmarker.task', delegate },
      runningMode: 'VIDEO',
      numHands: 2,
    });
    let landmarker;
    try {
      landmarker = await make('GPU');
    } catch (gpuErr) {
      console.warn('GPU delegate failed, using CPU', gpuErr);
      landmarker = await make('CPU');
    }
    msg.textContent = '';

    let lastVideoTime = -1;
    const loop = () => {
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const res = landmarker.detectForVideo(video, performance.now());
        // Pick the user's right hand (or the first hand if the restriction is off).
        let lm = res.landmarks[0];
        if (rightHandOnly) {
          const i = res.handedness.findIndex((h) => h[0]?.categoryName === RIGHT_HAND_LABEL);
          lm = i >= 0 ? res.landmarks[i] : undefined;
        }
        onHand(lm, performance.now());
      }
      requestAnimationFrame(loop);
    };
    loop();
  } catch (e) {
    console.error('[slide-gesture]', e);
    msg.textContent = 'Error (' + stage + '): ' +
      (e?.message || e?.name || (e?.target?.src ? 'failed to load ' + e.target.src : String(e)));
  }
}
main();
