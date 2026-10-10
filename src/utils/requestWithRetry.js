const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryableError = (error) => {
  const status = error?.response?.status || error?.status;
  return !status || [408, 425, 429, 500, 502, 503, 504].includes(status);
};

const getRetryDelay = (error, attempt) => {
  const retryAfter = error?.response?.headers?.['retry-after']
    || error?.response?.headers?.get?.('retry-after')
    || error?.retryAfter;
  const retryAfterSeconds = Number(retryAfter);
  if (Number.isFinite(retryAfterSeconds)) {
    return Math.min(retryAfterSeconds * 1000, 30_000);
  }
  return 500 * (2 ** attempt);
};

export const requestWithRetry = async (requestFn, beforeRequest, retries = 2) => {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await beforeRequest?.();
      return await requestFn();
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetryableError(error)) {
        break;
      }
      await sleep(getRetryDelay(error, attempt));
    }
  }
  throw lastError;
};
