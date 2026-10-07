export const APP_STORAGE_KEYS = ['platzi_session', 'platzi_settings'];

export const clearAppStorage = (storage = globalThis.localStorage) => {
  if (!storage?.removeItem) return;
  APP_STORAGE_KEYS.forEach(key => storage.removeItem(key));
};
