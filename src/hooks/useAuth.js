import { useAuthStore } from '../store/authStore';
import { defaultAuthorizationService } from '../utils/authorizationService.js';

export const useAuth = () => {
  const sessionStatus = useAuthStore(state => state.sessionStatus);
  const setSessionStatus = useAuthStore(state => state.setSessionStatus);
  const invalidateSession = useAuthStore(state => state.invalidateSession);
  const logout = useAuthStore(state => state.logout);

  const recheckSession = async () => {
    try {
      const result = await defaultAuthorizationService.adapter.checkSession();
      if (result?.status === 'verified' && result.authenticated === true && result.accountId && Number.isInteger(result.sessionEpoch) && Number.isFinite(result.expiresAt) && result.expiresAt > Date.now() && result.sessionEpoch === useAuthStore.getState().sessionEpoch) {
        setSessionStatus('authenticated');
        return result;
      }
      invalidateSession();
      return result;
    } catch {
      invalidateSession();
      return null;
    }
  };

  return {
    sessionStatus,
    recheckSession,
    invalidateSession,
    logout,
  };
};
