const msg = document.getElementById('msg');

const WAKE = /\b(jarvis|jervis|jarvus|javis|garvis|charvis|travis)\b/gi; // common mis-hearings of "Jarvis"
const NEXT = /\b(next|forward)\b/i;
const PREV = /\b(previous|back|backward)\b/i;
const FIRST = /\b(first|start|beginning)\b/i;
const LAST = /\b(last|end|final)\b/i;
const GOTO = /\b(?:slide|number|go to(?: slide)?)\s+(\d+|[a-z-]+)\b/i;
const COOLDOWN_MS = 700;

const WORDS = {
  one: 1, two: 2, to: 2, too: 2, three: 3, four: 4, for: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20,
};
const toNumber = (s) => (/^\d+$/.test(s) ? Number(s) : WORDS[s.toLowerCase()]);

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let wakeWord = true; // require "Jarvis" before a command
let lastFire = 0;
let handled = new Set(); // result indices already acted on in this recognition session
let stopped = false;

chrome.storage.local.get({ wakeWord: true }).then((v) => { wakeWord = v.wakeWord; hint(); });
chrome.storage.onChanged.addListener((c) => { if (c.wakeWord) { wakeWord = c.wakeWord.newValue; hint(); } });

const hint = () => { msg.textContent = wakeWord ? '🎤 say "Jarvis, next"' : '🎤 say "next" / "previous"'; };

// Returns a message to send, or null. Number jumps are only taken from final results so
// "slide twenty" is not cut off as "slide two".
function parse(text, isFinal) {
  let rest = text;
  if (wakeWord) {
    const matches = [...text.matchAll(WAKE)];
    if (!matches.length) return null;
    const last = matches.at(-1);
    rest = text.slice(last.index + last[0].length);
  }
  const g = rest.match(GOTO);
  if (g) {
    const n = toNumber(g[1]);
    return n && isFinal ? { type: 'goto', slide: n } : null;
  }
  if (FIRST.test(rest)) return isFinal ? { type: 'goto', slide: 'first' } : null;
  if (LAST.test(rest)) return isFinal ? { type: 'goto', slide: 'last' } : null;
  const n = rest.search(NEXT);
  const p = rest.search(PREV);
  if (n < 0 && p < 0) return null;
  return { type: 'swipe', dir: p > n ? 'prev' : 'next' };
}

function start() {
  const rec = new Recognition();
  rec.continuous = true;
  rec.interimResults = true; // next/previous act on partial results so it feels instant
  rec.lang = 'en-US';

  rec.onstart = () => { handled = new Set(); hint(); };

  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (handled.has(i)) continue;
      const text = e.results[i][0].transcript;
      const out = parse(text, e.results[i].isFinal);
      if (!out) continue;
      handled.add(i);
      const now = performance.now();
      if (now - lastFire < COOLDOWN_MS) continue;
      lastFire = now;
      msg.textContent = '🎤 "' + text.trim() + '"';
      parent.postMessage(out, '*');
    }
  };

  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      stopped = true;
      msg.textContent = 'Microphone blocked - allow it for this site';
    } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
      msg.textContent = 'Voice error: ' + e.error;
    }
  };

  // Chrome ends sessions after silence; keep listening until the toggle is turned off.
  rec.onend = () => { if (!stopped) setTimeout(start, 200); };
  rec.start();
}

if (!Recognition) {
  msg.textContent = 'Speech recognition not supported';
} else {
  start();
}
