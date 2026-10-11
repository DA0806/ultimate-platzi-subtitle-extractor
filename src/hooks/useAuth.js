import { useAuthStore } from '../store/authStore.js';
import { defaultAuthorizationService } from '../utils/authorizationService.js';

export const recheckSession = () => {
  if (useAuthStore.getState().isVerifying) return null;
  try {
    return defaultAuthorizationService.adapter.checkSession();
  } catch {
    return null;
  }
};

export const useAuth = () => {
  const sessionStatus = useAuthStore(state => state.sessionStatus);
  const isVerifying = useAuthStore(state => state.isVerifying);
  const lastDiagnostic = useAuthStore(state => state.lastDiagnostic);
  const invalidateSession = useAuthStore(state => state.invalidateSession);
  const logout = useAuthStore(state => state.logout);

  return {
    sessionStatus,
    isVerifying,
    lastDiagnostic,
    recheckSession,
    invalidateSession,
    logout,
  };
};
