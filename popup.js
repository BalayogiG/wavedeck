const err = document.getElementById('err');
const FEATURES = ['gesture', 'voice'];

const right = document.getElementById('right');
chrome.storage.local.get({ rightHandOnly: true }).then((v) => (right.checked = v.rightHandOnly));
right.addEventListener('change', () => chrome.storage.local.set({ rightHandOnly: right.checked }));

const wake = document.getElementById('wake');
chrome.storage.local.get({ wakeWord: true }).then((v) => (wake.checked = v.wakeWord));
wake.addEventListener('change', () => chrome.storage.local.set({ wakeWord: wake.checked }));

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab.id;
  const key = 'tab' + tabId;
  let state = (await chrome.storage.session.get(key))[key] || {};

  // The page is the source of truth: ask whether the panels are actually running.
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => (window.__slideControl && window.__slideControl.active()) || { gesture: false, voice: false },
    });
    state = { ...res.result };
    await chrome.storage.session.set({ [key]: state }); // keeps the toolbar badge in sync
  } catch {
    // Page not scriptable (e.g. chrome:// or file access off): fall back to the saved flag.
  }

  for (const feature of FEATURES) {
    const box = document.getElementById(feature);
    box.checked = !!state[feature];

    box.addEventListener('change', async () => {
      err.textContent = '';
      const on = box.checked;
      try {
        if (on) await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
        await chrome.scripting.executeScript({
          target: { tabId },
          func: (feature, on) => window.__slideControl && window.__slideControl(feature, on),
          args: [feature, on],
        });
        state[feature] = on;
        await chrome.storage.session.set({ [key]: state });
      } catch (e) {
        box.checked = !on;
        err.textContent = "Can't run on this page: " + e.message;
      }
    });
  }
})();
