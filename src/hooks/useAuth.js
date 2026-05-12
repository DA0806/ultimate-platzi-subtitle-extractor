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
    // Generate a mock user based on cookie presence
    loginFn('mock_token_from_cookie', cookieStr, {
      name: 'User (Cookie)',
      email: 'cookie@user.com',
      avatar: `https://ui-avatars.com/api/?name=C&background=98EC2D&color=0f0f0f`,
      plan: 'Pro'
    });
  };

  return {
    login: loginMutation.mutateAsync,
    loginWithCookie,
    logout: logoutFn,
    isLoading: loginMutation.isPending,
    error: loginMutation.error
  };
};
