export const ACCESS_STATUS = Object.freeze({
  FREE: 'free',
  NOT_FREE: 'not-free',
  UNKNOWN: 'unknown',
});

const NEXT_FLIGHT_PUSH = 'self.__next_f.push(';
const PLATZI_HOSTS = new Set(['platzi.com', 'www.platzi.com']);

const normalizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const parseHttpsUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !PLATZI_HOSTS.has(url.hostname.toLowerCase()) || url.username || url.password || (url.port && url.port !== '443')) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
};

const normalizePageUrl = (value) => {
  const url = parseHttpsUrl(value);
  if (!url) return null;
  const pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
  return `https://platzi.com${pathname}/`;
};

const normalizeVttUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'static.platzi.com' || url.username || url.password || (url.port && url.port !== '443') || !url.pathname.toLowerCase().endsWith('.vtt')) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
};

const isClassPagePath = (value) => {
  const url = parseHttpsUrl(value);
  if (!url) return false;
  const parts = url.pathname.split('/').filter(Boolean);
  return parts.length === 3 && (parts[0] === 'cursos' || parts[0] === 'clases');
};

const findBalancedJsonEnd = (text, start) => {
  const opening = text[start];
  if (opening !== '{' && opening !== '[') return -1;
  const closing = opening === '{' ? '}' : ']';
  let depth = 0;
  let quote = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quote = false;
      continue;
    }
    if (character === '"') quote = true;
    else if (character === opening) depth += 1;
    else if (character === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
};

const parseNextFlightPushes = (script) => {
  const pushes = [];
  let from = 0;
  while (true) {
    const marker = script.indexOf(NEXT_FLIGHT_PUSH, from);
    if (marker < 0) return pushes;
    const open = script.indexOf('[', marker + NEXT_FLIGHT_PUSH.length);
    if (open < 0) return pushes;
    const end = findBalancedJsonEnd(script, open);
    if (end < 0) return pushes;
    try {
      const parsed = JSON.parse(script.slice(open, end + 1));
      if (Array.isArray(parsed) && parsed[0] === 1 && typeof parsed[1] === 'string') pushes.push(parsed[1]);
    } catch {
      // Malformed Next Flight chunks fail closed as unknown access.
    }
    from = end + 1;
  }
};

const consumeUtf8Bytes = (payload, start, byteLength) => {
  const encoder = new TextEncoder();
  let index = start;
  let consumed = 0;
  while (index < payload.length && consumed < byteLength) {
    const codePoint = payload.codePointAt(index);
    const character = String.fromCodePoint(codePoint);
    consumed += encoder.encode(character).length;
    index += character.length;
  }
  return consumed === byteLength ? index : -1;
};

const findFlightRecordEnd = (payload, start) => {
  let quote = false;
  let escaped = false;
  for (let index = start; index < payload.length; index += 1) {
    const character = payload[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quote = false;
    } else if (character === '"') quote = true;
    else if (character === '\n') return index;
  }
  return payload.length;
};

const collectComponentRecords = (value, records) => {
  if (Array.isArray(value)) {
    if (value[0] === '$' && typeof value[1] === 'string' && value[1].startsWith('$L') && value[2] === null && value[3] && typeof value[3] === 'object') {
      records.push(value[3]);
    }
    value.forEach(item => collectComponentRecords(item, records));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach(item => collectComponentRecords(item, records));
  }
};

