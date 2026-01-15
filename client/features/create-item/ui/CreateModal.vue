<script setup lang="ts">
const props = defineProps<{
  show: boolean
  type: 'file' | 'folder'
}>()

const emit = defineEmits<{
  create: [name: string]
  close: []
}>()

const name = ref('')
const inputRef = ref<HTMLInputElement>()

watch(() => props.show, (isShown) => {
  if (isShown) {
    name.value = ''
    nextTick(() => inputRef.value?.focus())
  }
})

function handleSubmit() {
  if (name.value.trim()) {
    emit('create', name.value.trim())
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="emit('close')"
    >
      <div class="bg-surface rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 class="text-lg font-semibold text-content mb-4">
          Create New {{ type === 'file' ? 'File' : 'Folder' }}
        </h2>

        <form @submit.prevent="handleSubmit">
          <input
            ref="inputRef"
            v-model="name"
            type="text"
            :placeholder="type === 'file' ? 'filename.md' : 'Folder name'"
            class="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-surface text-content"
          >

          <div class="flex justify-end gap-3 mt-6">
            <button
              type="button"
              class="px-4 py-2 rounded text-content-secondary hover:bg-surface-secondary transition-colors"
              @click="emit('close')"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="!name.trim()"
              class="px-4 py-2 rounded bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
