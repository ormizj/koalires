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
        <Icon
          name="heroicons:document-text"
          class="w-5 h-5 text-primary"
        />
        <span class="font-medium text-content">{{ file.name }}</span>
        <span
          v-if="isDirty"
          class="text-xs text-content-muted"
        >(unsaved)</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          :disabled="!isDirty"
          class="px-4 py-2 rounded bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="handleSave"
        >
          Save
        </button>
        <button
          class="px-4 py-2 rounded text-content-secondary hover:bg-surface-secondary transition-colors"
          @click="emit('close')"
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
