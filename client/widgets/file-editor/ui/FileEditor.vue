<script setup lang="ts">
import type { File } from '~/entities/file'

const props = defineProps<{
  file: File
}>()

const emit = defineEmits<{
  save: [content: string]
  close: []
}>()

const content = ref(props.file.content)
const isDirty = computed(() => content.value !== props.file.content)

watch(() => props.file, (newFile) => {
  content.value = newFile.content
}, { deep: true })

function handleSave() {
  emit('save', content.value)
}
</script>

<template>
  <div class="h-full flex flex-col bg-surface">
    <div class="flex items-center justify-between px-4 py-3 border-b border-border">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span class="font-medium text-content">{{ file.name }}</span>
        <span v-if="isDirty" class="text-xs text-content-muted">(unsaved)</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="handleSave"
          :disabled="!isDirty"
          class="px-4 py-2 rounded bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Save
        </button>
        <button
          @click="emit('close')"
          class="px-4 py-2 rounded text-content-secondary hover:bg-surface-secondary transition-colors"
        >
          Close
        </button>
      </div>
    </div>
    <textarea
      v-model="content"
      class="flex-1 w-full p-4 resize-none focus:outline-none font-mono text-sm text-content bg-surface"
      placeholder="Start writing..."
    />
  </div>
</template>
