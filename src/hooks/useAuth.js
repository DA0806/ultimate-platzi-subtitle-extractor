import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { loginWithCredentials } from '../utils/platziAuth';

export const useAuth = () => {
  const loginFn = useAuthStore(state => state.login);
  const logoutFn = useAuthStore(state => state.logout);

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }) => {
      return await loginWithCredentials(email, password);
    },
    onSuccess: (data) => {
      loginFn(data.token, data.cookie, data.user);
    }
  });

  const loginWithCookie = (cookieStr) => {
    // Saving a cookie locally does not prove that the session is active.
    loginFn(null, cookieStr, null);
  };

  return {
    login: loginMutation.mutateAsync,
    loginWithCookie,
    logout: logoutFn,
    isLoading: loginMutation.isPending,
    error: loginMutation.error
  };
};
