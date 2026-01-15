import type { Folder } from '../model/types'
import { apiClient } from '~/shared/api'

export const folderApi = {
  async getFolders(parentId: number | null = null): Promise<Folder[]> {
    return apiClient.get<Folder[]>('/api/folders', {
      params: { parent_id: parentId },
    })
  },

  async getAllFolders(): Promise<Folder[]> {
    return apiClient.get<Folder[]>('/api/folders/all')
  },

  async createFolder(name: string, parentId: number | null = null): Promise<Folder> {
    return apiClient.post<Folder>('/api/folders', {
      name,
      parent_id: parentId,
    })
  },

  async updateFolder(id: number, name: string): Promise<Folder> {
    return apiClient.put<Folder>(`/api/folders/${id}`, { name })
  },

  async deleteFolder(id: number): Promise<void> {
    return apiClient.delete(`/api/folders/${id}`)
  },
}
