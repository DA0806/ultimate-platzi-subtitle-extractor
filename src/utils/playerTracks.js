const playerIds = new WeakMap();
const trackIds = new WeakMap();
const issuedProofs = new WeakSet();
let nextPlayerId = 1;
let nextTrackId = 1;

const createError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const getId = (registry, value, prefix, next) => {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) return null;
  if (!registry.has(value)) registry.set(value, `${prefix}-${next()}`);
  return registry.get(value);
};

const nextPlayerNumber = () => nextPlayerId++;
const nextTrackNumber = () => nextTrackId++;

const isPlatziHost = hostname => hostname === 'platzi.com' || hostname.endsWith('.platzi.com');
const isLoopbackHost = hostname => hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
const isPlatziResource = value => {
  if (typeof value !== 'string' || !value) return false;
  try {
    return isPlatziHost(new URL(value).hostname.toLowerCase());
  } catch {
    return false;
  }
};

export const getPlayerPageIdentity = value => {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    const pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
    return Object.freeze({
      origin: url.origin,
      pathname,
      pageKey: `${url.origin}${pathname}`,
    });
  } catch {
    return null;
  }
};

const isAuthorizedPlayerPage = page => page && !isPlatziHost(new URL(page.pageKey).hostname.toLowerCase()) &&
  (page.pageKey.startsWith('https://') || isLoopbackHost(new URL(page.pageKey).hostname.toLowerCase()));

const getItems = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value.slice();
  if (typeof value.length === 'number') {
    const items = [];
    for (let index = 0; index < value.length; index += 1) {
      const item = typeof value.item === 'function' ? value.item(index) : value[index];
      if (item) items.push(item);
    }
    return items;
  }
  return [];
};

const readTrackMetadata = (track, playerId) => {
  const trackId = getId(trackIds, track, 'track', nextTrackNumber);
  return {
    trackId,
    playerId,
    kind: typeof track.kind === 'string' ? track.kind : '',
    language: typeof track.language === 'string' ? track.language : '',
    label: typeof track.label === 'string' ? track.label : '',
    mode: typeof track.mode === 'string' ? track.mode : 'disabled',
    enabled: track.mode !== 'disabled',
  };
};

export const probePlayerTracks = ({
  documentRef = typeof document !== 'undefined' ? document : null,
  pageUrl = typeof location !== 'undefined' ? location.href : null,
  tabId = null,
  documentId = null,
  playerRevision = null,
} = {}) => {
  const page = getPlayerPageIdentity(pageUrl);
  if (!page) {
    return { status: 'unsupported-page', reason: 'PLAYER_PAGE_UNSUPPORTED', page: null, tracks: [] };
  }
  if (!documentRef || typeof documentRef.querySelectorAll !== 'function') {
    return { status: 'error', reason: 'PLAYER_DOCUMENT_UNREADABLE', page, tracks: [] };
  }

  let videos;
  try {
    videos = Array.from(documentRef.querySelectorAll('video'));
  } catch {
    return { status: 'error', reason: 'PLAYER_DOCUMENT_UNREADABLE', page, tracks: [] };
  }
  if (videos.length === 0) return { status: 'no-video', reason: 'PLAYER_NO_VIDEO', page, tracks: [] };

  const tracks = [];
  for (const video of videos) {
    const playerId = getId(playerIds, video, 'player', nextPlayerNumber);
    for (const track of getItems(video.textTracks)) {
      // Deliberately read only TextTrack metadata here. Cue text is read by readPlayerTrack after auth.
      tracks.push({ ...readTrackMetadata(track, playerId), tabId, documentId, playerRevision, page });
    }
  }

  return {
    status: tracks.length > 0 ? 'available' : 'no-tracks',
    reason: tracks.length > 0 ? null : 'PLAYER_NO_TRACKS',
    page,
    playerRevision,
    tracks,
  };
};

export const createPlayerAuthorizationProof = ({
  pageUrl,
  tabId,
  documentId,
  playerId,
  trackId,
  playerRevision = null,
  authorizationNonce = null,
  rightsConfirmed,
  now = Date.now(),
  ttlMs = 5 * 60 * 1000,
} = {}) => {
  if (rightsConfirmed !== true) {
    throw createError('PLAYER_RIGHTS_CONFIRMATION_REQUIRED', 'Confirma que tienes derecho a extraer este contenido.');
  }
  const page = getPlayerPageIdentity(pageUrl);
  if (!isAuthorizedPlayerPage(page)) throw createError('PLAYER_PAGE_UNSUPPORTED', 'Esta página no admite extracción de pistas.');
  if (!Number.isInteger(tabId) || !documentId || !playerId || !trackId) {
    throw createError('PLAYER_AUTHORIZATION_SCOPE_MISMATCH', 'Falta el contexto actual de la página o del reproductor.');
  }
  if (!Number.isFinite(now) || !Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw createError('PLAYER_AUTHORIZATION_INVALID', 'La autorización efímera no es válida.');
  }

  const proof = Object.freeze({
    provider: 'user_authorized_player',
    origin: page.origin,
    pathname: page.pathname,
    pageKey: page.pageKey,
    tabId,
    documentId: String(documentId),
    playerId: String(playerId),
    trackId: String(trackId),
    playerRevision: playerRevision ? String(playerRevision) : null,
    authorizationNonce: authorizationNonce ? String(authorizationNonce) : null,
    authorizedAt: now,
    expiresAt: now + ttlMs,
  });
  issuedProofs.add(proof);
  return proof;
};

