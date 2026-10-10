import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { translate } from '../src/i18n.js';

const originalChrome = globalThis.chrome;
const originalLocation = globalThis.location;

afterEach(() => {
  globalThis.chrome = originalChrome;
  globalThis.location = originalLocation;
});

test('i18n translations include all setup extraction and settings keys in ES and EN', () => {
  const keys = [
    'setup.extraction',
    'setup.extStep3Eyebrow',
    'setup.extStep3Title',
    'setup.extStep3Description',
    'setup.stepOpenPlatzi',
    'setup.stepOpenPlatziDesc',
    'setup.openPlatzi',
    'setup.stepCopyUrl',
    'setup.stepCopyUrlDesc',
    'setup.stepPasteUrl',
    'setup.stepPasteUrlDesc',
    'setup.extAccessNote',
    'setup.enterWorkspace',
    'settings.eyebrow',
    'settings.title',
    'settings.close',
    'settings.generalGroup',
    'settings.theme',
    'settings.themeDark',
    'settings.themeLight',
    'settings.platziGroup',
    'settings.extAccessTitle',
    'settings.extAccessDesc',
    'settings.storageGroup',
    'settings.storageDesc',
    'settings.clearStorage',
    'settings.clearConfirm',
    'session.extensionMode',
    'session.extensionTitle',
    'header.openSettings',
    'header.closeSettings',
    'extractionNotice.sessionInvalidated',
    'extractionNotice.premiumTemporarilyBlocked',
    'extractionNotice.requiresExportConsent',
    'setup.consentPublicExportCheckbox',
    'session.unknown',
    'session.unauthenticated',
    'session.authenticated',
    'session.recheck',
    'session.openPlatzi',
    'session.checkNotice',
  ];

  for (const key of keys) {
    const esText = translate(key, {}, 'es');
    const enText = translate(key, {}, 'en');
    assert.notEqual(esText, key, `Missing Spanish translation for ${key}`);
    assert.notEqual(enText, key, `Missing English translation for ${key}`);
    assert.ok(esText.length > 0);
    assert.ok(enText.length > 0);
  }
});

test('regression: legacy copied-cookie keys and routes are purged', () => {
  const obsoleteKeys = [
    'setup.cookie',
    'setup.cookieEyebrow',
    'setup.cookieTitle',
    'setup.cookieDescription',
    'tutorial.copyCookie',
    'tutorial.copyCookieDescription',
    'tutorial.openPlatzi',
    'auth.savedCookie',
    'auth.savedCookieTitle',
    'auth.pasteCookieDescription',
    'auth.cookieLabel',
    'auth.cookiePlaceholder',
    'auth.saveCookie',
    'auth.editCookie',
    'auth.invalidCookie',
    'auth.freeOnly',
    'session.savedTitle',
    'session.saved',
  ];

  for (const key of obsoleteKeys) {
    assert.equal(translate(key, {}, 'es'), key, `Key ${key} should not exist in Spanish i18n`);
    assert.equal(translate(key, {}, 'en'), key, `Key ${key} should not exist in English i18n`);
  }

  // Verify that CookieTutorial component file is deleted
  const tutorialPath = path.resolve('src/components/CookieTutorial.jsx');
  assert.equal(fs.existsSync(tutorialPath), false, 'CookieTutorial.jsx should be removed');

  // Verify App.jsx has no CookieTutorial or cookie tutorial hash
  const appCode = fs.readFileSync(path.resolve('src/App.jsx'), 'utf8');
  assert.equal(appCode.includes('CookieTutorial'), false, 'App.jsx must not reference CookieTutorial');
  assert.equal(appCode.includes('cookie-tutorial'), false, 'App.jsx must not reference cookie-tutorial hash');
});
