export const copyDiagnosticReport = async (report, clipboard = globalThis.navigator?.clipboard) => {
  if (typeof report !== 'string' || report.length === 0 || typeof clipboard?.writeText !== 'function') {
    return { status: 'unavailable' };
  }

  try {
    await clipboard.writeText(report);
    return { status: 'copied' };
  } catch {
    return { status: 'unavailable' };
  }
};
