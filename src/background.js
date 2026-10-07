/* global chrome */
// Background service worker for MV3 extension

// 1. Open extractor in a full-size tab when toolbar icon is clicked
chrome.action.onClicked.addListener(async () => {
  const extensionUrl = chrome.runtime.getURL('index.html');
  const tabs = await chrome.tabs.query({ url: `${extensionUrl}*` });

  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: extensionUrl });
  }
});
