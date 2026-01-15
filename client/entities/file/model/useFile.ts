import type { File } from './types';
import { fileApi } from '../api/fileApi';

const files = ref<File[]>([]);
const selectedFile = ref<File | null>(null);

export function useFile() {
  async function loadFiles(folderId: number | null = null) {
    files.value = await fileApi.getFiles(folderId);
  }

  async function createFile(name: string, folderId: number | null = null) {
    await fileApi.createFile(name, folderId);
    await loadFiles(folderId);
  }

  async function updateFile(id: number, content: string) {
    await fileApi.updateFile(id, content);
    if (selectedFile.value && selectedFile.value.id === id) {
      selectedFile.value.content = content;
    }
  }

  async function deleteFile(id: number, folderId: number | null = null) {
    await fileApi.deleteFile(id);
    if (selectedFile.value?.id === id) {
      selectedFile.value = null;
    }
    await loadFiles(folderId);
  }

  function selectFile(file: File) {
    selectedFile.value = file;
  }

  function closeFile() {
    selectedFile.value = null;
  }

  return {
    files: readonly(files),
    selectedFile,
    loadFiles,
    createFile,
    updateFile,
    deleteFile,
    selectFile,
    closeFile,
  };
}
