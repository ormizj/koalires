import type { File } from '../model/types';
import { apiClient } from '~/shared/api';

export const fileApi = {
  async getFiles(folderId: number | null = null): Promise<File[]> {
    return apiClient.get<File[]>('/api/files', {
      params: { folder_id: folderId },
    });
  },

  async getFile(id: number): Promise<File> {
    return apiClient.get<File>(`/api/files/${id}`);
  },

  async createFile(
    name: string,
    folderId: number | null = null
  ): Promise<File> {
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    return apiClient.post<File>('/api/files', {
      name: fileName,
      folder_id: folderId,
    });
  },

  async updateFile(id: number, content: string): Promise<File> {
    return apiClient.put<File>(`/api/files/${id}`, { content });
  },

  async deleteFile(id: number): Promise<void> {
    return apiClient.delete(`/api/files/${id}`);
  },
};
