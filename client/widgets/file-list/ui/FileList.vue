<script setup lang="ts">
import type { Folder } from '~/entities/folder'
import type { File } from '~/entities/file'

defineProps<{
  folders: Folder[]
  files: File[]
}>()

const emit = defineEmits<{
  openFolder: [id: number]
  openFile: [file: File]
  deleteFolder: [id: number]
  deleteFile: [id: number]
}>()

function confirmDeleteFolder(id: number, name: string) {
  if (confirm(`Delete folder "${name}" and all its contents?`)) {
    emit('deleteFolder', id)
  }
}

function confirmDeleteFile(id: number, name: string) {
  if (confirm(`Delete file "${name}"?`)) {
    emit('deleteFile', id)
  }
}
</script>

<template>
  <div class="p-4">
    <div v-if="folders.length === 0 && files.length === 0" class="text-content-muted text-center py-8">
      This folder is empty
    </div>

    <div v-else class="space-y-1">
      <div
        v-for="folder in folders"
        :key="'folder-' + folder.id"
        class="flex items-center gap-3 px-3 py-2 hover:bg-surface-secondary rounded cursor-pointer group"
        @click="emit('openFolder', folder.id)"
      >
        <svg class="w-5 h-5 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-8l-2-2z" />
        </svg>
        <span class="flex-1 truncate text-content">{{ folder.name }}</span>
        <button
          @click.stop="confirmDeleteFolder(folder.id, folder.name)"
          class="p-1 text-content-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div
        v-for="file in files"
        :key="'file-' + file.id"
        class="flex items-center gap-3 px-3 py-2 hover:bg-surface-secondary rounded cursor-pointer group"
        @click="emit('openFile', file)"
      >
        <svg class="w-5 h-5 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span class="flex-1 truncate text-content">{{ file.name }}</span>
        <button
          @click.stop="confirmDeleteFile(file.id, file.name)"
          class="p-1 text-content-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
