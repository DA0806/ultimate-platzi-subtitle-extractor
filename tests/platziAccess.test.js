import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_STATUS,
  assertPlatziFreeClassDocument,
  inspectPlatziClassAccessDocument,
} from '../src/utils/platziAccess.js';
import { getVtt } from '../src/utils/platziClient.js';

const pageUrl = 'https://platzi.com/cursos/javascript/hola-mundo-en-mac/';
const originalChrome = globalThis.chrome;
const originalLocation = globalThis.location;
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.chrome = originalChrome;
  globalThis.location = originalLocation;
  globalThis.fetch = originalFetch;
});

const nextFlightScript = (...events) => {
  const payload = events.map((event, index) => `${index + 1}:${JSON.stringify(['$', '$L32', null, event])}\n`).join('');
  return `self.__next_f.push(${JSON.stringify([1, payload])})`;
};

const materialScript = ({ classId, className, source = 'https://static.platzi.com/media/subtitle/class-es.vtt' }) => {
  const payload = `1:${JSON.stringify(['$', '$L25', null, {
    surface: 'course',
    materialInfo: {
      id: classId,
      title: className,
      video: { movin: { subtitles: [{ source, type: 'captions', language: 'es', label: 'Spanish' }] } },
    },
  }])}\n`;
  return `self.__next_f.push(${JSON.stringify([1, payload])})`;
};

const textRecordScript = (event, material, trailingEvent = null) => {
  const text = `,["$","$L32",null,${JSON.stringify(event)}],["$","$L25",null,${JSON.stringify(material)}],"texto Unicode ñ"`;
  const byteLength = new TextEncoder().encode(text).length;
  const trailing = trailingEvent ? `43:${JSON.stringify(['$', '$L32', null, trailingEvent])}\n` : '';
  return `self.__next_f.push(${JSON.stringify([1, `42:T${byteLength.toString(16)},${text}${trailing}`])})`;
};

const classEvent = ({
  classId = 70442,
  className = 'Instalación y Configuración de JavaScript en Visual Studio Code',
  classPosition = 2,
  classIsFree = false,
} = {}) => ({
  category: 'material-view',
  name: 'page-view',
  properties: {
    class_name: className,
    class_id: classId,
    class_position: classPosition,
    class_is_free: classIsFree,
    course_name: 'Curso de Fundamentos de JavaScript',
    course_id: 10266,
    drm_protected: false,
  },
});

const fixture = ({
  url = pageUrl,
  heading = 'Instalación y Configuración de JavaScript en Visual Studio Code',
  events = [classEvent()],
  includeVtt = false,
  rawScript = '',
} = {}) => `<!doctype html>
<html><head>
  <link rel="canonical" href="${url}">
  <title>${heading}</title>
</head><body>
  <h1>${heading}</h1>
  <script>${nextFlightScript(...events)}${includeVtt ? materialScript({ classId: events[0].properties.class_id, className: events[0].properties.class_name }) : ''}${rawScript}</script>
</body></html>`;

const fixtureDocument = (options = {}) => {
  const {
    url = pageUrl,
    heading = 'Instalación y Configuración de JavaScript en Visual Studio Code',
    events = [classEvent()],
    includeVtt = false,
    rawScript = '',
  } = options;
  const html = fixture({ url, heading, events, includeVtt, rawScript });
  return {
    title: heading,
    documentElement: { outerHTML: html },
    querySelector(selector) {
      if (selector === 'link[rel="canonical"]') return { href: url };
      if (selector === 'h1') return { textContent: heading };
      return null;
    },
    querySelectorAll(selector) {
      if (selector !== 'script') return [];
      return [{ textContent: `${nextFlightScript(...events)}${includeVtt ? materialScript({ classId: events[0].properties.class_id, className: events[0].properties.class_name }) : ''}${rawScript}` }];
    },
  };
};

test('allows only the current class explicitly marked free', () => {
  const result = inspectPlatziClassAccessDocument(fixtureDocument({
    events: [classEvent({ classIsFree: true })],
  }), pageUrl);

  assert.equal(result.status, ACCESS_STATUS.FREE);
  assert.equal(result.classId, 70442);
  assert.equal(result.classPosition, 2);
  assert.equal(result.courseId, 10266);
  assert.equal(result.className, 'Instalación y Configuración de JavaScript en Visual Studio Code');
  assert.doesNotThrow(() => assertPlatziFreeClassDocument(fixtureDocument({
    events: [classEvent({ classIsFree: true })],
  }), pageUrl));
});

