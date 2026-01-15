import { defineStore } from 'pinia';

interface AuthState {
  email: string;
  jwt: string;
  userId: number | null;
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    email: '',
    jwt: '',
    userId: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.jwt,
  },

  actions: {
    async login(email: string, password: string) {
      const response = await $fetch<{
        token: string;
        user: { id: number; email: string };
      }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      this._clientLogin(response.user.email, response.token, response.user.id);
      return response;
    },

    async register(email: string, password: string) {
      const response = await $fetch<{
        token: string;
        user: { id: number; email: string };
      }>('/api/auth/register', {
        method: 'POST',
        body: { email, password },
      });
      this._clientLogin(response.user.email, response.token, response.user.id);
      return response;
    },

    async logout() {
      await $fetch('/api/auth/logout', { method: 'DELETE' });
      this._clientLogout();
    },

    _clientLogin(email: string, jwt: string, userId: number) {
      localStorage.setItem('jwt', jwt);
      localStorage.setItem('email', email.toLowerCase());
      localStorage.setItem('userId', String(userId));
      this.jwt = jwt;
      this.email = email.toLowerCase();
      this.userId = userId;
    },

    _clientLogout() {
      localStorage.removeItem('jwt');
      localStorage.removeItem('email');
      localStorage.removeItem('userId');
      this.jwt = '';
      this.email = '';
      this.userId = null;
    },

    async _init() {
      this.jwt = localStorage.getItem('jwt') ?? '';
      this.email = localStorage.getItem('email') ?? '';
      this.userId = Number(localStorage.getItem('userId')) || null;

      if (!this.jwt) return;

      try {
        const res = await $fetch<{ userId: number; email: string }>(
          '/api/auth/jwt-data'
        );
        if (res.email !== this.email) {
          this._clientLogout();
        }
      } catch {
        this._clientLogout();
      }
    },
  },
});
