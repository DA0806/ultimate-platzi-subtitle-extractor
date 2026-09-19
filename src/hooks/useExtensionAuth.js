/* global chrome */
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { fetchAllPlatziCookies, isExtension } from '../utils/platziClient';

export const useExtensionAuth = () => {
  const login = useAuthStore(state => state.login);
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const cookie = useAuthStore(state => state.cookie);
  const completeSetup = useSettingsStore(state => state.completeSetup);

  const hasExistingAutoSession = Boolean(
    cookie?.trim() && !cookie.includes('mock_session_cookie') && (
      user?.isAutoDetected ||
      user?.email === 'Sesión detectada del navegador' ||
      (typeof token === 'string' && token.startsWith('ext_'))
    )
  );

  const [isAutoDetected, setIsAutoDetected] = useState(hasExistingAutoSession);
  const [isChecking, setIsChecking] = useState(false);
  const [cookiesCount, setCookiesCount] = useState(0);
  const [cookieNames, setCookieNames] = useState([]);
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);

  const applyCookies = useCallback((res) => {
    if (!res) return false;
    setCookiesCount(res.cookiesCount || res.cookies?.length || 0);
    setCookieNames(res.cookieNames || []);

    if ((res.hasSession || res.hasCookies) && res.cookieHeader) {
      login(
        res.sessionId || 'ext_token',
        res.cookieHeader,
        {
          name: 'Usuario Platzi',
          email: 'Sesión detectada del navegador',
          isAutoDetected: true,
          cookieCount: res.cookiesCount || res.cookies?.length || 0,
        }
      );
      setIsAutoDetected(true);
      completeSetup();
      if (window.location.hash.startsWith('#setup')) {
        window.location.hash = '';
      }
      return true;
    }
    return false;
  }, [login, completeSetup]);

  const checkExtensionSession = useCallback(async () => {
    if (!isExtension()) {
      return;
    }

    setIsChecking(true);
    try {
      // 1. Try direct cookies API access first
      const directResult = await fetchAllPlatziCookies();
      if (directResult && (directResult.hasSession || directResult.hasCookies)) {
        applyCookies(directResult);
        setIsChecking(false);
        setHasCheckedOnce(true);
        return;
      }

      // 2. Fallback to background service worker message
      if (chrome?.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'GET_PLATZI_COOKIES' }, (response) => {
          setIsChecking(false);
          setHasCheckedOnce(true);
          if (!chrome.runtime.lastError && response) {
            applyCookies(response);
          }
        });
        return;
      }
    } catch {
      // Ignore detection errors
    }

    setIsChecking(false);
    setHasCheckedOnce(true);
  }, [applyCookies]);

  useEffect(() => {
    let isCancelled = false;

    const timer = setTimeout(async () => {
      if (isCancelled || !isExtension()) return;
      setIsChecking(true);
      try {
        const directResult = await fetchAllPlatziCookies();
        if (isCancelled) return;
        if (directResult && (directResult.hasSession || directResult.hasCookies)) {
          applyCookies(directResult);
          setIsChecking(false);
          setHasCheckedOnce(true);
          return;
        }

        if (chrome?.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ type: 'GET_PLATZI_COOKIES' }, (response) => {
            if (isCancelled) return;
            setIsChecking(false);
            setHasCheckedOnce(true);
            if (!chrome.runtime.lastError && response) {
              applyCookies(response);
            }
          });
          return;
        }
      } catch {
        // ignore
      }
      if (!isCancelled) {
        setIsChecking(false);
        setHasCheckedOnce(true);
      }
    }, 0);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [applyCookies]);

  return {
    isAutoDetected,
    isChecking,
    cookiesCount,
    cookieNames,
    hasCheckedOnce,
    refreshSession: checkExtensionSession,
  };
};
