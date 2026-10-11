export const getSessionValidityDeadline = (session) => {
  if (!session) return 0;
  const candidates = [];
  if (Number.isFinite(session.validUntil)) candidates.push(session.validUntil);
  if (Number.isFinite(session.expiresAt)) candidates.push(session.expiresAt);
  if (Number.isFinite(session.sessionExpiresAt)) candidates.push(session.sessionExpiresAt);
  return candidates.length > 0 ? Math.min(...candidates) : 0;
};
