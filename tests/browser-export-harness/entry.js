import { useAuthStore } from '/src/store/authStore.js';
import { useSubtitleStore } from '/src/store/subtitleStore.js';
import { defaultAuthorizationService } from '/src/utils/authorizationService.js';
import { getClassRevision, revokeProof } from '/src/utils/platziAccess.js';
import { parseVtt } from '/src/utils/vttParser.js';
import { copyMergedTxt, downloadVideoTxt, downloadMergedTxt, downloadZip } from '/src/utils/downloader.js';

const runId = `harness-${Date.now()}`;
const identity = Object.freeze({
  courseId: 9101,
  classId: 9201,
  canonicalUrl: 'https://platzi.com/cursos/upse-harness/fixture/',
});
const statusNode = document.querySelector('#status');
document.querySelector('#run-id').textContent = runId;

const proofFor = id => ({
  proofId: `${runId}-${id}`,
  ...identity,
  sessionAccount: 'harness-account',
  sessionEpoch: 0,
  classRevision: getClassRevision('harness-account', 0, identity.canonicalUrl),
  expiresAt: Date.now() + 600_000,
  authorizedVttUrls: [`https://static.platzi.com/${id}.vtt`],
  capabilities: {
    verified: true,
    authenticated: true,
    canView: true,
    canExport: true,
    canExportSubtitles: true,
    accountId: 'harness-account',
    sessionEpoch: 0,
    ...identity,
    expiresAt: Date.now() + 600_000,
  },
});

const loadFixture = async name => parseVtt(await fetch(`/tests/browser-export-harness/fixtures/${name}.vtt`).then(response => {
  if (!response.ok) throw new Error(`fixture ${name} HTTP ${response.status}`);
  return response.text();
}));

const [firstText, secondText] = await Promise.all([loadFixture('primera'), loadFixture('segunda')]);
const videos = [
  {
    id: 'fixture-1', slug: 'primera', title: 'Primera', url: identity.canonicalUrl,
    status: 'ready', selected: true, extractedContent: { es: firstText }, authorizationProof: proofFor('primera'),
  },
  {
    id: 'fixture-2', slug: 'segunda', title: 'Segunda', url: identity.canonicalUrl,
    status: 'ready', selected: true, extractedContent: { es: secondText }, authorizationProof: proofFor('segunda'),
  },
];

const simulatedAdapter = {
  async checkSession() {
    return { status: 'verified', authenticated: true, accountId: 'harness-account', sessionEpoch: 0, expiresAt: Date.now() + 600_000 };
  },
  async checkClassAccess() {
    return { status: 'verified', canView: true, accountId: 'harness-account', sessionEpoch: 0, ...identity, expiresAt: Date.now() + 600_000 };
  },
  async checkExportPermission() {
    return { status: 'verified', canExport: true, accountId: 'harness-account', sessionEpoch: 0, ...identity, expiresAt: Date.now() + 600_000 };
  },
};

defaultAuthorizationService.adapter = simulatedAdapter;
useAuthStore.setState({ sessionStatus: 'authenticated', sessionEpoch: 0 });
useSubtitleStore.setState({ videos });

const run = async (label, operation, successStatus = 'initiated') => {
  statusNode.textContent = `${label}: running`;
  try {
    await operation();
    statusNode.textContent = `${label}: ${successStatus}`;
  } catch (error) {
    statusNode.textContent = `${label}: failed (${error.code || 'UNKNOWN'})`;
  }
};

document.querySelector('#individual').onclick = () => run('individual TXT', () => downloadVideoTxt(videos[0], 'es', runId, 0));
document.querySelector('#merged').onclick = () => run('combined TXT', () => downloadMergedTxt(videos, 'es', runId));
document.querySelector('#zip').onclick = () => run('ZIP', () => downloadZip(videos, 'es', runId));
document.querySelector('#clipboard').onclick = () => run('clipboard', () => copyMergedTxt(videos, 'es'), 'complete');

globalThis.__UPSE_EXPORT_HARNESS__ = Object.freeze({
  runId,
  fixtureMarker: 'UPSE browser harness synthetic fixtures',
  videos,
  revokeFirstProof: () => revokeProof(videos[0].authorizationProof.proofId, 600_000),
  currentStatus: () => statusNode.textContent,
});

statusNode.textContent = 'Ready: synthetic fixtures loaded (AUTH_SIMULATED).';
