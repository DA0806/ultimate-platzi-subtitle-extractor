import test from 'node:test';
import assert from 'node:assert/strict';

test('downloadZip revalidates after deferred generation and never saves revoked content', async () => {
  const fileSaver = (await import('file-saver')).default;
  const JSZip = (await import('jszip')).default;
  const { useAuthStore } = await import('../src/store/authStore.js');
  const { defaultAuthorizationService } = await import('../src/utils/authorizationService.js');
  const { downloadZip } = await import(`../src/utils/downloader.js?zip-gate-${Date.now()}`);

  const originalSaveAs = fileSaver.saveAs;
  const originalGenerateAsync = JSZip.prototype.generateAsync;
  const originalAdapter = defaultAuthorizationService.adapter;
  let saves = 0;

  const identity = {
    courseId: 10,
    classId: 20,
    canonicalUrl: 'https://platzi.com/cursos/curso/clase/',
  };
  const result = () => ({
    status: 'verified',
    authenticated: true,
    canView: true,
    canExport: true,
    accountId: 'account-a',
    sessionEpoch: useAuthStore.getState().sessionEpoch,
    expiresAt: Date.now() + 60_000,
    ...identity,
  });

  fileSaver.saveAs = () => { saves += 1; };
  defaultAuthorizationService.adapter = {
    async checkSession() { return result(); },
    async checkClassAccess() { return result(); },
    async checkExportPermission() { return result(); },
  };
  useAuthStore.setState({ sessionEpoch: 0, sessionStatus: 'authenticated' });
  JSZip.prototype.generateAsync = async function generateAsync() {
    useAuthStore.getState().invalidateSession();
    return new Blob(['zip']);
  };

  try {
    await assert.rejects(
      downloadZip([{
        status: 'no-video',
        slug: 'clase',
        title: 'Clase',
        authorizationProof: {
          identity,
          classId: identity.classId,
          courseId: identity.courseId,
          canonicalUrl: identity.canonicalUrl,
          sessionAccount: 'account-a',
          sessionEpoch: 0,
          expiresAt: Date.now() + 60_000,
          capabilities: { verified: true },
          authorizedVttUrls: [],
        },
      }], 'es', 'curso'),
      error => error.code === 'SESSION_INVALIDATED_CANNOT_EXPORT',
    );
    assert.equal(saves, 0);
  } finally {
    fileSaver.saveAs = originalSaveAs;
    JSZip.prototype.generateAsync = originalGenerateAsync;
    defaultAuthorizationService.adapter = originalAdapter;
  }
});
