export const isTrustedPlayerMessageSender = (sender, runtime) => {
  if (!sender || !runtime?.id || typeof runtime.getURL !== 'function') return false;
  const senderUrl = sender.url || sender.documentUrl;
  if (sender.id !== runtime.id || typeof senderUrl !== 'string') return false;
  try {
    const actual = new URL(senderUrl);
    const expected = new URL(runtime.getURL('index.html'));
    return actual.protocol === expected.protocol && actual.host === expected.host && actual.pathname === expected.pathname && !actual.search && !actual.hash;
  } catch {
    return false;
  }
};
