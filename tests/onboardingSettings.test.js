import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
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
