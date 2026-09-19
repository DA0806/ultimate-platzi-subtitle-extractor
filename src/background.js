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
    (async () => {
      const queries = [
        { url: 'https://platzi.com' },
        { url: 'https://platzi.com/' },
        { domain: '.platzi.com' },
        { domain: 'platzi.com' },
      ];

      const cookieMap = new Map();

      for (const query of queries) {
        try {
          const results = await new Promise((resolve) => {
            chrome.cookies.getAll(query, (cookies) => {
              if (chrome.runtime?.lastError || !cookies) {
                resolve([]);
              } else {
                resolve(cookies);
              }
            });
          });

          for (const cookie of results) {
            if (cookie && cookie.name && !cookieMap.has(cookie.name)) {
              cookieMap.set(cookie.name, cookie);
            }
          }
        } catch {
          // ignore
        }
      }

      const cookies = Array.from(cookieMap.values());
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      const sessionCookie = cookies.find((c) =>
        c.name === 'sessionid' ||
        c.name === 'platzi_session' ||
        c.name.toLowerCase().includes('session')
      );
      const csrfCookie = cookies.find((c) => c.name === 'csrftoken');

      sendResponse({
        cookiesCount: cookies.length,
        cookieNames: cookies.map((c) => c.name),
        cookieHeader,
        hasSession: Boolean(sessionCookie),
        hasCookies: cookies.length > 0,
        sessionId: sessionCookie ? sessionCookie.value : null,
        csrfToken: csrfCookie ? csrfCookie.value : null,
      });
    })();
    return true; // Keep channel open for async response
  }
});
