// Passed to chrome.scripting.executeScript as a one-shot isolated-world function.
export const probePlayerInPage = async () => {
  try {
    const pageIdentityInPage = () => {
      const url = new URL(location.href);
      const pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
      return { origin: url.origin, pathname, pageKey: `${url.origin}${pathname}` };
    };
    const getDocumentTokenInPage = () => {
      if (!globalThis['__upse_document_identity_v1__']) globalThis['__upse_document_identity_v1__'] = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      return globalThis['__upse_document_identity_v1__'];
    };
    const getIdentityInPage = (value, symbolName) => {
      const symbol = Symbol.for(symbolName);
      if (!value[symbol]) value[symbol] = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      return value[symbol];
    };
    const itemsInPage = value => {
      if (!value || typeof value.length !== 'number') return [];
      const result = [];
      for (let index = 0; index < value.length; index += 1) {
        const item = typeof value.item === 'function' ? value.item(index) : value[index];
        if (item) result.push(item);
      }
      return result;
    };
    const createOpaqueDigest = async value => {
      const input = String(value);
      if (!globalThis.crypto?.subtle || !globalThis.TextEncoder) throw new Error('PLAYER_REVISION_UNAVAILABLE');
      const bytes = await globalThis.crypto.subtle.digest('SHA-256', new globalThis.TextEncoder().encode(input));
      return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
    };
    const getSourceSnapshotInPage = (videos, tracks) => [location.href, ...videos.flatMap(video => [
        video.currentSrc || '',
        video.src || '',
        ...Array.from(video.querySelectorAll?.('track') || []).flatMap(track => [track.src || '', track.getAttribute('src') || '']),
      ]), ...tracks.map(track => `${track.playerId}\u0000${track.trackId}`)].join('\u0000');
    const getPlayerRevisionInPage = async (videos, tracks) => {
      // Hash transient page/media identifiers; only the digest and opaque revision survive.
      const sourceSnapshot = getSourceSnapshotInPage(videos, tracks);
      const digest = await createOpaqueDigest(sourceSnapshot);
      if (sourceSnapshot !== getSourceSnapshotInPage(videos, tracks)) throw new Error('PLAYER_REVISION_CHANGED');
      const previous = globalThis['__upse_player_revision_v1__'];
      if (!previous || previous.digest !== digest) {
        globalThis['__upse_player_revision_v1__'] = {
          digest,
          revision: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        };
      }
      return globalThis['__upse_player_revision_v1__'].revision;
    };
    const page = pageIdentityInPage();
    const documentId = getDocumentTokenInPage();
    const videos = Array.from(document.querySelectorAll('video'));
    const tracks = videos.flatMap(video => {
      const playerId = getIdentityInPage(video, 'upse.player.identity.v1');
      return itemsInPage(video.textTracks).map(track => ({
        trackId: getIdentityInPage(track, 'upse.track.identity.v1'),
        playerId,
        kind: typeof track.kind === 'string' ? track.kind : '',
        language: typeof track.language === 'string' ? track.language : '',
        label: typeof track.label === 'string' ? track.label : '',
        mode: typeof track.mode === 'string' ? track.mode : 'disabled',
        enabled: track.mode !== 'disabled',
      }));
    });
    const playerRevision = await getPlayerRevisionInPage(videos, tracks);
    return {
      status: videos.length === 0 ? 'no-video' : tracks.length === 0 ? 'no-tracks' : 'available',
      reason: videos.length === 0 ? 'PLAYER_NO_VIDEO' : tracks.length === 0 ? 'PLAYER_NO_TRACKS' : null,
      page,
      documentId,
      playerRevision,
      tracks,
    };
  } catch {
    return { status: 'error', reason: 'PLAYER_DOCUMENT_UNREADABLE', tracks: [] };
  }
};

