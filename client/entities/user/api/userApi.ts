import type { User } from '../model/types';
import { apiClient } from '~/shared/api';

export const userApi = {
  async fetchCurrentUser(): Promise<User> {
    return apiClient.get<User>('/api/auth/me');
  },
};