test('rejects a current class marked non-free before any VTT request', async () => {
  const document = fixtureDocument({ includeVtt: true });
  const result = inspectPlatziClassAccessDocument(document, pageUrl);
  assert.equal(result.status, ACCESS_STATUS.NOT_FREE);
  assert.throws(() => assertPlatziFreeClassDocument(document, pageUrl), error => (
    error.code === 'PLATZI_ACCESS_UNVERIFIED' && error.accessStatus === ACCESS_STATUS.NOT_FREE
  ));

  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return { ok: true, status: 200, statusText: 'OK', text: async () => 'WEBVTT' };
  };

  await assert.rejects(
    getVtt('https://static.platzi.com/media/subtitle/class-es.vtt', pageUrl),
    error => error.code === 'PLATZI_ACCESS_UNVERIFIED',
  );
  assert.equal(fetchCalls, 0);
});

test('does not unlock the current class from a related free class object', () => {
  const document = fixtureDocument({
    events: [
      classEvent({ classIsFree: false }),
      classEvent({ classId: 70337, className: 'Fundamentos de JavaScript para Principiantes', classPosition: 1, classIsFree: true }),
    ],
  });

  assert.equal(inspectPlatziClassAccessDocument(document, pageUrl).status, ACCESS_STATUS.NOT_FREE);
  assert.throws(() => assertPlatziFreeClassDocument(document, pageUrl), /acceso/i);
});

test('ignores a T frame whose text contains free event and material arrays', () => {
  const document = fixtureDocument({
    events: [],
    rawScript: textRecordScript(classEvent({ classIsFree: true }), {
      surface: 'course',
      materialInfo: { id: 70442, title: 'Instalación y Configuración de JavaScript en Visual Studio Code', video: { movin: { subtitles: [{ source: 'https://static.platzi.com/media/subtitle/fake.vtt', type: 'captions' }] } } },
    }),
  });

  const result = inspectPlatziClassAccessDocument(document, pageUrl);
  assert.equal(result.status, ACCESS_STATUS.UNKNOWN);
  assert.deepEqual(result.vttUrls || [], []);
});

test('continues with the next framed record immediately after a T frame', () => {
  const document = fixtureDocument({
    events: [],
    rawScript: textRecordScript(classEvent({ classIsFree: true }), {
      surface: 'course',
      materialInfo: { id: 70442, title: 'Instalación y Configuración de JavaScript en Visual Studio Code', video: { movin: { subtitles: [{ source: 'https://static.platzi.com/media/subtitle/fake.vtt', type: 'captions' }] } } },
    }, classEvent({ classIsFree: false })),
  });

  assert.equal(inspectPlatziClassAccessDocument(document, pageUrl).status, ACCESS_STATUS.NOT_FREE);
});

test('ignores non-text Next Flight push payloads', () => {
  const payload = `1:1:${JSON.stringify(['$', '$L32', null, classEvent({ classIsFree: true })])}\n`;
  const document = fixtureDocument({ events: [], rawScript: `self.__next_f.push(${JSON.stringify([3, payload])})` });
  assert.equal(inspectPlatziClassAccessDocument(document, pageUrl).status, ACCESS_STATUS.UNKNOWN);
});

test('fails closed for missing, corrupt, string and mismatched canonical metadata', () => {
  const cases = [
    fixtureDocument({ events: [] }),
    fixtureDocument({ events: [classEvent({ classIsFree: 'true' })] }),
    fixtureDocument({ events: [classEvent({ classIsFree: null })] }),
    fixtureDocument({ events: [classEvent({ classIsFree: true }), classEvent({ classId: 70443 })] }),
    fixtureDocument({
      url: 'https://platzi.com/cursos/javascript/otra-clase/',
      events: [classEvent({ classIsFree: true })],
    }),
  ];

  for (const document of cases) {
    assert.equal(inspectPlatziClassAccessDocument(document, pageUrl).status, ACCESS_STATUS.UNKNOWN);
    assert.throws(() => assertPlatziFreeClassDocument(document, pageUrl), error => (
      error.code === 'PLATZI_ACCESS_UNVERIFIED' && error.accessStatus === ACCESS_STATUS.UNKNOWN
    ));
  }
});

test('getVtt accepts a proof bound to the same free class URL', async () => {
  globalThis.location = { protocol: 'chrome-extension:' };
  globalThis.chrome = { runtime: { id: 'test-extension' } };
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, statusText: 'OK', text: async () => 'WEBVTT\n\n00:00.000 --> 00:01.000\nHello' };
  };
  const proof = assertPlatziFreeClassDocument(fixtureDocument({
    events: [classEvent({ classIsFree: true })],
    includeVtt: true,
  }), pageUrl);

  await getVtt('https://static.platzi.com/media/subtitle/class-es.vtt', pageUrl, null, proof);
  assert.equal(request.options.credentials, 'include');
});
