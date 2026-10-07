import test from 'node:test';
import assert from 'node:assert/strict';
import { clearAppStorage } from '../src/utils/appStorage.js';

test('clears only UPSE-owned storage keys', () => {
  const removed = [];
  const storage = { removeItem: key => removed.push(key) };

  clearAppStorage(storage);

  assert.deepEqual(removed, ['platzi_session', 'platzi_settings']);
});
