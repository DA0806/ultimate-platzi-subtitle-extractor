/* global chrome */
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

export const useExtensionAuth = () => {
  const login = useAuthStore(state => state.login);
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const cookie = useAuthStore(state => state.cookie);

  const hasExistingAutoSession = Boolean(
    cookie?.trim() && !cookie.includes('mock_session_cookie') && (
      user?.isAutoDetected ||
      user?.email === 'Sesión detectada del navegador' ||
      (typeof token === 'string' && token.startsWith('ext_'))
    )
  );

  const [isAutoDetected, setIsAutoDetected] = useState(hasExistingAutoSession);
  const [isChecking, setIsChecking] = useState(false);

  const checkExtensionSession = useCallback(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return;
    }

    setIsChecking(true);
    try {
      chrome.runtime.sendMessage({ type: 'GET_PLATZI_COOKIES' }, (response) => {
        setIsChecking(false);
        if (chrome.runtime.lastError) {
          return;
        }

        if (response && response.hasSession && response.cookieHeader) {
          login(
            response.sessionId || 'ext_token',
            response.cookieHeader,
            { name: 'Usuario Platzi', email: 'Sesión detectada del navegador', isAutoDetected: true }
          );
          setIsAutoDetected(true);
        }
      });
    } catch {
      setIsChecking(false);
    }
  }, [login]);

  useEffect(() => {
    let isMounted = true;
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      return undefined;
    }

    try {
      chrome.runtime.sendMessage({ type: 'GET_PLATZI_COOKIES' }, (response) => {
        if (!isMounted) return;
        setIsChecking(false);
        if (chrome.runtime.lastError) return;

        if (response && response.hasSession && response.cookieHeader) {
          login(
            response.sessionId || 'ext_token',
            response.cookieHeader,
            { name: 'Usuario Platzi', email: 'Sesión detectada del navegador', isAutoDetected: true }
          );
          setIsAutoDetected(true);
        }
      });
    } catch {
      // Extension runtime error or disconnected context
    }

    return () => {
      isMounted = false;
    };
  }, [login]);

  return { isAutoDetected, isChecking, refreshSession: checkExtensionSession };
};
