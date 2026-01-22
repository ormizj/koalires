import { defineStore } from 'pinia';
import type { User } from '~/entities/user';

interface AuthState {
  user: User | null;
  jwt: string;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    jwt: '',
  }),

  getters: {
    isAuthenticated: (state) => !!state.jwt,
    token: (state) => state.jwt, // backward compatibility alias
  },

  actions: {
    async login(email: string, password: string) {
      const response = await $fetch<{
        token: string;
        user: User;
      }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      this._setAuth(response.user, response.token);
      return response;
    },

    async register(email: string, password: string) {
      const response = await $fetch<{
        token: string;
        user: User;
      }>('/api/auth/register', {
        method: 'POST',
        body: { email, password },
      });
      this._setAuth(response.user, response.token);
      return response;
    },

    async logout() {
      await $fetch('/api/auth/logout', { method: 'DELETE' });
      this._clearAuth();
    },

    async fetchUser() {
      if (!this.jwt) return;
      try {
        const user = await $fetch<User>('/api/auth/me');
        this.user = user;
      } catch {
        this._clearAuth();
      }
    },

    _setAuth(user: User, jwt: string) {
      this.user = user;
      this.jwt = jwt;
      localStorage.setItem('jwt', jwt);
      localStorage.setItem('user', JSON.stringify(user));
      // Clean up old keys
      localStorage.removeItem('email');
      localStorage.removeItem('userId');
    },

    _clearAuth() {
      this.user = null;
      this.jwt = '';
      localStorage.removeItem('jwt');
      localStorage.removeItem('user');
      // Clean up old keys
      localStorage.removeItem('email');
      localStorage.removeItem('userId');
    },

    async _init() {
      // Migrate legacy 'token' key to 'jwt'
      const legacyToken = localStorage.getItem('token');
      if (legacyToken && !localStorage.getItem('jwt')) {
        localStorage.setItem('jwt', legacyToken);
        localStorage.removeItem('token');
      }

      this.jwt = localStorage.getItem('jwt') ?? '';
      const userJson = localStorage.getItem('user');
      this.user = userJson ? JSON.parse(userJson) : null;

      if (!this.jwt) return;

      try {
        const res = await $fetch<{ userId: number; email: string }>(
          '/api/auth/jwt-data'
        );
        // Fix: compare emails case-insensitively
        if (res.email.toLowerCase() !== this.user?.email?.toLowerCase()) {
          this._clearAuth();
        }
      } catch {
        this._clearAuth();
      }
    },
  },
});
