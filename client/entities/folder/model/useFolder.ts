import type { Folder } from './types'
import { folderApi } from '../api/folderApi'

const currentFolderId = ref<number | null>(null)
const folders = ref<Folder[]>([])
const allFolders = ref<Folder[]>([])

export function useFolder() {
  function setCurrentFolderId(id: number | null) {
    currentFolderId.value = id
  }

  async function loadFolders(parentId: number | null = null) {
    currentFolderId.value = parentId
    folders.value = await folderApi.getFolders(parentId)
  }

  async function loadAllFolders() {
    allFolders.value = await folderApi.getAllFolders()
  }

  async function createFolder(name: string) {
    await folderApi.createFolder(name, currentFolderId.value)
    await loadFolders(currentFolderId.value)
    await loadAllFolders()
  }

  async function deleteFolder(id: number) {
    await folderApi.deleteFolder(id)
    await loadFolders(currentFolderId.value)
    await loadAllFolders()
  }

  function buildFolderTree(folderList: Folder[]): Folder[] {
    const map = new Map<number, Folder>()
    const roots: Folder[] = []

    folderList.forEach((f) => {
      map.set(f.id, { ...f, children: [] })
    })

    folderList.forEach((f) => {
      const node = map.get(f.id)!
      if (f.parentId === null) {
        roots.push(node)
      }
      else {
        const parent = map.get(f.parentId)
        if (parent) {
          parent.children = parent.children || []
          parent.children.push(node)
        }
        else {
          roots.push(node)
        }
      }
    })

    return roots
  }

  return {
    currentFolderId: readonly(currentFolderId),
    folders: readonly(folders),
    allFolders: readonly(allFolders),
    setCurrentFolderId,
    loadFolders,
    loadAllFolders,
    createFolder,
    deleteFolder,
    buildFolderTree,
  }
}
