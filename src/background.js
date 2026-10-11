/* global chrome */
// Background service worker for MV3 extension
import { probePlayerInPage, readPlayerInPage } from './utils/playerInjection.js';
import { isTrustedPlayerMessageSender } from './utils/playerMessageAuth.js';

let activePageContext = null;

const errorResponse = (reason, message = 'No se pudo leer el reproductor de la página activa.') => ({
  ok: false,
  error: { code: reason, message },
});

const getTargetTab = async () => {
  if (activePageContext?.tabId === undefined || activePageContext?.tabId === null) return null;
  try {
    return await chrome.tabs.get(activePageContext.tabId);
  } catch {
    activePageContext = null;
    return null;
  }
};

const runInActivePage = async (func, args) => {
  const tab = await getTargetTab();
  if (tab?.id === undefined || tab?.id === null) return errorResponse('PLAYER_ACTIVE_TAB_UNAVAILABLE', 'Abre la extensión desde la página que contiene el reproductor.');
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      func,
      args: args === undefined ? [] : [args],
    });
    return { ok: true, result: result?.result || null };
  } catch {
    return errorResponse('PLAYER_INJECTION_FAILED', 'No se pudo inspeccionar la página activa.');
  }
};

const isAllowedPlayerPage = page => {
  if (!page?.origin || !page?.pageKey) return false;
  try {
    const url = new URL(page.pageKey);
    const host = url.hostname.toLowerCase();
    const loopback = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    return !['platzi.com', 'www.platzi.com'].includes(host) && !host.endsWith('.platzi.com') && (url.protocol === 'https:' || (url.protocol === 'http:' && loopback));
  } catch {
    return false;
  }
};

const matchesPlayerProof = (result, proof) => Boolean(
  isAllowedPlayerPage(result?.page) &&
  result.page.pageKey === proof?.pageKey &&
  result.documentId === proof?.documentId &&
  result.tracks?.some(track => track.trackId === proof?.trackId && track.playerId === proof?.playerId)
);

// 1. Open extractor in a full-size tab when toolbar icon is clicked
chrome.action.onClicked.addListener(async tab => {
  activePageContext = tab?.id === undefined || tab?.id === null ? null : { tabId: tab.id, windowId: tab.windowId };
  const extensionUrl = chrome.runtime.getURL('index.html');
  const tabs = await chrome.tabs.query({ url: `${extensionUrl}*` });

  if (tabs.length > 0) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: extensionUrl });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isTrustedPlayerMessageSender(_sender, chrome.runtime)) return false;
  if (message?.type === 'PLAYER_PROBE') {
    runInActivePage(probePlayerInPage).then(response => {
      if (response.ok && response.result) {
        const authorizationNonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
        activePageContext = {
          ...activePageContext,
          page: response.result.page || null,
          documentId: response.result.documentId || null,
          authorizationNonce,
        };
        response.result = { ...response.result, authorizationNonce };
      }
      sendResponse(response);
    });
    return true;
  }

  if (message?.type === 'PLAYER_READ') {
    const proof = message.proof;
    if (!proof || proof.provider !== 'user_authorized_player' || proof.tabId !== activePageContext?.tabId ||
      proof.authorizationNonce !== activePageContext?.authorizationNonce || !Number.isFinite(proof.expiresAt) || Date.now() >= proof.expiresAt) {
      sendResponse(errorResponse('PLAYER_AUTHORIZATION_REQUIRED', 'Confirma los derechos del contenido y vuelve a detectar la página.'));
      return false;
    }
    runInActivePage(probePlayerInPage).then(probeResponse => {
      if (!probeResponse.ok || !matchesPlayerProof(probeResponse.result, proof)) {
        sendResponse(errorResponse('PLAYER_STALE_CONTEXT', 'La página o la pista cambiaron; vuelve a detectar la pista.'));
        return;
      }
      runInActivePage(readPlayerInPage, {
        playerId: proof.playerId,
        trackId: proof.trackId,
        pageKey: proof.pageKey,
        documentId: proof.documentId,
      }).then(response => sendResponse(response));
    });
    return true;
  }

  if (message?.type === 'PLAYER_VALIDATE') {
    runInActivePage(probePlayerInPage).then(response => {
      if (!response.ok || !response.result) {
        sendResponse(response);
        return;
      }
      const proof = message.proof;
      const valid = proof?.provider === 'user_authorized_player' &&
        proof.tabId === activePageContext?.tabId &&
        proof.authorizationNonce === activePageContext?.authorizationNonce &&
        Number.isFinite(proof.expiresAt) && Date.now() < proof.expiresAt &&
        matchesPlayerProof(response.result, proof);
      sendResponse(valid ? { ok: true, result: response.result } : errorResponse('PLAYER_STALE_CONTEXT', 'La página o la pista cambiaron; vuelve a detectar la pista.'));
    });
    return true;
  }

  if (message?.type === 'PLAYER_CONTEXT') {
    sendResponse({ ok: true, context: activePageContext });
    return false;
  }

  return false;
});