const parseFramedComponentRecords = (payload) => {
  const records = [];
  let offset = 0;
  while (offset < payload.length) {
    if (payload[offset] === '\n') {
      offset += 1;
      continue;
    }
    if (payload[offset] === ':') {
      const typedLineEnd = findFlightRecordEnd(payload, offset);
      const typedBody = payload.slice(offset + 1, typedLineEnd);
      if (!/^(?:HL)(?:\[|$)/.test(typedBody)) return null;
      offset = typedLineEnd < payload.length ? typedLineEnd + 1 : payload.length;
      continue;
    }
    const header = payload.slice(offset).match(/^([0-9a-f]+):/i);
    if (!header) return null;
    offset += header[0].length;

    if (payload[offset] === 'T') {
      const comma = payload.indexOf(',', offset + 1);
      if (comma < 0) return null;
      const lengthText = payload.slice(offset + 1, comma);
      if (!/^[0-9a-f]+$/i.test(lengthText)) return null;
      const byteLength = Number.parseInt(lengthText, 16);
      if (!Number.isSafeInteger(byteLength)) return null;
      const end = consumeUtf8Bytes(payload, comma + 1, byteLength);
      if (end < 0) return null;
      offset = end;
      if (payload[offset] === '\n') offset += 1;
      continue;
    }

    const lineEnd = findFlightRecordEnd(payload, offset);
    const end = lineEnd;
    const body = payload.slice(offset, end);
    offset = lineEnd < payload.length ? lineEnd + 1 : payload.length;
    if (!body) continue;
    if (/^(?:I|HL)(?:\[|$)/.test(body)) continue;
    if (/^[A-Z]/.test(body)) return null;
    try {
      collectComponentRecords(JSON.parse(body), records);
    } catch {
      return null;
    }
  }
  return records;
};

const parsePageViewRecords = (payload) => parseFramedComponentRecords(payload)?.filter(record => record.category === 'material-view' && record.name === 'page-view') || null;

const isClassPageEvent = (value) => {
  const properties = value?.properties;
  return Number.isInteger(properties?.class_id)
    && properties.class_id > 0
    && Number.isInteger(properties.class_position)
    && properties.class_position > 0
    && Number.isInteger(properties.course_id)
    && properties.course_id > 0
    && typeof properties.class_name === 'string'
    && normalizeText(properties.class_name).length > 0
    && typeof properties.class_is_free === 'boolean';
};

const extractCurrentMaterialVttUrls = (payload, classId, className) => {
  const urls = [];
  const materialRecords = parseFramedComponentRecords(payload)
    || [];
  const matchingMaterialRecords = materialRecords
    .filter(record => record.surface === 'course' && record.materialInfo && typeof record.materialInfo === 'object')
    .filter(record => record.materialInfo.id === classId && normalizeText(record.materialInfo.title) === className);
  if (matchingMaterialRecords.length !== 1) return urls;
  const subtitles = matchingMaterialRecords[0].materialInfo.video?.movin?.subtitles;
  if (!Array.isArray(subtitles)) return urls;
  for (const subtitle of subtitles) {
    if (!subtitle || subtitle.type !== 'captions' || typeof subtitle.source !== 'string') continue;
    const normalized = normalizeVttUrl(subtitle.source);
    if (normalized && !urls.includes(normalized)) urls.push(normalized);
  }
  return urls;
};

const inspectDocument = (document, pageUrl) => {
  if (!isClassPagePath(pageUrl)) return { status: ACCESS_STATUS.UNKNOWN };
  const normalizedPageUrl = normalizePageUrl(pageUrl);
  const canonicalHref = document.querySelector('link[rel="canonical"]')?.href || '';
  const canonicalUrl = normalizePageUrl(canonicalHref);
  if (!normalizedPageUrl || !canonicalUrl || canonicalUrl !== normalizedPageUrl) return { status: ACCESS_STATUS.UNKNOWN };

  const currentName = normalizeText(document.querySelector('h1')?.textContent || document.title);
  if (!currentName) return { status: ACCESS_STATUS.UNKNOWN };

  const payloads = [];
  for (const script of document.querySelectorAll('script')) {
    payloads.push(...parseNextFlightPushes(script.textContent || ''));
  }
  const records = parsePageViewRecords(payloads.join(''));
  if (!records) return { status: ACCESS_STATUS.UNKNOWN };
  const currentRecords = records
    .filter(record => isClassPageEvent(record))
    .map(record => record.properties)
    .filter(properties => normalizeText(properties.class_name) === currentName);
  if (currentRecords.length !== 1) return { status: ACCESS_STATUS.UNKNOWN };

  const properties = currentRecords[0];
  return {
    status: properties.class_is_free ? ACCESS_STATUS.FREE : ACCESS_STATUS.NOT_FREE,
    classId: properties.class_id,
    classPosition: properties.class_position,
    className: normalizeText(properties.class_name),
    courseId: properties.course_id,
    courseName: normalizeText(properties.course_name),
    pageUrl: normalizedPageUrl,
    vttUrls: extractCurrentMaterialVttUrls(payloads.join(''), properties.class_id, normalizeText(properties.class_name)),
  };
};

export const inspectPlatziClassAccess = (html, pageUrl) => {
  if (typeof html !== 'string' || typeof DOMParser !== 'function') return { status: ACCESS_STATUS.UNKNOWN };
  return inspectDocument(new DOMParser().parseFromString(html, 'text/html'), pageUrl);
};

export const inspectPlatziClassAccessDocument = (document, pageUrl) => inspectDocument(document, pageUrl);

export const createPlatziAccessError = (accessStatus = ACCESS_STATUS.UNKNOWN) => {
  const error = new Error('Platzi no marcó esta clase como gratuita; UPSE no puede verificar el acceso de una cuenta para extraerla.');
  error.code = 'PLATZI_ACCESS_UNVERIFIED';
  error.accessStatus = accessStatus;
  return error;
};

export const assertPlatziFreeClass = (html, pageUrl) => {
  const access = inspectPlatziClassAccess(html, pageUrl);
  if (access.status !== ACCESS_STATUS.FREE) throw createPlatziAccessError(access.status);
  return access;
};

export const assertPlatziFreeClassDocument = (document, pageUrl) => {
  const access = inspectDocument(document, pageUrl);
  if (access.status !== ACCESS_STATUS.FREE) throw createPlatziAccessError(access.status);
  return access;
};

export const isFreeAccessProofForUrl = (proof, pageUrl, vttUrl) => (
  proof?.status === ACCESS_STATUS.FREE
  && proof.pageUrl === normalizePageUrl(pageUrl)
  && Boolean(vttUrl)
  && proof.vttUrls?.includes(normalizeVttUrl(vttUrl))
);

export const assertFreeAccessProofForUrl = (proof, pageUrl, vttUrl) => {
  if (!isFreeAccessProofForUrl(proof, pageUrl, vttUrl)) {
    throw createPlatziAccessError(proof?.accessStatus || ACCESS_STATUS.UNKNOWN);
  }
  return proof;
};
