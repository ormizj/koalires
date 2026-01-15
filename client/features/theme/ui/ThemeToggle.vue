<script setup lang="ts">
import { useTheme } from '../model/useTheme'

const { isDark, toggle } = useTheme()
const ready = ref(false)

onMounted(() => {
  ready.value = true
})
</script>

<template>
  <button
    @click="toggle"
    class="p-2 rounded-lg hover:bg-surface-secondary transition-colors w-10 h-10 flex items-center justify-center"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
  >
    <Transition name="icon" mode="out-in">
      <span v-if="!ready" key="placeholder" class="w-6 h-6 inline-block" />
      <Icon v-else-if="isDark" key="sun" name="heroicons:sun" class="w-6 h-6 text-content" />
      <Icon v-else key="moon" name="heroicons:moon" class="w-6 h-6 text-content" />
    </Transition>
  </button>
</template>

<style scoped>
.icon-enter-active,
.icon-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.icon-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.8);
}

.icon-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.8);
}
</style>
