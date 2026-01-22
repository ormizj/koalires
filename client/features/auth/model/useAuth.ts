import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/shared/stores';

export function useAuth() {
  const router = useRouter();
  const authStore = useAuthStore();
  const { user, token, isAuthenticated, shouldShowHeader } =
    storeToRefs(authStore);

  async function login(email: string, password: string) {
    await authStore.login(email, password);
  }

  async function register(email: string, password: string) {
    await authStore.register(email, password);
  }

  async function logout() {
    await authStore.logout();
    void router.push('/login');
  }

  async function fetchUser() {
    await authStore.fetchUser();
  }

  // No-op for backward compatibility
  function initFromStorage() {}

  return {
    user,
    token,
    isAuthenticated,
    shouldShowHeader,
    initFromStorage,
    login,
    register,
    logout,
    fetchUser,
  };
}
