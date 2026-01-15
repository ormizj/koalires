import type { User } from './types';
import { userApi } from '../api/userApi';

const user = ref<User | null>(null);
const token = ref<string | null>(null);

export function useUser() {
  const isAuthenticated = computed(() => !!token.value && !!user.value);

  function setUser(newUser: User | null) {
    user.value = newUser;
  }

  function setToken(newToken: string | null) {
    token.value = newToken;
    if (import.meta.client) {
      if (newToken) {
        localStorage.setItem('token', newToken);
      } else {
        localStorage.removeItem('token');
      }
    }
  }

  function initFromStorage() {
    if (import.meta.client) {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        token.value = storedToken;
      }
    }
  }

  function clearUser() {
    user.value = null;
    token.value = null;
    if (import.meta.client) {
      localStorage.removeItem('token');
    }
  }

  async function fetchUser() {
    if (!token.value) return;

    try {
      const response = await userApi.fetchCurrentUser();
      user.value = response;
    } catch {
      clearUser();
    }
  }

  return {
    user: readonly(user),
    token: readonly(token),
    isAuthenticated,
    setUser,
    setToken,
    initFromStorage,
    clearUser,
    fetchUser,
  };
}
