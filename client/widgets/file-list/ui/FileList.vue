<script setup lang="ts">
import type { Folder } from '~/entities/folder';
import type { File } from '~/entities/file';

defineProps<{
  folders: Folder[];
  files: File[];
}>();

const emit = defineEmits<{
  openFolder: [id: number];
  openFile: [file: File];
  deleteFolder: [id: number];
  deleteFile: [id: number];
}>();

function confirmDeleteFolder(id: number, name: string) {
  if (confirm(`Delete folder "${name}" and all its contents?`)) {
    emit('deleteFolder', id);
  }
}

function confirmDeleteFile(id: number, name: string) {
  if (confirm(`Delete file "${name}"?`)) {
    emit('deleteFile', id);
  }
}
</script>

<template>
  <div class="p-4">
    <div
      v-if="folders.length === 0 && files.length === 0"
      class="text-content-muted text-center py-8"
    >
      This folder is empty
    </div>

    <div v-else class="space-y-1">
      <div
        v-for="folder in folders"
        :key="'folder-' + folder.id"
        class="flex items-center gap-3 px-3 py-2 hover:bg-surface-secondary rounded cursor-pointer group"
        @click="emit('openFolder', folder.id)"
      >
        <Icon
          name="heroicons:folder-solid"
          class="w-5 h-5 text-yellow-500 flex-shrink-0"
        />
        <span class="flex-1 truncate text-content">{{ folder.name }}</span>
        <button
          class="p-1 text-content-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop="confirmDeleteFolder(folder.id, folder.name)"
        >
          <Icon name="heroicons:trash" class="w-4 h-4" />
        </button>
      </div>

      <div
        v-for="file in files"
        :key="'file-' + file.id"
        class="flex items-center gap-3 px-3 py-2 hover:bg-surface-secondary rounded cursor-pointer group"
        @click="emit('openFile', file)"
      >
        <Icon
          name="heroicons:document-text"
          class="w-5 h-5 text-primary flex-shrink-0"
        />
        <span class="flex-1 truncate text-content">{{ file.name }}</span>
        <button
          class="p-1 text-content-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop="confirmDeleteFile(file.id, file.name)"
        >
          <Icon name="heroicons:trash" class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>
