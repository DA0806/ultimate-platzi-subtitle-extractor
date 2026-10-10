import { useAuthStore } from '../store/authStore.js';
import { defaultAuthorizationService } from '../utils/authorizationService.js';

export const recheckSession = async () => {
  const startEpoch = useAuthStore.getState().sessionEpoch;
  try {
    const result = await defaultAuthorizationService.adapter.checkSession();
    // The adapter owns latest-observation detection, epoch ordering, and state disposition.
    // Hook delegates state updates to the adapter and discards stale outcomes without writes.
    return result;
  } catch {
    if (useAuthStore.getState().sessionEpoch === startEpoch) {
      useAuthStore.getState().setSessionStatus('unknown');
    }
    return null;
  }
};

export const useAuth = () => {
  const sessionStatus = useAuthStore(state => state.sessionStatus);
  const invalidateSession = useAuthStore(state => state.invalidateSession);
  const logout = useAuthStore(state => state.logout);

  return {
    sessionStatus,
    recheckSession,
    invalidateSession,
    logout,
  };
};