export const assertPlayerAuthorizationProof = (proof, context, now = Date.now()) => {
  const page = getPlayerPageIdentity(context?.pageUrl);
  const proofPage = proof?.origin && proof?.pathname ? getPlayerPageIdentity(`${proof.origin}${proof.pathname}`) : null;
  if (!proof || !issuedProofs.has(proof) || proof.provider !== 'user_authorized_player' || !isAuthorizedPlayerPage(page) || !isAuthorizedPlayerPage(proofPage)) {
    throw createError('PLAYER_AUTHORIZATION_REQUIRED', 'La autorización de esta pista no está disponible.');
  }
  if (!Number.isFinite(now) || !Number.isFinite(proof.authorizedAt) || !Number.isFinite(proof.expiresAt) || proof.expiresAt <= proof.authorizedAt || now < proof.authorizedAt || now >= proof.expiresAt) {
    throw createError('PLAYER_AUTHORIZATION_EXPIRED', 'La autorización de esta pista caducó.');
  }
  if (
    proof.origin !== page.origin ||
    proof.pathname !== page.pathname ||
    proof.tabId !== context.tabId ||
    String(proof.documentId) !== String(context.documentId) ||
    String(proof.playerId) !== String(context.playerId) ||
    String(proof.trackId) !== String(context.trackId) ||
    (((context.playerRevision !== null && context.playerRevision !== undefined) ||
      (proof.playerRevision !== null && proof.playerRevision !== undefined)) &&
      (!proof.playerRevision || proof.playerRevision !== context.playerRevision)) ||
    (context.authorizationNonce !== undefined && proof.authorizationNonce !== context.authorizationNonce)
  ) {
    throw createError('PLAYER_AUTHORIZATION_SCOPE_MISMATCH', 'La página o el reproductor cambiaron; vuelve a detectar la pista.');
  }
  return proof;
};

const normalizeCueText = value => String(value || '')
  .replace(/<[^>]+>/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const sameContext = (expected, actual) => {
  if (!actual) return true;
  return getPlayerPageIdentity(actual.pageUrl)?.pageKey === getPlayerPageIdentity(expected.pageUrl)?.pageKey &&
    actual.tabId === expected.tabId &&
    String(actual.documentId) === String(expected.documentId) &&
    String(actual.playerId) === String(expected.playerId) &&
    String(actual.trackId) === String(expected.trackId) &&
    (actual.playerRevision === undefined || String(actual.playerRevision) === String(expected.playerRevision));
};

export const readPlayerTrack = (track, {
  proof,
  context,
  currentTrack = track,
  currentContext = context,
  now = Date.now(),
} = {}) => {
  const trackId = getId(trackIds, track, 'track', nextTrackNumber);
  const playerId = context?.playerId;
  const scopedContext = { ...context, playerId, trackId };
  if (currentTrack !== track || !sameContext(context, currentContext)) {
    throw createError('PLAYER_STALE_CONTEXT', 'La página o la pista cambiaron durante la lectura.');
  }
  assertPlayerAuthorizationProof(proof, scopedContext, now);
  if (track?.kind !== 'subtitles' && track?.kind !== 'captions') {
    throw createError('PLAYER_TRACK_KIND_UNSUPPORTED', 'La pista detectada no es una pista de subtítulos o captions.');
  }
  if (track?.mode === 'disabled') throw createError('PLAYER_TRACK_DISABLED', 'Activa la pista en el reproductor antes de extraerla.');
  if (isPlatziResource(track?.src) || isPlatziResource(context?.mediaSrc)) {
    throw createError('PLAYER_RESOURCE_UNSUPPORTED', 'La pista o el reproductor pertenece a un recurso Platzi protegido.');
  }

  if (!track?.cues) throw createError('PLAYER_NO_CUES', 'La pista aún no tiene cues cargadas.');
  const rawCues = getItems(track.cues);
  if (rawCues.length === 0) throw createError('PLAYER_NO_CUES', 'La pista aún no tiene cues cargadas.');
  const cues = rawCues.map((cue, index) => {
    const startTime = Number(cue?.startTime);
    const endTime = Number(cue?.endTime);
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime < 0 || endTime < startTime) {
      throw createError('PLAYER_INVALID_CUE', 'La pista contiene tiempos inválidos.');
    }
    return { startTime, endTime, text: normalizeCueText(cue?.text), index };
  }).filter(cue => cue.text);

  cues.sort((left, right) => left.startTime - right.startTime || left.endTime - right.endTime || left.index - right.index);
  const seenCues = new Set();
  const uniqueCues = cues.filter(cue => {
    const key = `${cue.startTime}\u0000${cue.endTime}\u0000${cue.text}`;
    if (seenCues.has(key)) return false;
    seenCues.add(key);
    return true;
  }).map(({ startTime, endTime, text }) => ({ startTime, endTime, text }));

  if (currentTrack !== track || !sameContext(context, currentContext)) {
    throw createError('PLAYER_STALE_CONTEXT', 'La página o la pista cambiaron durante la lectura.');
  }
  assertPlayerAuthorizationProof(proof, scopedContext, now);

  return {
    trackId,
    playerId,
    language: typeof track?.language === 'string' ? track.language : '',
    label: typeof track?.label === 'string' ? track.label : '',
    cues: uniqueCues,
    text: uniqueCues.map(cue => cue.text).join(' '),
    provenance: proof,
  };
};

