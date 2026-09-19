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

// 2. Cookie reader message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PLATZI_COOKIES') {
    chrome.cookies.getAll({ domain: 'platzi.com' }, (cookies) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }

      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      const sessionCookie = cookies.find(c => c.name === 'sessionid');
      const csrfCookie = cookies.find(c => c.name === 'csrftoken');

      sendResponse({
        cookieHeader,
        hasSession: Boolean(sessionCookie),
        sessionId: sessionCookie ? sessionCookie.value : null,
        csrfToken: csrfCookie ? csrfCookie.value : null,
      });
    });
    return true; // Keep channel open for async response
  }
});
