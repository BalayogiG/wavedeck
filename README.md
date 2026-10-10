# Wavedeck

A Chrome extension (Manifest V3) that changes slides with **hand gestures** or **voice commands**.
Built and tested with [Marp](https://marp.app/) HTML decks exported from VS Code; other HTML decks that
respond to the arrow keys should work for next/previous too.

Each feature is a separate toggle and applies **only to the tab you turn it on in**. The popup also has two
options: **Right hand only** (gestures) and **Require wake word "Jarvis"** (voice), both on by default.

## Install

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Pin the extension (puzzle-piece menu) so its badge stays visible.
4. If you open the deck from disk (`file:///…`), open the extension's **Details** and turn on
   **Allow access to file URLs**. Without it the toggle fails with "Can't run on this page".

Keep the folder where it is; Chrome loads the extension from it. After changing any file, click the reload
icon on `chrome://extensions` **and reload the presentation tab**.

## Use

1. Open your presentation, click the page once so it has focus, then click the extension icon.
2. Turn on **Gesture control** and/or **Voice control**. Allow the camera / microphone when Chrome asks.
3. Present. Fullscreen works (Marp: press `F`).

The toolbar icon shows a green badge on the active tab: **G** (gesture), **V** (voice), **G+V** (both).

### Gesture control

| Do this | Result |
| --- | --- |
| Hold your **right hand** in the **right third** of the camera view for ~0.3 s | Next slide |
| Hold your **right hand** in the **left third** | Previous slide |

- Left and right are from your point of view, like a mirror.
- **Right hand only** (popup checkbox, on by default): the tracker reads up to two hands and acts only on your
  right one, so your left hand is ignored and never blocks the right. Untick it to allow either hand. The
  hand is identified with MediaPipe's handedness label; if a different camera reports it the other way, set
  `RIGHT_HAND_LABEL` to `'Left'` at the top of `tracker.js` (default `'Right'`, verified on a real camera).
- It fires once per entry. Move your hand back to the middle (or out of view) before the next change.
- A small panel appears at the bottom-right with the zone lines, a dot that follows your hand
  (blue idle, yellow holding, green fired) and a flashing arrow. It fades out about a second after your hand
  leaves the view. The camera feed itself is never displayed.

### Voice control

With the wake word on (default), commands must start with "Jarvis":

| Say | Result |
| --- | --- |
| "Jarvis, next" / "forward" | Next slide |
| "Jarvis, previous" / "back" / "go back" | Previous slide |
| "Jarvis, go to slide five" / "slide 12" | Jump to that slide (numbers up to twenty as words, any digits) |
| "Jarvis, first slide" / "last slide" | Jump to the start / end |

Untick **Require wake word "Jarvis"** in the popup to use plain "next" / "previous" instead. Numbered jumps
and first/last wait for you to finish the phrase, so expect a short delay; next/previous react immediately.
Common mishearings of "Jarvis" (e.g. "Travis") are accepted. Numbered jumps need Marp's `#N` slide hashes;
on other decks only first/last (Home/End keys) work.

## How it works

```
popup ──inject──▶ content.js ──creates──▶ tracker.html (camera + MediaPipe)  ┐ postMessage
                       ▲                  voice.html   (Web Speech API)      ┘ {swipe|goto|visible}
                       └── sends ArrowLeft/ArrowRight to the page (and sets #N as a Marp fallback)
```

- `manifest.json`: permissions `activeTab`, `scripting`, `storage` only. No broad host access; the page is
  touched only after you open the popup on it. The CSP allows `wasm-unsafe-eval` (needed by MediaPipe).
- `popup.html/js`: the toggles and the two options (stored in `chrome.storage.local`). The toggles ask the page
  which features are really running, so the state is always right.
- `background.js`: mirrors per-tab state onto the toolbar badge and clears it on reload/close (badge updates for
  tabs that were just closed are ignored, which avoids a harmless "No tab with id" error).
- `content.js`: injected into the tab. Hosts the feature iframes inside `<body>` (so they appear in fullscreen),
  validates messages by sending window, and navigates. Navigation tries arrow-key events first, then, for
  Marp, falls back to the active-slide check plus `location.hash = '#N'` if the key events had no effect.
- `tracker.html/js`: runs in an extension-origin iframe so you grant camera access once for the extension
  rather than once per website. Uses MediaPipe Hand Landmarker (bundled in `lib/`, about 22 MB), picks the right
  hand, and watches its middle-finger knuckle's horizontal position.
- `voice.html/js`: Chrome's built-in speech recognition with interim results and automatic restart.

## Tuning

Constants at the top of `tracker.js`: `ZONE` (width of each side zone), `HOLD_MS` (hold time),
`COOLDOWN_MS` (minimum gap between changes). In `voice.js`: the wake-word list and command regexes.

## Privacy

- Camera frames are processed locally and never leave your machine.
- Voice uses Chrome's speech recognition, which **sends audio to Google** and needs an internet connection.
  Leave Voice off if that is a problem; gestures work offline.

## Presenting tips

- Rehearse once on the same laptop, camera and room; grant camera/mic permissions before the audience arrives.
- Light your hand from the front, not from a bright window behind you. Sit or stand 2 to 3 feet from the camera.
- Close other apps using the camera (Zoom, Meet).
- Rest your right hand out of view when you are not changing slides (your left hand is ignored by default).
- Don't reload the tab mid-presentation; it turns the features off. Keep a keyboard or clicker as a backup.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Can't run on this page" | Enable **Allow access to file URLs**, or the page is a `chrome://` page (not supported). |
| `OpenGL error checking is disabled`, `NORM_RECT without IMAGE_DIMENSIONS` in the panel console | Normal MediaPipe warnings; ignore them. |
| Left hand works instead of the right (or vice versa) | Swap `RIGHT_HAND_LABEL` in `tracker.js`, or untick **Right hand only**. |
| `Error (model): …` in the panel | Reload the extension and tab; check the console of the panel (right-click, Inspect). |
| Camera / mic blocked | Allow it from the site-settings icon in the address bar. |
| Nothing happens on a gesture | Click the slide so it has focus; confirm the dot moves and turns green. |
| Panel missing in fullscreen | Reload the tab and re-enable; the panels must be inside the fullscreen element. |
| Features off after reloading the extension | Reload the presentation tab and turn them on again. |

## Files

```
manifest.json  background.js  content.js  popup.html  popup.js
tracker.html   tracker.js     voice.html  voice.js
lib/           MediaPipe tasks-vision bundle, wasm files and hand_landmarker.task
```

## Third-party

`lib/` bundles [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) (Apache-2.0) and Google's
`hand_landmarker.task` model, both unmodified.