// This function is only invoked after the extension validates the ephemeral proof.
export const readPlayerInPage = async ({ playerId, trackId, pageKey, documentId, playerRevision: expectedPlayerRevision } = {}) => {
  try {
    const pageIdentityInPage = () => {
      const url = new URL(location.href);
      const pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
      return { origin: url.origin, pathname, pageKey: `${url.origin}${pathname}` };
    };
    const getDocumentTokenInPage = () => {
      if (!globalThis['__upse_document_identity_v1__']) globalThis['__upse_document_identity_v1__'] = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      return globalThis['__upse_document_identity_v1__'];
    };
    const getIdentityInPage = (value, symbolName) => {
      const symbol = Symbol.for(symbolName);
      if (!value[symbol]) value[symbol] = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      return value[symbol];
    };
    const itemsInPage = value => {
      if (!value || typeof value.length !== 'number') return [];
      const result = [];
      for (let index = 0; index < value.length; index += 1) {
        const item = typeof value.item === 'function' ? value.item(index) : value[index];
        if (item) result.push(item);
      }
      return result;
    };
    const createOpaqueDigest = async value => {
      const input = String(value);
      if (!globalThis.crypto?.subtle || !globalThis.TextEncoder) throw new Error('PLAYER_REVISION_UNAVAILABLE');
      const bytes = await globalThis.crypto.subtle.digest('SHA-256', new globalThis.TextEncoder().encode(input));
      return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
    };
    const getSourceSnapshotInPage = (videos, tracks) => [location.href, ...videos.flatMap(video => [
        video.currentSrc || '',
        video.src || '',
        ...Array.from(video.querySelectorAll?.('track') || []).flatMap(track => [track.src || '', track.getAttribute('src') || '']),
      ]), ...tracks.map(track => `${track.playerId}\u0000${track.trackId}`)].join('\u0000');
    const getPlayerRevisionInPage = async (videos, tracks) => {
      // Hash transient page/media identifiers; only the digest and opaque revision survive.
      const sourceSnapshot = getSourceSnapshotInPage(videos, tracks);
      const digest = await createOpaqueDigest(sourceSnapshot);
      if (sourceSnapshot !== getSourceSnapshotInPage(videos, tracks)) throw new Error('PLAYER_REVISION_CHANGED');
      const previous = globalThis['__upse_player_revision_v1__'];
      if (!previous || previous.digest !== digest) {
        globalThis['__upse_player_revision_v1__'] = {
          digest,
          revision: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        };
      }
      return globalThis['__upse_player_revision_v1__'].revision;
    };
    const page = pageIdentityInPage();
    const host = new URL(location.href).hostname.toLowerCase();
    const loopback = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    const isPlatziResource = value => {
      if (typeof value !== 'string' || !value) return false;
      try {
        const resourceHost = new URL(value, location.href).hostname.toLowerCase();
        return resourceHost === 'platzi.com' || resourceHost.endsWith('.platzi.com');
      } catch {
        return false;
      }
    };
    if (host === 'platzi.com' || host.endsWith('.platzi.com') || !(location.protocol === 'https:' || (location.protocol === 'http:' && loopback))) {
      return { status: 'error', reason: 'PLAYER_PAGE_UNSUPPORTED' };
    }
    if (page.pageKey !== pageKey || getDocumentTokenInPage() !== documentId) return { status: 'stale', reason: 'PLAYER_STALE_CONTEXT' };
    const trackSymbol = Symbol.for('upse.track.identity.v1');
    const playerSymbol = Symbol.for('upse.player.identity.v1');
    const video = Array.from(document.querySelectorAll('video')).find(item => item[playerSymbol] === playerId);
    const allVideos = Array.from(document.querySelectorAll('video'));
    const allTracks = allVideos.flatMap(item => {
      const currentPlayerId = item[playerSymbol] || getIdentityInPage(item, 'upse.player.identity.v1');
      return itemsInPage(item.textTracks).map(itemTrack => ({
        playerId: currentPlayerId,
        trackId: itemTrack[trackSymbol] || getIdentityInPage(itemTrack, 'upse.track.identity.v1'),
      }));
    });
    const playerRevision = await getPlayerRevisionInPage(allVideos, allTracks);
    const track = video && itemsInPage(video.textTracks).find(item => item[trackSymbol] === trackId);
    if (!expectedPlayerRevision || playerRevision !== expectedPlayerRevision) return { status: 'stale', reason: 'PLAYER_STALE_CONTEXT' };
    if (!track) return { status: 'stale', reason: 'PLAYER_STALE_CONTEXT' };
    if (track.kind !== 'subtitles' && track.kind !== 'captions') return { status: 'error', reason: 'PLAYER_TRACK_KIND_UNSUPPORTED' };
    if (track.mode === 'disabled') return { status: 'error', reason: 'PLAYER_TRACK_DISABLED' };
    const trackElement = video && typeof video.querySelectorAll === 'function'
      ? Array.from(video.querySelectorAll('track')).find(item => item.track === track)
      : null;
    if (isPlatziResource(video?.currentSrc) || isPlatziResource(video?.src) || isPlatziResource(track?.src) || isPlatziResource(trackElement?.src)) {
      return { status: 'error', reason: 'PLAYER_RESOURCE_UNSUPPORTED' };
    }

    if (!track.cues || itemsInPage(track.cues).length === 0) return { status: 'error', reason: 'PLAYER_NO_CUES' };
    const cues = itemsInPage(track.cues).map((cue, index) => {
      const startTime = Number(cue?.startTime);
      const endTime = Number(cue?.endTime);
      if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime < 0 || endTime < startTime) throw new Error('PLAYER_INVALID_CUE');
      return {
        startTime,
        endTime,
        text: String(cue?.text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
        index,
      };
    }).filter(cue => cue.text);
    cues.sort((left, right) => left.startTime - right.startTime || left.endTime - right.endTime || left.index - right.index);
    const seenCues = new Set();
    const uniqueCues = cues.filter(cue => {
      const key = `${cue.startTime}\u0000${cue.endTime}\u0000${cue.text}`;
      if (seenCues.has(key)) return false;
      seenCues.add(key);
      return true;
    }).map(({ startTime, endTime, text }) => ({ startTime, endTime, text }));
    const finalPlayerRevision = await getPlayerRevisionInPage(allVideos, allTracks);
    if (page.pageKey !== pageKey || getDocumentTokenInPage() !== documentId || finalPlayerRevision !== playerRevision) return { status: 'stale', reason: 'PLAYER_STALE_CONTEXT' };
    return {
      status: 'ready',
      page,
      documentId,
      playerRevision,
      playerId,
      trackId,
      language: typeof track.language === 'string' ? track.language : '',
      label: typeof track.label === 'string' ? track.label : '',
      cues: uniqueCues,
      text: uniqueCues.map(cue => cue.text).join(' '),
    };
  } catch (error) {
    return { status: 'error', reason: error?.message === 'PLAYER_INVALID_CUE' ? 'PLAYER_INVALID_CUE' : 'PLAYER_READ_FAILED' };
  }
};
