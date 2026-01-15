import type { User } from '~/entities/user';

interface AuthResponse {
  token: string;
  user: User;
}

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    return $fetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  },

  async register(email: string, password: string): Promise<AuthResponse> {
    return $fetch<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: { email, password },
    });
  },
};
