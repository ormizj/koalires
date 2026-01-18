<script setup lang="ts">
import { useAuth } from '~/features/auth';
import { useFileManager } from '~/features/file-manager';
import { CreateModal } from '~/features/create-item';
import { FileTree } from '~/widgets/file-tree';
import { FileList } from '~/widgets/file-list';
import { FileEditor } from '~/widgets/file-editor';

const { isAuthenticated, initFromStorage, fetchUser } = useAuth();
const {
  currentFolderId,
  folders,
  files,
  selectedFile,
  allFolders,
  loadContents,
  loadAllFolders,
  navigateToFolder,
  createFolder,
  createFile,
  updateFile,
  deleteFolder,
  deleteFile,
  selectFile,
  closeFile,
  getBreadcrumbs,
} = useFileManager();
const router = useRouter();

const showCreateModal = ref(false);
const createType = ref<'file' | 'folder'>('file');

onMounted(async () => {
  initFromStorage();

  if (!isAuthenticated.value) {
    void router.replace('/login');
    return;
  }

  try {
    await fetchUser();
    if (!isAuthenticated.value) {
      void router.replace('/login');
      return;
    }
    await Promise.all([loadContents(null), loadAllFolders()]);
  } catch {
    void router.replace('/login');
  }
});

function openCreateModal(type: 'file' | 'folder') {
  createType.value = type;
  showCreateModal.value = true;
}

async function handleCreate(name: string) {
  showCreateModal.value = false;
  if (createType.value === 'file') {
    await createFile(name);
  } else {
    await createFolder(name);
  }
}

async function handleSaveFile(content: string) {
  if (selectedFile.value) {
    await updateFile(selectedFile.value.id, content);
  }
}
</script>

<template>
  <div class="h-[calc(100vh-56px)] flex">
    <aside class="w-64 bg-surface border-r border-border flex flex-col">
      <div class="p-4 border-b border-border">
        <button
          class="w-full px-4 py-2 rounded bg-primary text-white hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
          @click="openCreateModal('folder')"
        >
          <Icon name="heroicons:plus" class="w-4 h-4" />
          New Folder
        </button>
      </div>
      <div class="flex-1 overflow-y-auto">
        <FileTree
          :folders="allFolders"
          :current-folder-id="currentFolderId"
          @select-folder="navigateToFolder"
        />
      </div>
    </aside>

    <main class="flex-1 flex flex-col bg-surface-secondary">
      <template v-if="selectedFile">
        <FileEditor
          :file="selectedFile"
          @save="handleSaveFile"
          @close="closeFile"
        />
      </template>

      <template v-else>
        <header
          class="bg-surface border-b border-border px-4 py-3 flex items-center justify-between"
        >
          <div class="flex items-center gap-2 text-sm">
            <button
              class="text-content-secondary hover:text-content"
              @click="navigateToFolder(null)"
            >
              Root
            </button>
            <template v-for="crumb in getBreadcrumbs()" :key="crumb.id">
              <span class="text-content-muted">/</span>
              <button
                class="text-content-secondary hover:text-content"
                @click="navigateToFolder(crumb.id)"
              >
                {{ crumb.name }}
              </button>
            </template>
          </div>
          <button
            class="px-4 py-2 rounded bg-primary text-white hover:bg-primary-hover transition-colors flex items-center gap-2"
            @click="openCreateModal('file')"
          >
            <Icon name="heroicons:plus" class="w-4 h-4" />
            New File
          </button>
        </header>

        <div class="flex-1 overflow-y-auto">
          <FileList
            :folders="folders"
            :files="files"
            @open-folder="navigateToFolder"
            @open-file="selectFile"
            @delete-folder="deleteFolder"
            @delete-file="deleteFile"
          />
        </div>
      </template>
    </main>

    <CreateModal
      :show="showCreateModal"
      :type="createType"
      @create="handleCreate"
      @close="showCreateModal = false"
    />
  </div>
</template>
