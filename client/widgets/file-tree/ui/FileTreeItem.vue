<script setup lang="ts">
import type { Folder } from '~/entities/folder';

const props = defineProps<{
  folder: Folder;
  currentFolderId: number | null;
  expandedFolders: Set<number>;
  depth: number;
}>();

const emit = defineEmits<{
  selectFolder: [id: number];
  toggleExpand: [id: number];
}>();

const hasChildren = computed(
  () => props.folder.children && props.folder.children.length > 0
);
const isExpanded = computed(() => props.expandedFolders.has(props.folder.id));
const isSelected = computed(() => props.currentFolderId === props.folder.id);
</script>

<template>
  <div>
    <div
      class="flex items-center gap-1 px-2 py-1.5 hover:bg-surface-secondary rounded cursor-pointer transition-colors"
      :class="{ 'bg-primary-soft text-primary': isSelected }"
      :style="{ paddingLeft: `${depth * 16 + 8}px` }"
    >
      <button
        v-if="hasChildren"
        class="p-0.5 hover:bg-surface-secondary rounded"
        @click.stop="emit('toggleExpand', folder.id)"
      >
        <Icon
          name="heroicons:chevron-right"
          class="w-4 h-4 transition-transform"
          :class="{ 'rotate-90': isExpanded }"
        />
      </button>
      <span v-else class="w-5" />

      <button
        class="flex items-center gap-2 flex-1 text-left"
        @click="emit('selectFolder', folder.id)"
      >
        <Icon name="heroicons:folder-solid" class="w-4 h-4 text-yellow-500" />
        <span class="truncate">{{ folder.name }}</span>
      </button>
    </div>

    <template v-if="hasChildren && isExpanded">
      <FileTreeItem
        v-for="child in folder.children"
        :key="child.id"
        :folder="child"
        :current-folder-id="currentFolderId"
        :expanded-folders="expandedFolders"
        :depth="depth + 1"
        @select-folder="emit('selectFolder', $event)"
        @toggle-expand="emit('toggleExpand', $event)"
      />
    </template>
  </div>
</template>
