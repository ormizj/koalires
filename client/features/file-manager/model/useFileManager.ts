import { useFolder } from '~/entities/folder';
import { useFile } from '~/entities/file';

export function useFileManager() {
  const {
    currentFolderId,
    folders,
    allFolders,
    loadFolders,
    loadAllFolders,
    createFolder,
    deleteFolder,
    buildFolderTree,
  } = useFolder();

  const {
    files,
    selectedFile,
    loadFiles,
    createFile,
    updateFile,
    deleteFile,
    selectFile,
    closeFile,
  } = useFile();

  async function loadContents(folderId: number | null = null) {
    await Promise.all([loadFolders(folderId), loadFiles(folderId)]);
  }

  async function navigateToFolder(id: number | null) {
    closeFile();
    await loadContents(id);
  }

  async function handleCreateFolder(name: string) {
    await createFolder(name);
  }

  async function handleCreateFile(name: string) {
    await createFile(name, currentFolderId.value);
  }

  async function handleDeleteFolder(id: number) {
    await deleteFolder(id);
  }

  async function handleDeleteFile(id: number) {
    await deleteFile(id, currentFolderId.value);
  }

  async function handleUpdateFile(id: number, content: string) {
    await updateFile(id, content);
  }

  function getBreadcrumbs() {
    if (currentFolderId.value === null) return [];

    const crumbs: { id: number | null; name: string }[] = [];
    let current = allFolders.value.find((f) => f.id === currentFolderId.value);

    while (current) {
      crumbs.unshift({ id: current.id, name: current.name });
      current = current.parentId
        ? allFolders.value.find((f) => f.id === current!.parentId)
        : undefined;
    }

    return crumbs;
  }

  return {
    currentFolderId,
    folders,
    files,
    selectedFile,
    allFolders,
    loadContents,
    loadAllFolders,
    navigateToFolder,
    createFolder: handleCreateFolder,
    createFile: handleCreateFile,
    deleteFolder: handleDeleteFolder,
    deleteFile: handleDeleteFile,
    updateFile: handleUpdateFile,
    selectFile,
    closeFile,
    getBreadcrumbs,
    buildFolderTree,
  };
}
