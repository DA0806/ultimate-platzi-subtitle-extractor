import { useCallback, useState } from 'react';
import {
  assertPlayerAuthorizationProof,
  createPlayerAuthorizationProof,
} from '../utils/playerTracks.js';

const extensionMessage = (message) => {
  const extension = globalThis.chrome;
  if (!extension?.runtime?.sendMessage) {
    const error = new Error('La detección del reproductor requiere la extensión instalada.');
    error.code = 'PLAYER_EXTENSION_UNAVAILABLE';
    throw error;
  }
  return new Promise((resolve, reject) => {
    extension.runtime.sendMessage(message, response => {
      if (extension.runtime.lastError) reject(Object.assign(new Error(extension.runtime.lastError.message), { code: 'PLAYER_MESSAGE_FAILED' }));
      else resolve(response);
    });
  });
};

export const usePlayerExtractor = () => {
  const [state, setState] = useState({ status: 'idle', tracks: [], page: null, error: null });

  const detectPlayer = useCallback(async () => {
    setState(current => ({ ...current, status: 'detecting', error: null }));
    try {
      const response = await extensionMessage({ type: 'PLAYER_PROBE' });
      if (!response?.ok) throw Object.assign(new Error(response?.error?.message || 'No se pudo detectar el reproductor.'), response?.error);
      const result = response.result || {};
      const nextState = { status: result.status || 'no-tracks', tracks: result.tracks || [], page: result.page || null, documentId: result.documentId || null, authorizationNonce: result.authorizationNonce || null, error: null };
      setState(nextState);
      return nextState;
    } catch (error) {
      const nextState = { status: 'error', tracks: [], page: null, error: error.message, errorCode: error.code };
      setState(nextState);
      throw error;
    }
  }, []);

  const extractTrack = useCallback(async (track, rightsConfirmed) => {
    if (!track || rightsConfirmed !== true) {
      const error = new Error('Confirma que tienes derecho a extraer este contenido.');
      error.code = 'PLAYER_RIGHTS_CONFIRMATION_REQUIRED';
      throw error;
    }
    const contextResponse = await extensionMessage({ type: 'PLAYER_CONTEXT' });
    const tabId = contextResponse?.context?.tabId;
    const documentId = state.documentId || contextResponse?.context?.documentId;
    const pageUrl = state.page ? `${state.page.origin}${state.page.pathname}` : null;
    const proof = createPlayerAuthorizationProof({
      pageUrl,
      tabId,
      documentId,
      playerId: track.playerId,
      trackId: track.trackId,
      authorizationNonce: state.authorizationNonce,
      rightsConfirmed,
    });
    const response = await extensionMessage({ type: 'PLAYER_READ', proof });
    if (!response?.ok || !response.result || response.result.status !== 'ready') {
      const error = new Error(response?.result?.reason || response?.error?.message || 'No se pudo extraer la pista.');
      error.code = response?.result?.reason || response?.error?.code || 'PLAYER_READ_FAILED';
      throw error;
    }
    const resultContext = {
      pageUrl: `${response.result.page.origin}${response.result.page.pathname}`,
      tabId,
      documentId: response.result.documentId,
      playerId: response.result.playerId,
      trackId: response.result.trackId,
    };
    assertPlayerAuthorizationProof(proof, resultContext);
    return {
      language: response.result.language || track.language || 'und',
      label: response.result.label || track.label || '',
      text: response.result.text || '',
      cues: response.result.cues || [],
      authorizationProof: proof,
      provenance: 'user_authorized_player',
    };
  }, [state.authorizationNonce, state.documentId, state.page]);

  return { ...state, detectPlayer, extractTrack };
};
