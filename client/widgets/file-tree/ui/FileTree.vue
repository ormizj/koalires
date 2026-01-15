<script setup lang="ts">
import type { Folder } from '~/entities/folder'
import FileTreeItem from './FileTreeItem.vue'

const props = defineProps<{
  folders: Folder[]
  currentFolderId: number | null
}>()

const emit = defineEmits<{
  selectFolder: [id: number | null]
}>()

const expandedFolders = ref<Set<number>>(new Set())

function toggleExpand(id: number) {
  if (expandedFolders.value.has(id)) {
    expandedFolders.value.delete(id)
  } else {
    expandedFolders.value.add(id)
  }
}

function buildTree(folders: Folder[]): Folder[] {
  const map = new Map<number, Folder>()
  const roots: Folder[] = []

  folders.forEach(f => {
    map.set(f.id, { ...f, children: [] })
  })

  folders.forEach(f => {
    const node = map.get(f.id)!
    if (f.parentId === null) {
      roots.push(node)
    } else {
      const parent = map.get(f.parentId)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    }
  })

  return roots
}
</script>

<template>
  <div class="py-2">
    <button
      @click="emit('selectFolder', null)"
      class="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-surface-secondary rounded transition-colors"
      :class="{ 'bg-primary-soft text-primary': currentFolderId === null }"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
      <span class="font-medium">Root</span>
    </button>

    <FileTreeItem
      v-for="folder in buildTree(folders)"
      :key="folder.id"
      :folder="folder"
      :current-folder-id="currentFolderId"
      :expanded-folders="expandedFolders"
      :depth="0"
      @select-folder="emit('selectFolder', $event)"
      @toggle-expand="toggleExpand"
    />
  </div>
</template>
