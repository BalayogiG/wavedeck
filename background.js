// Per-tab state lives in storage.session under 'tab<id>' = { gesture, voice }.
// Mirror it onto the toolbar icon so it's obvious when the camera/mic features are active.
function updateBadge(tabId, state) {
  const parts = [];
  if (state?.gesture) parts.push('G');
  if (state?.voice) parts.push('V');
  const title = parts.length
    ? 'Wavedeck active: ' + [state.gesture && 'gesture', state.voice && 'voice'].filter(Boolean).join(' + ')
    : 'Wavedeck';
  // The tab may already be closed (this runs when its saved state is cleared), so ignore "No tab with id".
  const ignore = () => {};
  chrome.action.setBadgeText({ tabId, text: parts.join('+') }).catch(ignore);
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#188038' }).catch(ignore);
  chrome.action.setTitle({ tabId, title }).catch(ignore);
}

chrome.storage.session.onChanged.addListener((changes) => {
  for (const [key, { newValue }] of Object.entries(changes)) {
    if (key.startsWith('tab')) updateBadge(Number(key.slice(3)), newValue);
  }
});

// The injected UI is gone after a navigation/reload, so clear the flag (which clears the badge) when the tab closes too.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === 'loading') chrome.storage.session.remove('tab' + tabId);
});
chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove('tab' + tabId));
