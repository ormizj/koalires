<script setup lang="ts">
const props = defineProps<{
  show: boolean
  title?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const inputRef = ref<HTMLElement>()

watch(() => props.show, (isShown) => {
  if (isShown) {
    nextTick(() => inputRef.value?.focus())
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="emit('close')"
    >
      <div class="bg-surface rounded-lg shadow-xl w-full max-w-md p-6">
        <h2
          v-if="title"
          class="text-lg font-semibold text-content mb-4"
        >
          {{ title }}
        </h2>

        <slot />

        <div
          v-if="$slots.footer"
          class="flex justify-end gap-3 mt-6"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
