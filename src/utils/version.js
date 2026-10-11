export const APP_VERSION = '1.0.9';

const readManifestVersion = () => {
  if (typeof globalThis.chrome !== 'undefined' && typeof globalThis.chrome?.runtime?.getManifest === 'function') {
    try {
      const manifestVersion = globalThis.chrome.runtime.getManifest()?.version;
      if (typeof manifestVersion === 'string' && /^\d+\.\d+\.\d+$/.test(manifestVersion)) {
        return manifestVersion;
      }
    } catch {
      // Keep the code version when the runtime manifest is unavailable.
    }
  }
  return null;
};

export const getVersionInfo = () => Object.freeze({
  codeVersion: APP_VERSION,
  manifestVersion: readManifestVersion(),
});

export const getRuntimeVersion = () => getVersionInfo().manifestVersion || APP_VERSION;
